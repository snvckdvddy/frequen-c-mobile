/**
 * Running-update info (Profile BUILD row, diagnostics bundle, launch log).
 * expo-updates is a native module, so it is replaced with a plain object the
 * tests can change between cases.
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

import {
  describeUpdate,
  formatUpdateDiagnosticsLines,
  formatUpdateRowText,
  getRunningUpdate,
  type RawUpdateState,
} from '../updateInfo';

function raw(overrides: Partial<RawUpdateState> = {}): RawUpdateState {
  return {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: OTA_ID,
    channel: 'preview',
    runtimeVersion: '1.2.0',
    createdAt: new Date('2026-11-10T20:00:00.000Z'),
    ...overrides,
  };
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

describe('describeUpdate', () => {
  it('shows the first 8 characters of a downloaded update ID, upper-case', () => {
    const update = describeUpdate(raw());
    expect(update.label).toBe('01A1C971');
    expect(update.isEmbedded).toBe(false);
    expect(update.updatesEnabled).toBe(true);
    expect(update.updateId).toBe(OTA_ID);
  });

  it('says EMBEDDED when the bundle inside the APK is running', () => {
    const update = describeUpdate(raw({ isEmbeddedLaunch: true, updateId: EMBEDDED_ID }));
    expect(update.label).toBe('EMBEDDED');
    expect(update.isEmbedded).toBe(true);
    expect(update.updateId).toBe(EMBEDDED_ID);
  });

  it('treats enabled updates with no ID as embedded', () => {
    expect(describeUpdate(raw({ updateId: null })).label).toBe('EMBEDDED');
  });

  it('says UPDATES OFF where expo-updates is disabled (dev client, Expo Go)', () => {
    const update = describeUpdate(raw({ isEnabled: false, updateId: null, channel: null }));
    expect(update.label).toBe('UPDATES OFF');
    expect(update.isEmbedded).toBe(false);
    expect(update.updatesEnabled).toBe(false);
  });

  it('reports the creation time as ISO text, or null', () => {
    expect(describeUpdate(raw()).createdAt).toBe('2026-11-10T20:00:00.000Z');
    expect(describeUpdate(raw({ createdAt: null })).createdAt).toBeNull();
  });
});

describe('formatUpdateRowText', () => {
  it('puts the short ID and the channel on one line', () => {
    expect(formatUpdateRowText(describeUpdate(raw()))).toBe('OTA // 01A1C971 // CHANNEL PREVIEW');
  });

  it('shows EMBEDDED with its channel', () => {
    const text = formatUpdateRowText(describeUpdate(raw({ isEmbeddedLaunch: true })));
    expect(text).toBe('OTA // EMBEDDED // CHANNEL PREVIEW');
  });

  it('shows NONE when there is no channel', () => {
    const text = formatUpdateRowText(describeUpdate(raw({ channel: null })));
    expect(text).toBe('OTA // 01A1C971 // CHANNEL NONE');
  });
});

describe('formatUpdateDiagnosticsLines', () => {
  it('gives the full ID, channel, runtime version and creation time', () => {
    expect(formatUpdateDiagnosticsLines(describeUpdate(raw()))).toEqual([
      `OTA update: 01A1C971 (id ${OTA_ID})`,
      'OTA channel: preview',
      'Runtime version: 1.2.0',
      'OTA created: 2026-11-10T20:00:00.000Z',
    ]);
  });

  it('keeps the embedded bundle ID so a rollback can be told apart', () => {
    const lines = formatUpdateDiagnosticsLines(describeUpdate(raw({ isEmbeddedLaunch: true, updateId: EMBEDDED_ID })));
    expect(lines[0]).toBe(`OTA update: EMBEDDED (id ${EMBEDDED_ID})`);
  });

  it('fills in none and unknown for what is missing, and skips the creation line', () => {
    const lines = formatUpdateDiagnosticsLines(
      describeUpdate(raw({ isEnabled: false, updateId: null, channel: null, runtimeVersion: null, createdAt: null })),
    );
    expect(lines).toEqual([
      'OTA update: UPDATES OFF (id none)',
      'OTA channel: none',
      'Runtime version: unknown',
    ]);
  });
});

describe('getRunningUpdate', () => {
  it('reads the live expo-updates values', () => {
    expect(getRunningUpdate()).toMatchObject({
      label: '01A1C971',
      updateId: OTA_ID,
      channel: 'preview',
      runtimeVersion: '1.2.0',
      isEmbedded: false,
      updatesEnabled: true,
    });
  });

  it('follows a switch to the embedded bundle', () => {
    mockUpdates.isEmbeddedLaunch = true;
    expect(getRunningUpdate().label).toBe('EMBEDDED');
  });

  it('degrades to UPDATES OFF, and logs, when expo-updates throws', () => {
    Object.defineProperty(mockUpdates, 'updateId', {
      configurable: true,
      get() {
        throw new Error('native module unavailable');
      },
    });
    try {
      expect(getRunningUpdate().label).toBe('UPDATES OFF');
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(mockUpdates, 'updateId', { configurable: true, writable: true, value: OTA_ID });
    }
  });
});

describe('logRunningUpdateOnce', () => {
  it('writes one "updates" line per launch however often it is called', () => {
    jest.isolateModules(() => {
      const fresh = require('../updateInfo') as typeof import('../updateInfo');
      fresh.logRunningUpdateOnce();
      fresh.logRunningUpdateOnce();
      fresh.logRunningUpdateOnce();
    });

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [tag, message] = mockLogger.info.mock.calls[0] as [string, string];
    expect(tag).toBe('updates');
    expect(message).toContain('01A1C971');
    expect(message).toContain(OTA_ID);
    expect(message).toContain('channel preview');
    expect(message).toContain('embedded no');
  });

  it('says embedded when the APK bundle is running', () => {
    mockUpdates.isEmbeddedLaunch = true;
    jest.isolateModules(() => {
      const fresh = require('../updateInfo') as typeof import('../updateInfo');
      fresh.logRunningUpdateOnce();
    });

    const [, message] = mockLogger.info.mock.calls[0] as [string, string];
    expect(message).toContain('running EMBEDDED');
    expect(message).toContain('embedded yes');
  });
});
