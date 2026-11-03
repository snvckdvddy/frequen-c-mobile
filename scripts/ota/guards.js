#!/usr/bin/env node
'use strict';
// Helper for publish-ota.sh. Plain-text output. Exit code 0 means the check passed, 1 means it failed, 2 means bad usage.
//
//   get <json-file> <dotted.key>                        print one value from a JSON file
//   lock-hash <file>                                    sha256 of the file with CR bytes removed (same on CRLF and LF checkouts)
//   drift <repoDir> <baselineCommit> <profile> [ref]    native and dependency-relevant changes since the APK's commit
//   isolation <dir>                                     the isolated copy must not sit inside a workspace or under a node_modules
//   versions <projectDir> <baselineJson>                installed versions match the APK; one copy of each singleton package
//   parse-update <file> [field]                         read the result of `eas update --json`

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const fail = (msg) => { console.error(msg); process.exit(1); };

// ---------------------------------------------------------------- small helpers

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}
const canon = (v) => JSON.stringify(sortKeys(v));
const short = (v) => { const s = JSON.stringify(v) ?? 'undefined'; return s.length > 120 ? `${s.slice(0, 117)}...` : s; };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isEmpty = (v) => v === undefined || v === null || (isPlainObject(v) && Object.keys(v).length === 0) || (Array.isArray(v) && v.length === 0);

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitOk(repo, args) {
  try { git(repo, args); return true; } catch { return false; }
}
function showJson(repo, rev, file) {
  try { return JSON.parse(git(repo, ['show', `${rev}:${file}`])); } catch { return null; }
}

// ---------------------------------------------------------------- get / lock-hash

function cmdGet(file, key) {
  let v = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const part of key.split('.')) v = v == null ? undefined : v[part];
  if (v === undefined) fail(`key not found in ${path.basename(file)}: ${key}`);
  console.log(typeof v === 'object' ? JSON.stringify(v) : String(v));
}

function cmdLockHash(file) {
  const kept = Buffer.from(fs.readFileSync(file).filter((b) => b !== 0x0d));
  console.log(crypto.createHash('sha256').update(kept).digest('hex'));
}

// ---------------------------------------------------------------- drift (guard b)

// Files and folders compared as they are. A difference means the native app or the way JS is built would change.
const RAW = [
  ['app.json', false, 'Expo config: plugins, permissions, updates and runtime version settings are compiled into the native app.'],
  ['app.config.js', false, 'The dynamic Expo config feeds the native build.'],
  ['metro.config.js', false, 'Bundler config. The APK bundle was built with the baseline version, so a change needs a deliberate review.'],
  ['babel.config.js', false, 'Babel config. It changes how worklets and JSX compile.'],
  ['modules', true, 'Local native module code is compiled into the APK. An OTA cannot change it.'],
  ['android', true, 'Native Android project.'],
];
// Files inside the folders above that cannot change what the app does.
const BENIGN = [/(^|\/)\.gitignore$/, /\.md$/i];

// package.json fields that decide which packages (JS and native) end up in the app.
const PKG_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies',
  'bundledDependencies', 'bundleDependencies', 'overrides', 'resolutions', 'workspaces', 'expo'];

function changedPaths(repo, base, ref, spec) {
  const out = git(repo, ['diff', '--name-status', '--no-renames', '-z', base, ref, '--', spec]);
  const parts = out.split('\0').filter((s) => s.length);
  const changes = [];
  for (let i = 0; i + 1 < parts.length; i += 2) changes.push({ status: parts[i], file: parts[i + 1] });
  return changes;
}

function diffPaths(a, b, prefix, out) {
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) diffPaths(a[k], b[k], `${prefix}.${k}`, out);
  } else if (canon(a) !== canon(b)) {
    out.push(prefix);
  }
}

