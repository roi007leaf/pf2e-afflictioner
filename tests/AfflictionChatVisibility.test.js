import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';

describe('AfflictionChatService relative visibility', () => {
  beforeEach(() => {
    game.users = [{ id: 'gm-1', isGM: true }];
    game.i18n.localize = jest.fn(key => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.DAMAGE_PREFIX') return 'Damage:';
      if (key === 'PF2E_AFFLICTIONER.CHAT.CONDITIONS_PREFIX') return 'Conditions:';
      if (key === 'PF2E_AFFLICTIONER.CHAT.STAGE_INCREASED') return 'Stage increased';
      if (key === 'PF2E_AFFLICTIONER.MANAGER.STAGE') return 'Stage';
      return key;
    });
    game.i18n.format = jest.fn((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.IS_NOW_AT_STAGE') return `is now at Stage ${data.stage}`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.WAS_STAGE') return `(was ${data.stage})`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR') return `Target ${data.actorName}`;
      return key;
    });
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Ed' }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps damage in summary but omits legacy actor-relative Concealed condition', async () => {
    const token = {
      id: 'token-1',
      name: 'Ed',
      actor: { id: 'actor-1', name: 'Ed' },
      document: { actorLink: false },
    };
    const affliction = {
      id: 'darkening-poison',
      name: 'Darkening Poison',
      stages: [
        {},
        {
          effects: '1d6 poison and creatures you can see only with darkvision are Concealed from you',
          damage: [{ formula: '1d6', type: 'poison' }],
          conditions: [{ name: 'concealed', value: null }],
        },
      ],
    };

    await AfflictionChatService.postStageChange(token, affliction, 1, 2);

    const content = ChatMessage.create.mock.calls[0][0].content;
    expect(content).toContain('Damage: 1d6 poison');
    expect(content).not.toContain('Conditions: concealed');
    expect(content).toContain('class="pf2e-afflictioner-stage-change__heading"');
    expect(content).toContain('class="pf2e-afflictioner-stage-change__summary"');
    expect(content).toContain('class="pf2e-afflictioner-stage-change__effects"');
  });
});
