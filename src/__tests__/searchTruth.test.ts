jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../services/config', () => ({
  USE_MOCKS: false,
  AI_USE_REAL_BACKEND: false,
}));

import {
  ApiError,
  classifyProviderSearchFailure,
  getIdleSearchProviderStates,
  setCurrentServices,
} from '../services/api';

describe('search provider truth classification', () => {
  afterEach(() => {
    setCurrentServices(undefined);
  });

  it('keeps connected providers with expired tokens in the error state', () => {
    const error = new ApiError(401, 'Spotify token expired, please reconnect', {
      message: 'Spotify token expired, please reconnect',
      debugCode: 'TOKEN_EXPIRED',
      upstreamStatus: 401,
    });

    const diagnostic = classifyProviderSearchFailure('spotify', true, error);

    expect(diagnostic.state).toBe('error');
    expect(diagnostic.code).toBe('TOKEN_EXPIRED');
    expect(diagnostic.httpStatus).toBe(401);
    expect(diagnostic.upstreamStatus).toBe(401);
  });

  it('treats explicit NOT_CONNECTED backend responses as unpatched', () => {
    const error = new ApiError(403, 'SoundCloud not connected', {
      message: 'SoundCloud not connected',
      debugCode: 'NOT_CONNECTED',
      upstreamStatus: null,
    });

    const diagnostic = classifyProviderSearchFailure('soundcloud', true, error);

    expect(diagnostic.state).toBe('unpatched');
    expect(diagnostic.code).toBe('NOT_CONNECTED');
    expect(diagnostic.httpStatus).toBe(403);
  });

  it('does not guess unpatched for generic 403 search failures', () => {
    const error = new ApiError(403, 'Forbidden', {
      message: 'Forbidden',
      upstreamStatus: 403,
    });

    const diagnostic = classifyProviderSearchFailure('spotify', true, error);

    expect(diagnostic.state).toBe('error');
    expect(diagnostic.code).toBe('ENDPOINT_AUTH_ERROR');
  });

  it('surfaces Spotify app policy failures as endpoint errors, not disconnects', () => {
    const error = new ApiError(403, 'Failed to search Spotify', {
      message: 'Failed to search Spotify',
      debugCode: 'APP_SUBSCRIPTION_REQUIRED',
      upstreamStatus: 403,
    });

    const diagnostic = classifyProviderSearchFailure('spotify', true, error);

    expect(diagnostic.state).toBe('error');
    expect(diagnostic.code).toBe('APP_SUBSCRIPTION_REQUIRED');
  });

  it('derives idle provider states from the auth snapshot only', () => {
    setCurrentServices({
      spotify: { connected: true, username: 'caleb' },
      soundcloud: { connected: false },
    });

    expect(getIdleSearchProviderStates()).toEqual({
      spotify: 'off',
      soundcloud: 'unpatched',
      tidal: 'unpatched',
      appleMusic: 'off',
    });
  });
});
