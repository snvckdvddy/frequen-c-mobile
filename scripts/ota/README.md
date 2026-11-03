# OTA publishing

Ship JavaScript-only updates to the installed APK without breaking it.

## Why this exists

On 2026-11-02 two OTA updates built from this folder crashed on the phone. EAS builds the APK from this folder alone with a fresh `npm install`. A local `eas update` bundled from the MusicApp workspace instead, where the root lockfile pins other versions and `metro.config.js` adds the workspace root's `node_modules` to resolution.

- First OTA: Reanimated 4.1.6 and Expo 54.0.33 against the APK's 4.1.7 and 54.0.38. Reanimated's JS/native version check failed at launch and expo-updates rolled back to the embedded bundle without any visible error, so it looked like "the update never arrives".
- Second OTA (ad50536b, after an `npm update` in the workspace): two copies of React in the bundle. Signature: `TypeError: Cannot read property 'useContext' of null` at NavigationContainerInner.

So every OTA is now built from an isolated install that matches the APK, and anything that needs a new native build is refused.

## Publish

```
npm run ota:publish -- "what changed" --dry-run    # runs every check, publishes nothing
npm run ota:publish -- "what changed"
```

Keep the `--`. Without it npm swallows `--dry-run`; the script notices (npm sets `npm_config_dry_run`) and treats the run as a dry run.

Needs Git Bash on Windows, with node, npm and eas-cli on PATH. Commit first: the update is built from `HEAD`.

What the script does, in order:

1. Refuses if tracked files have uncommitted changes.
2. Refuses if native or dependency files differ between the APK's commit and `HEAD`: `app.json`, `app.config.js`, `metro.config.js`, `babel.config.js`, anything under `modules/` or `android/` (except `.gitignore` and `*.md`), the dependency fields of `package.json` (so adding a script is fine), and the `preview:apk` profile in `eas.json`.
3. Builds an isolated copy of `HEAD` outside any workspace: `git archive`, the lockfile from this folder as `package-lock.json`, `npm ci`. Reused when the commit and lockfile are the same.
4. Checks the copy is not inside a workspace, that the installed versions equal `apk-baseline.json`, and that there is exactly one copy each of react, react-native, reanimated and worklets.
5. Exports the `preview:apk` variables from `eas.json` (`eas update` does not apply them itself).
6. Uses a private temp dir (fresh Metro cache), `EAS_NO_VCS=1` and `CI=1`.
7. Runs `eas update --channel preview --platform android --message "<message> (<sha>)" --non-interactive --json` (not on a dry run).
8. Prints the update group id and the verify and rollback commands.

Never run `eas update` by hand from this folder or the workspace.

## When you need a new native build instead

An OTA replaces JavaScript only. These need a new EAS build: native code (`modules/`, `android/`), Expo config or plugins (`app.json`, `app.config.js`), any added, removed or upgraded dependency, and a changed `preview:apk` profile. The script stops at step 2 and says which file triggered it.

## After a new build

1. Build and install the new APK. Note the EAS build id and its commit.
2. Make a fresh isolated copy of that commit outside any workspace: `git archive <commit>`, then `npm install` with no lockfile present (this is what EAS does). Keep the generated `package-lock.json`.
3. Check its `react-native-reanimated` and `react-native-worklets` versions are the ones in the new APK. A mismatch crashes at launch.
4. Save the lockfile here as `apk-<version>.package-lock.json` and update `apk-baseline.json`: runtime version, build id, full commit, lockfile name, versions, and `lockfileSha256` from `node scripts/ota/guards.js lock-hash <file>`. The hash ignores CR bytes, so it is the same on CRLF and LF checkouts.
5. Commit. The next publish uses the new baseline.

Check on 2026-11-02: an export from this setup, compiled the way Gradle does it, gave Hermes bytecode identical to the APK's embedded bundle except for two 20-byte hashes of the JS source text. That match needed one workaround: on Windows the Worklets Babel plugin leaves the library prefix off worklet names (it splits paths on `/`), so worklet names in a Windows-built OTA differ from the APK's. OTA 060dca31, built this way, ran with no JS errors on the emulator and the phone. A bundle exported from a copy built by this script matched the one exported from that verified setup: same JS and same bytecode, differing only in the temp path Hermes stores in its debug info.

## Files and cache

- `apk-baseline.json`: the APK the OTA must match (build id, commit, runtime version, versions).
- `apk-1.2.0.package-lock.json`: the dependency tree that APK was built with.
- `publish-ota.sh`, `guards.js`, `print-profile-env.js`: the tooling.

Copies live in `%LOCALAPPDATA%\frequenc-ota\work\<sha>-<lockhash>\mobile` (about 1 GB each). Each sits alone in its folder because `metro.config.js` watches the parent of the project folder. Metro caches are in `tmp\`, logs in `logs\`. All of it is disposable; delete old copies by hand. Set `OTA_ROOT` to move it (it must be outside any workspace). When the script runs inside the Claude desktop app (a packaged Windows app), Windows redirects this folder into the app's package folder under `%LOCALAPPDATA%\Packages`, so a normal terminal builds its own copy.
