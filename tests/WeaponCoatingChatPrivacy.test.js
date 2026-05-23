import { onCreateChatMessage, onPreCreateChatMessage } from '../scripts/hooks/chat.js';

describe('weapon coating chat privacy', () => {
  beforeEach(() => {
    game.users = [
      { id: 'gm-1', isGM: true },
      { id: 'player-1', isGM: false },
    ];
    game.user = { isGM: true };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fromUuid;
  });

  test('injury poison item cards are whispered to GMs before creation', () => {
    const message = {
      flags: {
        pf2e: {
          origin: {
            rollOptions: [
              'origin:item:trait:injury',
              'origin:item:trait:poison',
            ],
          },
        },
      },
      updateSource: jest.fn(),
    };

    onPreCreateChatMessage(message);

    expect(message.updateSource).toHaveBeenCalledWith({ whisper: ['gm-1'] });
  });

  test('non-injury item cards keep their original visibility', () => {
    const message = {
      flags: {
        pf2e: {
          origin: {
            rollOptions: ['origin:item:trait:poison'],
          },
        },
      },
      updateSource: jest.fn(),
    };

    onPreCreateChatMessage(message);

    expect(message.updateSource).not.toHaveBeenCalled();
  });

  test('created injury poison item cards are corrected to GM whisper from origin uuid fallback', async () => {
    game.settings.get = jest.fn(() => false);
    global.fromUuid = jest.fn(async () => ({
      system: { traits: { value: ['injury', 'poison'] } },
    }));
    const message = {
      flags: {
        pf2e: {
          origin: { uuid: 'Item.poison' },
        },
      },
      whisper: [],
      update: jest.fn(),
    };

    await onCreateChatMessage(message);

    expect(message.update).toHaveBeenCalledWith({ whisper: ['gm-1'] });
  });
});
