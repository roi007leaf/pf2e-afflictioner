import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';

describe('AfflictionService effect-only afflictions', () => {
  beforeEach(() => {
    global.foundry = { utils: { randomID: jest.fn(() => 'affliction-id') } };
    game.combat = null;
    game.pf2e = { settings: { metagame: { dcs: true } } };
    game.users = [{ id: 'gm-1', isGM: true }];
    game.i18n.format = jest.fn((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.REFERENCED_SAVE_TITLE') return `Secondary Affliction: ${data.afflictionName}`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.REFERENCED_SAVE_DESC') return `${data.tokenName} exposed to ${data.afflictionName}`;
      if (key === 'PF2E_AFFLICTIONER.CHAT.ROLL_REFERENCED_SAVE') return `Roll ${data.saveType} Save`;
      return key;
    });
    game.i18n.localize = jest.fn(key => key);
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Target' }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete game.pf2e;
  });

  test('prompts a standalone effect-only curse save without storing a staged affliction', async () => {
    const actor = {
      id: 'actor-1',
      name: 'Target',
      hasPlayerOwner: false,
      system: { attributes: { immunities: [] } },
      getFlag: jest.fn(() => ({})),
      setFlag: jest.fn(),
    };
    const token = {
      id: 'token-1',
      name: 'Target',
      actor,
      document: { actorLink: true },
    };
    const promptSpy = jest.spyOn(AfflictionChatService, 'promptInitialSave').mockResolvedValue(undefined);

    await AfflictionService.promptInitialSave(token, {
      name: 'Curse of Flawed History',
      type: 'curse',
      dc: 37,
      saveType: 'will',
      isEffectOnly: true,
      effectText: 'The creature takes a -2 status penalty to checks.',
      effectConditions: [],
      traits: ['curse'],
    });

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(promptSpy).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('affliction-roll-referenced-save'),
    }));
  });
});
