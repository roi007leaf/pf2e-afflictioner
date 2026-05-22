import { onCreateChatMessage } from '../scripts/hooks/chat.js';

describe('weapon injection attack prompts', () => {
  beforeEach(() => {
    jest.resetModules();
    game.user = {
      isGM: true,
      targets: new Set(),
    };
    game.users = [{ id: 'gm-1', isGM: true }];
    game.settings.get = jest.fn((moduleId, key) => (
      moduleId === 'pf2e-afflictioner' && key === 'autoDetectAfflictions'
    ));
    game.i18n.localize = jest.fn(key => key);
    game.i18n.format = jest.fn((key, data = {}) => `${key}:${JSON.stringify(data)}`);
    ChatMessage.create = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
    delete global.fromUuid;
  });

  test('successful attack with loaded injection trait weapon posts an inject save prompt', async () => {
    const actor = {
      id: 'actor-1',
      uuid: 'Actor.actor-1',
      name: 'Alchemist',
      type: 'character',
      getFlag: jest.fn((_moduleId, key) => {
        if (key === 'weaponInjections') {
          return {
            'weapon-1': {
              poisonName: 'Giant Centipede Venom',
              weaponName: 'Injection Spear',
              afflictionData: {
                name: 'Giant Centipede Venom',
                type: 'poison',
                traits: ['injury', 'poison'],
              },
            },
          };
        }
        return {};
      }),
    };
    const weapon = {
      id: 'weapon-1',
      uuid: 'Item.weapon-1',
      name: 'Injection Spear',
      parent: actor,
      system: {
        traits: { value: new Set(['injection']) },
        damage: { damageType: 'piercing' },
      },
    };
    const target = { id: 'target-1', name: 'Ogre' };

    global.canvas = {
      tokens: {
        get: jest.fn(id => (id === 'target-1' ? target : null)),
      },
    };
    global.fromUuid = jest.fn(async uuid => {
      if (uuid === 'Item.weapon-1') return weapon;
      if (uuid === 'Scene.scene.Token.target-1') return { id: 'target-1' };
      return null;
    });

    await onCreateChatMessage({
      flags: {
        pf2e: {
          context: {
            type: 'attack-roll',
            outcome: 'success',
            target: { token: 'Scene.scene.Token.target-1' },
          },
          origin: { uuid: 'Item.weapon-1' },
        },
      },
    });

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('PF2E_AFFLICTIONER.WEAPON_COATING.INJECTION_HIT_TITLE'),
      whisper: ['gm-1'],
    }));
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('pf2e-afflictioner-inject-weapon-poison');
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('data-weapon-id="weapon-1"');
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('Giant%20Centipede%20Venom');
  });
});
