/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@frequen-c/types$': '<rootDir>/packages/types/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
        target: 'es2020',
        jsx: 'react-jsx',
        skipLibCheck: true,
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
          '@frequen-c/types': ['packages/types/src/index.ts'],
        },
      },
    }],
  },
};
