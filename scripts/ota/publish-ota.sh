#!/usr/bin/env bash
# Publish HEAD of this repo to the EAS preview channel (Android) as an OTA update that matches the installed APK.
#
#   bash scripts/ota/publish-ota.sh "<message>" [--dry-run]
#   npm run ota:publish -- "<message>" [--dry-run]        (keep the --, see scripts/ota/README.md)
#
# Runs in Git Bash on Windows. Do not run `eas update` by hand from this folder or the MusicApp workspace:
# this script builds from an isolated copy that matches what EAS built into the APK.
set -euo pipefail

die() { echo "ABORT: $*" >&2; exit 1; }
trap 'echo "ABORT: unexpected failure near line $LINENO" >&2' ERR

usage() {
  cat <<'EOF'
usage: publish-ota.sh "<message>" [--dry-run]

Publishes HEAD of this repo to the EAS preview channel (Android) as an OTA update, built in an isolated copy that
matches the installed APK. --dry-run runs every check and stops before `eas update`.
With npm: npm run ota:publish -- "<message>" [--dry-run]   (keep the --)
EOF
}

# npm swallows a bare --dry-run and only exports npm_config_dry_run=true, so read it before the npm_* variables are removed
NPM_SWALLOWED_DRY_RUN=0
[ "${npm_config_dry_run:-}" = "true" ] && NPM_SWALLOWED_DRY_RUN=1

DRY=0
MSG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    -h|--help) usage; exit 0 ;;
    -*) usage >&2; die "unknown option: $arg" ;;
    *) [ -z "$MSG" ] || die "more than one message argument; put the whole message in quotes"
       MSG="$arg" ;;
  esac
done
[ -n "$MSG" ] || { usage >&2; die "missing update message"; }
if [ "$NPM_SWALLOWED_DRY_RUN" = "1" ] && [ "$DRY" = "0" ]; then
  DRY=1
  echo "note: npm consumed --dry-run (write it after a --). Treating this run as a dry run, nothing will be published."
fi

# ---------------------------------------------------------------- clean environment
# Nothing from the surrounding shell or from npm run may leak into the install or the bundle.
for v in $(compgen -e | grep -E '^(npm_|EXPO_PUBLIC_)' || true); do unset "$v"; done
unset NODE_ENV NODE_OPTIONS
PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v -F '/node_modules/.bin' | paste -sd: -)"