function profileChain(eas, name) {
  const chain = {};
  const seen = new Set();
  let cur = name;
  while (cur && eas && eas.build && eas.build[cur] && !seen.has(cur)) {
    seen.add(cur);
    chain[cur] = eas.build[cur];
    cur = eas.build[cur].extends;
  }
  return chain;
}

function cmdDrift(repo, base, profile, ref = 'HEAD') {
  if (!gitOk(repo, ['cat-file', '-e', `${base}^{commit}`])) {
    fail(`  BLOCKED: the APK's commit ${base.slice(0, 7)} is not in this repository (shallow clone or wrong repository?)`);
  }
  if (!gitOk(repo, ['merge-base', '--is-ancestor', base, ref])) {
    fail(`  BLOCKED: ${ref} is not a descendant of the APK's commit ${base.slice(0, 7)}. Publish from the branch the APK was built on.`);
  }

  const problems = [];
  const notes = [];
  let compared = 0;

  for (const [spec, isDir, why] of RAW) {
    let changes = changedPaths(repo, base, ref, spec);
    if (isDir) {
      const kept = changes.filter((c) => !BENIGN.some((re) => re.test(c.file)));
      for (const c of changes) if (!kept.includes(c)) notes.push(`${c.status} ${c.file} (not code, ignored)`);
      changes = kept;
    }
    compared += 1;
    if (changes.length) problems.push({ title: `${spec} changed since the APK`, why, lines: changes.map((c) => `${c.status} ${c.file}`) });
  }

  const p0 = showJson(repo, base, 'package.json');
  const p1 = showJson(repo, ref, 'package.json');
  if (!p0 || !p1) {
    problems.push({ title: 'package.json is missing or unreadable at one of the two commits', why: 'The dependency comparison cannot run.', lines: [] });
  } else {
    const lines = [];
    for (const f of PKG_FIELDS) {
      const a = p0[f];
      const b = p1[f];
      if (isEmpty(a) && isEmpty(b)) continue;
      if (canon(a) === canon(b)) continue;
      const ma = isEmpty(a) ? {} : a;
      const mb = isEmpty(b) ? {} : b;
      const stringMap = (m) => isPlainObject(m) && Object.values(m).every((x) => typeof x === 'string');
      if (stringMap(ma) && stringMap(mb)) {
        for (const k of [...new Set([...Object.keys(ma), ...Object.keys(mb)])].sort()) {
          if (!(k in ma)) lines.push(`${f}: + ${k}@${mb[k]}`);
          else if (!(k in mb)) lines.push(`${f}: - ${k}@${ma[k]}`);
          else if (ma[k] !== mb[k]) lines.push(`${f}: ~ ${k} ${ma[k]} -> ${mb[k]}`);
        }
      } else {
        lines.push(`${f}: changed (${short(a)} -> ${short(b)})`);
      }
    }
    compared += PKG_FIELDS.length;
    if (lines.length) {
      problems.push({
        title: 'dependency fields in package.json changed since the APK',
        why: 'JS and native package versions must match the installed APK, and only a new EAS build changes the native side. (Edits to scripts, name, version and similar fields are allowed.)',
        lines,
      });
    }
  }

  const e0 = showJson(repo, base, 'eas.json');
  const e1 = showJson(repo, ref, 'eas.json');
  if (!e0 || !e1) {
    problems.push({ title: 'eas.json is missing or unreadable at one of the two commits', why: 'The build profile comparison cannot run.', lines: [] });
  } else {
    const c0 = profileChain(e0, profile);
    const c1 = profileChain(e1, profile);
    compared += 1;
    if (canon(c0) !== canon(c1)) {
      const paths = [];
      diffPaths(c0, c1, `build`, paths);
      problems.push({
        title: `eas.json build profile "${profile}" changed since the APK`,
        why: 'This is the profile that produced the APK. Its env values are compiled into the JS and its android settings define the native build. (Other profiles may change freely.)',
        lines: paths.map((p) => `changed: ${p}`),
      });
    }
  }

  for (const n of notes) console.log(`  note: ${n}`);
  if (problems.length) {
    for (const p of problems) {
      console.log(`  BLOCKED: ${p.title}`);
      console.log(`    why: ${p.why}`);
      for (const l of p.lines) console.log(`    ${l}`);
    }
    process.exit(1);
  }
  console.log(`  ok: no native or dependency change between ${base.slice(0, 7)} and ${ref} (${compared} items compared)`);
}

