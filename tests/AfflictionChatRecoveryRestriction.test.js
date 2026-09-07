import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';

describe('AfflictionChatService recovery restrictions', () => {
  beforeEach(() => {
    game.users = [{ id: 'gm-1', isGM: true }];
    game.i18n.localize = jest.fn(key => key);
    game.i18n.format = jest.fn((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.IS_NOW_AT_STAGE') return `is now at Stage ${data.stage}`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.WAS_STAGE') return `(was ${data.stage})`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR') return `Target ${data.actorName}`;
      return key;
    });
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Unknown' }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('tags raw damage enrichers embedded in a restricted stage-change card', async () => {
    const token = {
      id: 'token-1',
      name: 'Unknown',
      actor: { id: 'actor-1', name: 'Unknown' },
      document: { actorLink: false },
    };
    const affliction = {
      id: 'bog-rot-id',
      name: 'Bog Rot',
      currentStage: 2,
      recoveryRestriction: {
        minimumStage: 1,
        unhealableDamage: true,
        requiresCounteract: true,
      },
      stages: [
        { number: 1, effects: '' },
        {
          number: 2,
          effects: '@Damage[3d6[void]] damage and clumsy 1',
          damage: [{ formula: '3d6', type: 'void' }],
          conditions: [{ name: 'clumsy', value: 1 }],
        },
      ],
    };

    await AfflictionChatService.postStageChange(token, affliction, 1, 2);

    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain(
      '@Damage[3d6[void]|options:pf2e-afflictioner:unhealable-damage:bog-rot-id|immutable]',
    );
  });
});