command -v cygpath >/dev/null 2>&1 || die "run this from Git Bash on Windows (cygpath not found)"
for tool in node npm git tar eas; do command -v "$tool" >/dev/null 2>&1 || die "$tool not found on PATH"; done
win() { cygpath -m "$1"; }
say() { printf '\n[%s/8] %s\n' "$1" "$2"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
GUARDS="$SCRIPT_DIR/guards.js"
BASELINE="$SCRIPT_DIR/apk-baseline.json"
bget() { node "$(win "$GUARDS")" get "$(win "$BASELINE")" "$1"; }
guards() { node "$(win "$GUARDS")" "$@"; }

if [ -n "${OTA_ROOT:-}" ]; then
  ROOT="$(cygpath -u "$OTA_ROOT")"
else
  [ -n "${LOCALAPPDATA:-}" ] || die "LOCALAPPDATA is not set; set OTA_ROOT to a folder outside any workspace"
  ROOT="$(cygpath -u "$LOCALAPPDATA")/frequenc-ota"
fi
mkdir -p "$ROOT/work" "$ROOT/logs" "$ROOT/tmp"

git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$REPO is not a git work tree"
HEAD_FULL="$(git -C "$REPO" rev-parse HEAD)"
HEAD_SHORT="$(git -C "$REPO" rev-parse --short=7 HEAD)"
HEAD_SUBJECT="$(git -C "$REPO" log -1 --format=%s)"

BASE_COMMIT="$(bget commit)"
BASE_SHORT="${BASE_COMMIT:0:7}"
BUILD_ID="$(bget buildId)"
RUNTIME="$(bget runtimeVersion)"
CHANNEL="$(bget channel)"
PROFILE="$(bget buildProfile)"

echo "OTA publish$([ "$DRY" = "1" ] && echo ' (DRY RUN)')"
echo "  repo    : $REPO"
echo "  HEAD    : $HEAD_SHORT  $HEAD_SUBJECT"
echo "  APK     : EAS build ${BUILD_ID:0:8}, commit $BASE_SHORT, runtime $RUNTIME, channel $CHANNEL"
echo "  message : $MSG ($HEAD_SHORT)"

# ---------------------------------------------------------------- 1. clean tree
say 1 "everything must be committed (the OTA is built from HEAD, not from your working files)"
DIRTY="$(git -C "$REPO" status --porcelain --untracked-files=no)"
if [ -n "$DIRTY" ]; then
  printf '%s\n' "$DIRTY" | head -n 15 | sed 's/^/    /' >&2
  die "uncommitted changes in $REPO. Commit or stash them first; anything uncommitted would be silently left out of the OTA."
fi
UNTRACKED="$(git -C "$REPO" ls-files --others --exclude-standard | wc -l | tr -d ' ')"
echo "  ok: tracked files are clean"
[ "$UNTRACKED" = "0" ] || echo "  note: $UNTRACKED untracked file(s) are not part of the OTA; commit them if the app needs them"

# ---------------------------------------------------------------- 2. native and dependency drift
say 2 "native and dependency files must match the APK's commit ($BASE_SHORT)"
if ! guards drift "$(win "$REPO")" "$BASE_COMMIT" "$PROFILE"; then
  cat >&2 <<EOF

ABORT: this change cannot ship as an OTA.
An OTA replaces JavaScript only. Native code, native dependencies and the build config are fixed by the installed APK
(EAS build $BUILD_ID, commit $BASE_SHORT).
Make a new EAS build, install it, then update scripts/ota/apk-baseline.json and the lockfile (steps in scripts/ota/README.md).
EOF
  exit 1
fi

# ---------------------------------------------------------------- 3. isolated copy
say 3 "isolated copy outside any workspace: git archive HEAD + the APK's lockfile + npm ci"
LOCK_FILE="$SCRIPT_DIR/$(bget lockfile)"
[ -f "$LOCK_FILE" ] || die "lockfile $LOCK_FILE is missing"
LOCK_HASH="$(guards lock-hash "$(win "$LOCK_FILE")")"
[ "$LOCK_HASH" = "$(bget lockfileSha256)" ] || die "the lockfile does not match lockfileSha256 in apk-baseline.json (edited or regenerated by hand?). Restore it from git, or update the hash if the change is deliberate."
KEY="${HEAD_SHORT}-${LOCK_HASH:0:8}"
WORK="$ROOT/work/$KEY"
PROJ="$WORK/mobile"
MARK="$WORK/.ota-ready"
WANT="head=$HEAD_FULL lock=$LOCK_HASH"
if [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$WANT" ] && [ -d "$PROJ/node_modules" ]; then
  echo "  ok: reusing the cached copy for this commit and lockfile ($KEY)"
else
  echo "  building $KEY (npm ci, about a minute)"
  mkdir -p "$PROJ"
  git -C "$REPO" archive HEAD | tar -x -C "$PROJ"
  cp "$LOCK_FILE" "$PROJ/package-lock.json"
  NPMLOG="$ROOT/logs/$KEY-npm-ci.log"
  if ! ( cd "$PROJ" && npm ci --no-audit --no-fund ) > "$NPMLOG" 2>&1; then
    tail -n 25 "$NPMLOG" | sed 's/^/    /' >&2
    die "npm ci failed (full log: $NPMLOG). It needs package.json and the baseline lockfile to be in sync, and the project's npm config must not ignore lockfiles."
  fi
  printf '%s\n' "$WANT" > "$MARK"
  echo "  ok: built $PROJ"
fi

# ---------------------------------------------------------------- 4. guards on the copy
say 4 "isolation and installed versions must match the APK"
guards isolation "$(win "$PROJ")" || die "the isolated copy would see a workspace or a parent node_modules (see above). Set OTA_ROOT to another folder."
guards versions "$(win "$PROJ")" "$(win "$BASELINE")" || die "the installed packages do not match the APK (see above)."
NPM_REACT="$( cd "$PROJ" && { npm ls react --all --parseable 2>/dev/null || true; } | tr -d '\r' | sort -u | grep -c -E '[/\\]node_modules[/\\]react$' || true )"
echo "  info: npm ls react also finds ${NPM_REACT:-?} install path(s) (the checks above are the ones that count)"

# ---------------------------------------------------------------- 5. build env from eas.json
say 5 "export the \"$PROFILE\" variables from eas.json (eas update does not apply them by itself)"
eval "$(node "$(win "$SCRIPT_DIR/print-profile-env.js")" "$(win "$PROJ")" "$PROFILE")"
[ -n "${APP_ENV:-}" ] && [ -n "${EXPO_PUBLIC_API_BASE_URL:-}" ] || die "APP_ENV or EXPO_PUBLIC_API_BASE_URL is missing from the \"$PROFILE\" env block in eas.json"
N_VARS="$(node "$(win "$SCRIPT_DIR/print-profile-env.js")" "$(win "$PROJ")" "$PROFILE" | wc -l | tr -d ' ')"
echo "  ok: $N_VARS variables exported (APP_ENV=$APP_ENV)"

# ---------------------------------------------------------------- 6. isolation env
say 6 "private temp dir, no VCS lookups, no prompts"
export EAS_NO_VCS=1 EAS_PROJECT_ROOT="$(cd "$PROJ" && pwd -W)" CI=1 EXPO_NO_TELEMETRY=1
PTMP="$ROOT/tmp/$KEY"
mkdir -p "$PTMP"
export TEMP="$(cygpath -w "$PTMP")" TMP="$(cygpath -w "$PTMP")"
echo "  ok: TEMP=$TEMP (fresh Metro cache, never the machine-wide one)"

CMD=(eas update --channel "$CHANNEL" --platform android --message "$MSG ($HEAD_SHORT)" --non-interactive --json)
SHOWN="eas update --channel $CHANNEL --platform android --message \"$MSG ($HEAD_SHORT)\" --non-interactive --json"

print_reminders() {
  cat <<EOF

Verify:
  eas update:view $1
  Relaunch the app on a device (twice if the first launch still shows the old bundle) and read its logs over adb:
    adb -s <serial> logcat -d -v time | grep -E "ReactNativeJS|dev.expo.updates"
  (serial and other adb commands: memory reference-device-adb)

Roll back to the embedded bundle (run from the mobile repo):
  eas update:roll-back-to-embedded --channel $CHANNEL --runtime-version $RUNTIME --platform android --message "rollback" --non-interactive
EOF
}

# ---------------------------------------------------------------- 7. publish
if [ "$DRY" = "1" ]; then
  say 7 "DRY RUN: all checks passed, nothing was published"
  echo "  run from : $PROJ"
  echo "  command  : $SHOWN"
  say 8 "after a real publish this prints the update group id and:"
  print_reminders "<group id>"
  exit 0
fi

say 7 "publishing"
echo "  $SHOWN"
OUT="$ROOT/logs/$KEY-publish-$(date +%Y%m%d-%H%M%S).out"
CODE=0
( cd "$PROJ" && "${CMD[@]}" ) > "$OUT" || CODE=$?
if [ "$CODE" -ne 0 ]; then
  echo "eas update failed with exit code $CODE. Its stdout was saved to $OUT" >&2
  exit "$CODE"
fi

# ---------------------------------------------------------------- 8. result
say 8 "result"
GROUP="$(guards parse-update "$(win "$OUT")" group 2>/dev/null || true)"
if [ -n "$GROUP" ]; then
  echo "  Published. Update group id: $GROUP"
  guards parse-update "$(win "$OUT")" | sed 's/^/  /'
else
  echo "  Published, but the update group id could not be read from the eas output."
  echo "  Raw output: $OUT"
fi
print_reminders "${GROUP:-<group id>}"