// ---------------------------------------------------------------- isolation

function ancestorsOf(p) {
  const list = [];
  let cur = path.dirname(p);
  for (;;) {
    list.push(cur);
    const next = path.dirname(cur);
    if (next === cur) break;
    cur = next;
  }
  return list;
}

function cmdIsolation(dir) {
  const problems = [];
  const proj = path.resolve(dir);
  // Windows can redirect a folder (packaged apps get %LOCALAPPDATA% redirected into their package folder), and Node and
  // Metro resolve the real path. Check the folders above both the path we were given and the real path.
  let real = proj;
  try { real = fs.realpathSync.native(proj); } catch { /* a missing folder is reported elsewhere */ }
  const own = path.join(proj, 'package.json');
  try { if (JSON.parse(fs.readFileSync(own, 'utf8')).workspaces) problems.push(`${own} declares workspaces`); } catch { /* no package.json is caught elsewhere */ }

  for (const parent of new Set([...ancestorsOf(proj), ...ancestorsOf(real)])) {
    const pj = path.join(parent, 'package.json');
    if (fs.existsSync(pj)) {
      try { if (JSON.parse(fs.readFileSync(pj, 'utf8')).workspaces) problems.push(`${pj} declares workspaces, so this copy would count as a workspace member`); } catch { /* unreadable package.json cannot declare workspaces */ }
    }
    if (fs.existsSync(path.join(parent, 'pnpm-workspace.yaml'))) problems.push(`${path.join(parent, 'pnpm-workspace.yaml')} exists`);
    if (fs.existsSync(path.join(parent, 'node_modules'))) problems.push(`${path.join(parent, 'node_modules')} exists, and Metro's hierarchical lookup would see it`);
  }

  if (problems.length) {
    console.log('  BLOCKED: the isolated copy is not isolated');
    for (const p of problems) console.log(`    ${p}`);
    process.exit(1);
  }
  console.log('  ok: no workspace and no node_modules above the isolated copy');
  if (real.toLowerCase() !== proj.toLowerCase()) console.log(`  note: Windows keeps this folder at ${real}; the folders above both paths were checked`);
}

// ---------------------------------------------------------------- versions (guard d)

function findCopies(projectDir, names) {
  const wanted = new Set(names);
  const found = Object.fromEntries(names.map((n) => [n, []]));
  const walk = (nm) => {
    let entries;
    try { entries = fs.readdirSync(nm, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || !e.isDirectory()) continue;
      if (e.name.startsWith('@')) {
        let inner;
        try { inner = fs.readdirSync(path.join(nm, e.name), { withFileTypes: true }); } catch { continue; }
        for (const s of inner) if (s.isDirectory()) visit(path.join(nm, e.name, s.name), `${e.name}/${s.name}`);
      } else {
        visit(path.join(nm, e.name), e.name);
      }
    }
  };
  const visit = (dir, name) => {
    if (wanted.has(name) && fs.existsSync(path.join(dir, 'package.json'))) found[name].push(dir);
    walk(path.join(dir, 'node_modules'));
  };
  walk(path.join(projectDir, 'node_modules'));
  return found;
}

