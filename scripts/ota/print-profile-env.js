#!/usr/bin/env node
'use strict';
// usage: eval "$(node print-profile-env.js <projectDir> <easProfile>)"
//
// Prints `export NAME='value'` lines for every variable in eas.json build.<profile>.env (public client IDs and URLs),
// so a shell-driven command sees the same inlined EXPO_PUBLIC_* values the EAS build had.
// `eas update` does not apply the build profile's env block by itself, so without this the OTA would lack them.

const fs = require('node:fs');
const path = require('node:path');

const [projectDir, profile] = process.argv.slice(2);
if (!projectDir || !profile) {
  console.error('usage: print-profile-env.js <projectDir> <easProfile>');
  process.exit(2);
}

const eas = JSON.parse(fs.readFileSync(path.join(projectDir, 'eas.json'), 'utf8'));
const vars = eas.build && eas.build[profile] && eas.build[profile].env;
if (!vars || typeof vars !== 'object') {
  console.error(`eas.json has no build profile "${profile}" with an env block`);
  process.exit(1);
}

for (const [name, value] of Object.entries(vars)) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    console.error(`refusing variable with an unsafe name: ${name}`);
    process.exit(1);
  }
  console.log(`export ${name}='${String(value).replace(/'/g, "'\\''")}'`);
}
