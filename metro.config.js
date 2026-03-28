const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot, workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

// Resolve @frequen-c/types from local source (bundled in project for EAS).
// Metro transpiles the TypeScript source directly — no npm install needed.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@frequen-c/types': path.resolve(projectRoot, 'packages', 'types'),
};

module.exports = config;