function cmdVersions(projectDir, baselineJson) {
  const base = JSON.parse(fs.readFileSync(baselineJson, 'utf8'));
  const problems = [];

  for (const [name, want] of Object.entries(base.packages || {})) {
    let have = null;
    try { have = JSON.parse(fs.readFileSync(path.join(projectDir, 'node_modules', ...name.split('/'), 'package.json'), 'utf8')).version; } catch { /* reported below */ }
    const ok = have === want;
    console.log(`  ${ok ? 'ok      ' : 'MISMATCH'} ${name.padEnd(26)} installed ${String(have).padEnd(8)} APK ${want}`);
    if (!ok) problems.push(`${name}: installed ${have}, the APK has ${want}`);
  }

  const singletons = base.singletons || [];
  const copies = findCopies(projectDir, singletons);
  for (const name of singletons) {
    const list = copies[name];
    const ok = list.length === 1;
    console.log(`  ${ok ? 'ok      ' : 'MISMATCH'} ${name.padEnd(26)} ${list.length} ${list.length === 1 ? 'copy' : 'copies'} in node_modules`);
    if (!ok) problems.push(`${name}: ${list.length} copies in node_modules, need exactly 1${list.length ? ` (${list.join(', ')})` : ''}`);
  }

  let app = {};
  try { app = JSON.parse(fs.readFileSync(path.join(projectDir, 'app.json'), 'utf8')).expo || {}; } catch { /* reported below */ }
  let runtime;
  if (typeof app.runtimeVersion === 'string') runtime = app.runtimeVersion;
  else if (app.runtimeVersion && app.runtimeVersion.policy === 'appVersion') runtime = app.version;
  const rtOk = runtime === base.runtimeVersion;
  console.log(`  ${rtOk ? 'ok      ' : 'MISMATCH'} ${'runtimeVersion'.padEnd(26)} would publish for ${String(runtime).padEnd(8)} APK ${base.runtimeVersion}`);
  if (!rtOk) problems.push(`runtime version would be ${runtime}, the APK is ${base.runtimeVersion}`);

  if (problems.length) {
    for (const p of problems) console.log(`    ${p}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- parse-update

function cmdParseUpdate(file, field) {
  const text = fs.readFileSync(file, 'utf8');
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // eas-cli prints the JSON last; anything the bundler wrote before it is noise
    const idx = text.lastIndexOf('\n[\n');
    const start = idx >= 0 ? idx + 1 : text.indexOf('[\n');
    if (start >= 0) { try { data = JSON.parse(text.slice(start)); } catch { data = null; } }
  }
  if (!Array.isArray(data) || data.length === 0 || !data[0].group) fail('could not find an update group in the eas output');
  const first = data[0];
  if (field) {
    if (first[field] === undefined) fail(`no field "${field}" in the eas output`);
    console.log(String(first[field]));
    return;
  }
  console.log(`group:          ${[...new Set(data.map((u) => u.group))].join(', ')}`);
  console.log(`branch:         ${first.branch}`);
  console.log(`runtimeVersion: ${first.runtimeVersion}`);
  console.log(`platforms:      ${data.map((u) => u.platform).join(', ')}`);
  console.log(`update ids:     ${data.map((u) => u.id).join(', ')}`);
  if (first.message) console.log(`message:        ${first.message}`);
}

// ---------------------------------------------------------------- dispatch

const [cmd, ...args] = process.argv.slice(2);
const need = (n) => { if (args.length < n) { console.error(`usage error: ${cmd} needs ${n} argument(s)`); process.exit(2); } };
switch (cmd) {
  case 'get': need(2); cmdGet(args[0], args[1]); break;
  case 'lock-hash': need(1); cmdLockHash(args[0]); break;
  case 'drift': need(3); cmdDrift(args[0], args[1], args[2], args[3]); break;
  case 'isolation': need(1); cmdIsolation(args[0]); break;
  case 'versions': need(2); cmdVersions(args[0], args[1]); break;
  case 'parse-update': need(1); cmdParseUpdate(args[0], args[1]); break;
  default:
    console.error('usage: guards.js <get|lock-hash|drift|isolation|versions|parse-update> ...');
    process.exit(2);
}
