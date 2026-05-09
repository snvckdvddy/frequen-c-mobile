#!/usr/bin/env node
/**
 * jest-run.js — Windows path normalizer for Jest invocations
 *
 * The claudekit test-changed hook passes absolute Windows paths as Jest
 * pattern arguments (e.g. "npm test -- C:\Users\...\foo.test.ts"). Jest
 * treats the argument as a regex, where backslashes are metacharacters —
 * so the pattern matches nothing on Windows.
 *
 * This wrapper converts all backslashes in arguments to forward slashes
 * before handing them to Jest. Jest internally normalizes file paths to
 * forward slashes, so the converted pattern matches correctly.
 *
 * Usage (via package.json "test" script):
 *   npm test              → runs the full suite
 *   npm test -- <path>    → runs tests matching the normalized path
 */

'use strict';

const { spawnSync } = require('child_process');

// Skip argv[0] (node) and argv[1] (this script).
// Normalize any argument that looks like an absolute Windows path.
const args = process.argv.slice(2).map((arg) =>
  arg.replace(/\\/g, '/')
);

const result = spawnSync('npx', ['jest', ...args], {
  stdio: 'inherit',
  shell: true,        // shell:true needed on Windows for npx
  cwd: process.cwd(),
});

process.exit(result.status ?? 0);
