/**
 * The running OTA update in COPY DIAGNOSTICS and in the launch log.
 *
 * Everything native is replaced: expo-updates with a plain object the tests can
 * change between cases, and expo-constants, expo-auth-session, ./config and ./api
 * with the few values authDiagnostics reads from them. updateInfo.test.ts covers
 * how an update is described; this covers that authDiagnostics wires it in.
 */

interface MockUpdates {
  __esModule: true;
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  createdAt: Date | null;
}

const OTA_ID = '01a1c971-ca8a-7b60-abd9-e5241cb5c1d4';
const EMBEDDED_ID = '7c0f3b52-9d1e-4a38-8f64-2b5e91a0c7d3';

const mockUpdates: MockUpdates = {
  __esModule: true,
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: OTA_ID,
  channel: 'preview',
  runtimeVersion: '1.2.0',
  createdAt: new Date('2026-11-10T20:00:00.000Z'),
};

const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('expo-updates', () => mockUpdates);
jest.mock('../../utils/logger', () => ({ logger: mockLogger }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, expoConfig: { version: '1.2.0', sdkVersion: '54.0.0' } },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'frequenc://test-redirect' }));
jest.mock('../config', () => ({ API_BASE_URL: 'https://api.example.test/api' }));
jest.mock('../api', () => ({
  currentServices: undefined,
  getLastSearchDiagnosticsSnapshot: () => undefined,
}));

type AuthDiagnosticsModule = typeof import('../authDiagnostics');

/** A fresh copy of the module, the way each app launch gets one. */
function loadAuthDiagnostics(): AuthDiagnosticsModule {
  let loaded: AuthDiagnosticsModule | undefined;
  jest.isolateModules(() => {
    loaded = require('../authDiagnostics') as AuthDiagnosticsModule;
  });
  if (!loaded) throw new Error('authDiagnostics did not load');
  return loaded;
}

/** The APP RUNTIME block of the bundle, as separate lines. */
function runtimeBlock(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.indexOf('--- APP RUNTIME ---');
  const end = lines.indexOf('--- CONNECTED SERVICES ---');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return lines.slice(start + 1, end);
}

beforeEach(() => {
  Object.assign(mockUpdates, {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: OTA_ID,
    channel: 'preview',
    runtimeVersion: '1.2.0',
    createdAt: new Date('2026-11-10T20:00:00.000Z'),
  });
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
});

describe('launch log', () => {
  it('logs the running update once, under the "updates" tag, as the module loads', () => {
    loadAuthDiagnostics();

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [tag, message] = mockLogger.info.mock.calls[0] as [string, string];
    expect(tag).toBe('updates');
    expect(message).toContain('01A1C971');
    expect(message).toContain(OTA_ID);
    expect(message).toContain('channel preview');
  });

  it('does not log again when diagnostics are read or built later', () => {
    const diagnostics = loadAuthDiagnostics();

    diagnostics.getAuthDiagnostics();
    diagnostics.formatFullDiagnosticsText();
    diagnostics.formatFullDiagnosticsText();

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('says EMBEDDED when the bundle inside the APK is running', () => {
    mockUpdates.isEmbeddedLaunch = true;
    mockUpdates.updateId = EMBEDDED_ID;

    loadAuthDiagnostics();

    const [, message] = mockLogger.info.mock.calls[0] as [string, string];
    expect(message).toContain('running EMBEDDED');
    expect(message).toContain(EMBEDDED_ID);
  });
});

describe('formatFullDiagnosticsText', () => {
  it('puts the update ID, channel and runtime version in the APP RUNTIME block', () => {
    const block = runtimeBlock(loadAuthDiagnostics().formatFullDiagnosticsText());

    expect(block).toEqual(expect.arrayContaining([
      'App version: 1.2.0',
      `OTA update: 01A1C971 (id ${OTA_ID})`,
      'OTA channel: preview',
      'Runtime version: 1.2.0',
      'OTA created: 2026-11-10T20:00:00.000Z',
    ]));
  });

  it('reports EMBEDDED, with the bundle ID, when the APK bundle is running', () => {
    mockUpdates.isEmbeddedLaunch = true;
    mockUpdates.updateId = EMBEDDED_ID;

    const block = runtimeBlock(loadAuthDiagnostics().formatFullDiagnosticsText());

    expect(block).toContain(`OTA update: EMBEDDED (id ${EMBEDDED_ID})`);
    expect(block).toContain('OTA channel: preview');
  });

  it('reports UPDATES OFF in a build where expo-updates is disabled', () => {
    Object.assign(mockUpdates, {
      isEnabled: false,
      updateId: null,
      channel: null,
      runtimeVersion: null,
      createdAt: null,
    });

    const block = runtimeBlock(loadAuthDiagnostics().formatFullDiagnosticsText());

    expect(block).toContain('OTA update: UPDATES OFF (id none)');
    expect(block).toContain('OTA channel: none');
    expect(block).toContain('Runtime version: unknown');
    expect(block.some((line) => line.startsWith('OTA created:'))).toBe(false);
  });
});
