import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';

function buildToken(immunities = []) {
  const flags = {};
  const actor = {
    id: 'actor-1',
    name: 'Test Actor',
    hasPlayerOwner: false,
    system: {
      attributes: { immunities },
    },
    getFlag: jest.fn((moduleId, key) => flags[`${moduleId}.${key}`] ?? {}),
    setFlag: jest.fn(async (moduleId, key, value) => {
      flags[`${moduleId}.${key}`] = value;
    }),
  };

  return {
    id: 'token-1',
    name: 'Test Token',
    actor,
    document: {
      actorLink: true,
    },
  };
}

function buildAffliction(type, traits = [type]) {
  return {
    name: `${type} affliction`,
    type,
    traits,
    dc: 18,
    saveType: 'fortitude',
    stages: [
      {
        number: 1,
        duration: { value: 1, unit: 'round', isDice: false },
        damage: [],
        conditions: [],
        weakness: [],
      },
    ],
  };
}

function buildSourceActor(rule) {
  return {
    id: 'source-actor',
    uuid: 'Actor.source',
    name: 'Source Actor',
    getFlag: jest.fn((moduleId, key) => {
      if (moduleId === 'pf2e-afflictioner' && key === 'immunityBypassRule') return rule;
      return null;
    }),
  };
}

describe('AfflictionService immunity handling', () => {
  let promptInitialSaveSpy;

  beforeEach(() => {
    global.foundry = { utils: { randomID: jest.fn(() => 'affliction-id') } };
    global.Hooks = { on: jest.fn() };
    global.fromUuid = jest.fn();
    game.combat = null;
    game.users = [{ id: 'gm-1', isGM: true }];
    game.i18n.format = jest.fn((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.IMMUNITY_NOTICE') {
        return `${data.tokenName} is immune to ${data.afflictionName} (${data.type}).`;
      }
      if (key === 'PF2E_AFFLICTIONER.CHAT.IMMUNITY_BYPASS_NOTICE') {
        return `${data.sourceName}'s override bypassed ${data.tokenName}'s ${data.type} immunity to ${data.afflictionName}.`;
      }
      return key;
    });
    game.settings.get = jest.fn((_moduleId, key) => {
      if (key === 'showVisualIndicators') return false;
      return {};
    });
    ui.notifications.info = jest.fn();
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Test Token' }));
    promptInitialSaveSpy = jest
      .spyOn(AfflictionChatService, 'promptInitialSave')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete global.Hooks;
    delete global.fromUuid;
  });

  test('skips poison affliction when actor has poison immunity', async () => {
    const token = buildToken([{ type: 'poison' }]);

    await AfflictionService.promptInitialSave(token, buildAffliction('poison'));

    expect(token.actor.setFlag).not.toHaveBeenCalled();
    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
    expect(ui.notifications.info).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('poison affliction'),
    }));
  });

  test('skips disease affliction when actor has disease immunity', async () => {
    const token = buildToken([{ type: 'disease' }]);

    await AfflictionService.promptInitialSave(token, buildAffliction('disease'));

    expect(token.actor.setFlag).not.toHaveBeenCalled();
    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
    expect(ui.notifications.info).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('disease affliction'),
    }));
  });

  test('does not skip disease when actor only has poison immunity', async () => {
    const token = buildToken([{ type: 'poison' }]);

    await AfflictionService.promptInitialSave(token, buildAffliction('disease'));

    expect(token.actor.setFlag).toHaveBeenCalled();
    expect(promptInitialSaveSpy).toHaveBeenCalled();
  });

  test('skips curse affliction when actor has curse immunity', async () => {
    const token = buildToken([{ type: 'curse' }]);

    await AfflictionService.promptInitialSave(token, buildAffliction('curse'));

    expect(token.actor.setFlag).not.toHaveBeenCalled();
    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('curse affliction'),
    }));
  });

  test('skips affliction when actor has immunity to any affliction trait', async () => {
    const token = buildToken([{ type: 'bomb' }]);

    await AfflictionService.promptInitialSave(
      token,
      buildAffliction('poison', ['uncommon', 'alchemical', 'bomb', 'consumable', 'disease', 'poison', 'splash'])
    );

    expect(token.actor.setFlag).not.toHaveBeenCalled();
    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('poison affliction'),
    }));
  });

  test('GM chat lists every matching immunity trait', async () => {
    const token = buildToken([{ type: 'disease' }, { type: 'poison' }]);

    await AfflictionService.promptInitialSave(
      token,
      buildAffliction('poison', ['uncommon', 'alchemical', 'bomb', 'consumable', 'disease', 'poison', 'splash'])
    );

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('(disease, poison)'),
    }));
  });

  test('source actor rule bypasses configured poison immunity for matching poison affliction', async () => {
    const token = buildToken([{ type: 'poison' }]);
    const sourceActor = buildSourceActor({
      enabled: true,
      traits: ['poison'],
      afflictionKeys: [],
    });
    global.fromUuid.mockResolvedValue(sourceActor);

    await AfflictionService.promptInitialSave(token, {
      ...buildAffliction('poison'),
      originActorUuid: sourceActor.uuid,
    });

    expect(token.actor.setFlag).toHaveBeenCalled();
    expect(promptInitialSaveSpy).toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining("bypassed Test Token's poison immunity"),
    }));
  });

  test('source actor poison bypass does not bypass unrelated disease immunity', async () => {
    const token = buildToken([{ type: 'disease' }]);
    const sourceActor = buildSourceActor({
      enabled: true,
      traits: ['poison'],
      afflictionKeys: [],
    });
    global.fromUuid.mockResolvedValue(sourceActor);

    await AfflictionService.promptInitialSave(token, {
      ...buildAffliction('disease'),
      originActorUuid: sourceActor.uuid,
    });

    expect(token.actor.setFlag).not.toHaveBeenCalled();
    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining('(disease)'),
    }));
  });

  test('source actor rule bypasses immunity when a named affliction matches without a trait match', async () => {
    const token = buildToken([{ type: 'disease' }]);
    const affliction = {
      ...buildAffliction('disease', ['rare']),
      name: 'Named Plague',
      sourceItemUuid: 'Compendium.pf2e.afflictions.Item.named-plague',
      originActorUuid: 'Actor.source',
    };
    const sourceActor = buildSourceActor({
      enabled: true,
      traits: ['disease'],
      afflictionKeys: [{
        key: 'Compendium.pf2e.afflictions.Item.named-plague',
        name: 'Named Plague',
        uuid: 'Compendium.pf2e.afflictions.Item.named-plague',
      }],
    });
    global.fromUuid.mockResolvedValue(sourceActor);

    await AfflictionService.promptInitialSave(token, affliction);

    expect(token.actor.setFlag).toHaveBeenCalled();
    expect(promptInitialSaveSpy).toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      whisper: ['gm-1'],
      content: expect.stringContaining("bypassed Test Token's disease immunity"),
    }));
  });
});
