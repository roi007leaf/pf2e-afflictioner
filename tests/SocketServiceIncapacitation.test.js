import { DEGREE_OF_SUCCESS } from '../scripts/constants.js';

jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: {},
}));

import { SocketService } from '../scripts/services/SocketService.js';

describe('SocketService immediate save modifier notices', () => {
  beforeEach(() => {
    game.users = [{ id: 'gm-1', isGM: true }, { id: 'player-1', isGM: false }];
    game.i18n.localize = jest.fn((key) => key);
    game.i18n.format = jest.fn((key, data = {}) => `${key}: ${data.from} -> ${data.to}`);
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Test Token' }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('posts a GM-only chat notice when immediate save handling applies incapacitation', async () => {
    const token = { name: 'Test Token' };
    const actor = { name: 'Test Actor' };
    const affliction = { name: 'Test Disease' };
    const degreeResult = {
      degree: DEGREE_OF_SUCCESS.SUCCESS,
      rawDegree: DEGREE_OF_SUCCESS.FAILURE,
      incapacitationApplied: true,
    };

    await SocketService.postImmediateSaveModifierNotice(token, actor, affliction, degreeResult, 'stage');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INCAPACITATION_UPGRADED'),
    }));
  });

  test('does not post an immediate notice when incapacitation did not change the result', async () => {
    await SocketService.postImmediateSaveModifierNotice(null, { name: 'Test Actor' }, { name: 'Test Disease' }, {
      degree: DEGREE_OF_SUCCESS.FAILURE,
      rawDegree: DEGREE_OF_SUCCESS.FAILURE,
      incapacitationApplied: false,
    }, 'initial');

    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test('posts a GM-only chat notice when immediate initial save applies Blowgun Poisoner', async () => {
    const token = { name: 'Test Token' };
    const actor = { name: 'Test Actor' };
    const affliction = { name: 'Test Poison', blowgunPoisonerCrit: true };

    await SocketService.postImmediateSaveModifierNotice(token, actor, affliction, {
      degree: DEGREE_OF_SUCCESS.SUCCESS,
      rawDegree: DEGREE_OF_SUCCESS.SUCCESS,
      incapacitationApplied: false,
    }, 'initial');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('PF2E_AFFLICTIONER.FEATS.BLOWGUN_POISONER_APPLIED'),
    }));
  });

  test('posts a GM-only chat notice when immediate stage save applies Fast Recovery', async () => {
    const token = { name: 'Test Token' };
    const actor = {
      name: 'Test Actor',
      items: [{ type: 'feat', system: { slug: 'fast-recovery' } }],
    };
    const affliction = { name: 'Test Disease', isVirulent: false };

    await SocketService.postImmediateSaveModifierNotice(token, actor, affliction, {
      degree: DEGREE_OF_SUCCESS.SUCCESS,
      rawDegree: DEGREE_OF_SUCCESS.SUCCESS,
      incapacitationApplied: false,
    }, 'stage');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('PF2E_AFFLICTIONER.FEATS.FAST_RECOVERY_STAGE_CHANGE'),
    }));
  });
});

describe('SocketService reroll confirmation flags', () => {
  beforeEach(() => {
    game.user = { isGM: true };
    global.Hooks = {
      once: jest.fn(),
    };
  });

  afterEach(() => {
    SocketService._lastRerollOldMessageId = null;
    SocketService._lastRerollConfirmationFlags = null;
    jest.restoreAllMocks();
  });

  test('copies save confirmation flags to the rerolled chat message as it is created', async () => {
    const oldMessage = {
      id: 'old-message-1',
      speaker: { actor: 'actor-1' },
      flags: {
        'pf2e-afflictioner': {
          needsConfirmation: true,
          tokenId: 'token-1',
          actorId: 'actor-1',
          afflictionId: 'affliction-1',
          saveType: 'stage',
          dc: 27,
        },
      },
    };
    const newMessage = {
      speaker: { actor: 'actor-1' },
      update: jest.fn(),
    };

    game.messages = {
      get: jest.fn(id => (id === oldMessage.id ? oldMessage : null)),
      contents: [oldMessage],
    };

    await SocketService.onPf2ePreReroll({ options: { messageId: oldMessage.id } });

    expect(Hooks.once).toHaveBeenCalledWith('createChatMessage', expect.any(Function));

    await Hooks.once.mock.calls[0][1](newMessage);

    expect(newMessage.update).toHaveBeenCalledWith({
      'flags.pf2e-afflictioner': expect.objectContaining({
        needsConfirmation: true,
        tokenId: 'token-1',
        actorId: 'actor-1',
        afflictionId: 'affliction-1',
        saveType: 'stage',
        dc: 27,
      }),
    });
  });
});
