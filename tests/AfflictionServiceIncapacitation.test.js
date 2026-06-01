import { DEGREE_OF_SUCCESS } from '../scripts/constants.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';

function buildToken(level = 6) {
  const actor = {
    id: 'actor-1',
    name: 'Test Actor',
    type: 'character',
    system: {
      details: {
        level: { value: level },
      },
    },
    itemTypes: { effect: [] },
    getFlag: jest.fn(() => ({
      'affliction-1': buildIncapacitationDisease(),
    })),
  };

  return {
    id: 'token-1',
    name: 'Test Token',
    actor,
    document: {
      actorLink: true,
      texture: {},
      unsetFlag: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildIncapacitationDisease(overrides = {}) {
  return {
    id: 'affliction-1',
    name: 'Test Disease',
    type: 'disease',
    level: 5,
    traits: ['disease', 'incapacitation'],
    currentStage: 1,
    needsInitialSave: false,
    isVirulent: false,
    stages: [
      {
        number: 1,
        duration: { value: 1, unit: 'round', isDice: false },
        damage: [],
        conditions: [],
        weakness: [],
      },
      {
        number: 2,
        duration: { value: 1, unit: 'round', isDice: false },
        damage: [],
        conditions: [],
        weakness: [],
      },
    ],
    ...overrides,
  };
}

describe('AfflictionService incapacitation handling', () => {
  beforeEach(() => {
    global.Hooks = { on: jest.fn() };
    game.combat = null;
    game.time = { worldTime: 0 };
    game.settings.get = jest.fn((_moduleId, key) => {
      if (key === 'useApplicationInitiative') return false;
      return null;
    });
    game.i18n.format = jest.fn((key) => key);
    game.i18n.localize = jest.fn((key) => key);
    ui.notifications.info = jest.fn();
    ui.notifications.warn = jest.fn();
    ui.notifications.error = jest.fn();

    jest.spyOn(AfflictionStore, 'removeAffliction').mockResolvedValue(undefined);
    jest.spyOn(AfflictionStore, 'updateAffliction').mockResolvedValue(undefined);
    jest.spyOn(AfflictionStore, 'getAfflictions').mockReturnValue({ other: {} });
    jest.spyOn(AfflictionChatService, 'postStageChange').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.Hooks;
  });

  test('upgrades initial save result for higher-level target against incapacitation disease', async () => {
    const token = buildToken(6);
    const affliction = buildIncapacitationDisease({
      currentStage: -1,
      needsInitialSave: true,
    });

    await AfflictionService.handleInitialSave(token, affliction, 19, 20, null);

    expect(AfflictionStore.removeAffliction).toHaveBeenCalledWith(token, affliction.id);
    expect(AfflictionStore.updateAffliction).not.toHaveBeenCalled();
    expect(ui.notifications.info).toHaveBeenCalledWith('PF2E_AFFLICTIONER.NOTIFICATIONS.RESISTED');
  });

  test('upgrades stage save result for higher-level target against incapacitation disease', async () => {
    const token = buildToken(6);
    const affliction = buildIncapacitationDisease();

    await AfflictionService.handleStageSave(token, affliction, 19, 20, false, null);

    expect(AfflictionStore.removeAffliction).toHaveBeenCalledWith(token, affliction.id);
    expect(AfflictionStore.updateAffliction).not.toHaveBeenCalled();
    expect(ui.notifications.info).toHaveBeenCalledWith('PF2E_AFFLICTIONER.NOTIFICATIONS.RECOVERED');
  });

  test('does not upgrade when target level is not higher than incapacitation affliction level', () => {
    const token = buildToken(5);
    const affliction = buildIncapacitationDisease();

    expect(AfflictionService.calculateAfflictionDegreeOfSuccess(19, 20, null, token.actor, affliction))
      .toBe(DEGREE_OF_SUCCESS.FAILURE);
  });

  test('does not upgrade when a higher-level creature generated the incapacitation affliction', () => {
    const token = buildToken(10);
    const affliction = buildIncapacitationDisease({
      originActorLevel: 12,
      originActorType: 'npc',
    });

    expect(AfflictionService.calculateAfflictionDegreeOfSuccess(19, 20, null, token.actor, affliction))
      .toBe(DEGREE_OF_SUCCESS.FAILURE);
  });

  test('uses spell rank instead of NPC caster level for spell incapacitation threshold', () => {
    const token = buildToken(9);
    const affliction = buildIncapacitationDisease({
      originActorLevel: 12,
      originActorType: 'npc',
      incapacitationSpellRank: 4,
    });

    expect(AfflictionService.calculateAfflictionDegreeOfSuccess(19, 20, null, token.actor, affliction))
      .toBe(DEGREE_OF_SUCCESS.SUCCESS);
  });

  test('reports when incapacitation upgrades the save result', () => {
    const token = buildToken(6);
    const affliction = buildIncapacitationDisease();

    expect(AfflictionService.calculateAfflictionDegreeResult(19, 20, null, token.actor, affliction))
      .toEqual({
        degree: DEGREE_OF_SUCCESS.SUCCESS,
        rawDegree: DEGREE_OF_SUCCESS.FAILURE,
        incapacitationApplied: true,
      });
  });
});
