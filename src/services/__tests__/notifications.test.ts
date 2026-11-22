/**
 * Notification policy tests: what the app may post to the system shade.
 *
 * Track changes post nothing (the room UI already shows the track, and a
 * banner with a sound on every advance was noise). A genuine arrival still
 * posts "<user> joined the room", which also proves the stubbed posting path is
 * live, so the track-change assertions can't pass just because nothing works.
 *
 * expo-constants and expo-notifications can't load in the Node test env, so
 * both are stubbed. The constants stub reports a standalone build so the module
 * takes its real posting path instead of the Expo Go early return.
 */

const mockSchedule = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: 'standalone' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: (options: unknown) => mockSchedule(options),
}));

import notifications, {
  notifyParticipantJoined,
  notifyTrackChanged,
} from '../notifications';

beforeEach(() => {
  mockSchedule.mockReset();
  mockSchedule.mockResolvedValue('notification-id');
});

describe('notifications', () => {
  it('posts no system notification when the track changes', async () => {
    await expect(notifyTrackChanged('Song', 'Artist', 'ses_1')).resolves.toBeUndefined();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('posts none through the default export either', async () => {
    await expect(notifications.notifyTrackChanged('Song', 'Artist', 'ses_1')).resolves.toBeUndefined();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('still posts one notification when a guest joins', async () => {
    await notifyParticipantJoined('zara', 'Friday Night', 'ses_1');

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith({
      content: {
        title: 'Friday Night',
        body: 'zara joined the room',
        data: { type: 'participant-joined', sessionId: 'ses_1' },
        sound: true,
      },
      trigger: null,
    });
  });
});
