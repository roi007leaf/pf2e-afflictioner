import { DEFAULT_SETTINGS } from '../scripts/constants.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import * as Store from '../scripts/stores/AfflictionStore.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';
import { AfflictionEffectBuilder } from '../scripts/services/AfflictionEffectBuilder.js';
import { onPreUpdateItem } from '../scripts/hooks/conditions.js';

describe('poison success house rule', () => {
  let value;
  let actor;
  let token;
  beforeEach(() => {
    global.Hooks = { on: jest.fn() };
    game.combat = null;
    game.time = { worldTime: 100 };
    game.settings.get = jest.fn((_module, key) => key === 'poisonSuccessStageOne');
    actor = { name: 'Actor', type: 'character', system: { details: { level: { value: 1 } } } };
    token = { name: 'Token', actor };
    value = {
      id: 'poison', name: 'Poison', type: 'poison', currentStage: -1, needsInitialSave: true,
      stages: [1, 2, 3].map(number => ({ number, duration: { value: 1, unit: 'round' }, damage: [], conditions: [] }))
    };
    jest.spyOn(Store, 'updateAffliction').mockImplementation(async (_token, _id, updates) => Object.assign(value, updates));
    jest.spyOn(Store, 'updateAfflictionForActor').mockImplementation(async (_actor, _id, updates) => Object.assign(value, updates));
    jest.spyOn(Store, 'getAffliction').mockImplementation(() => value);
    jest.spyOn(Store, 'getAfflictionForActor').mockImplementation(() => value);
    jest.spyOn(Store, 'getAfflictions').mockReturnValue({ other: {} });
    jest.spyOn(Store, 'removeAffliction').mockResolvedValue();
    jest.spyOn(Store, 'removeAfflictionForActor').mockResolvedValue();
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue();
    jest.spyOn(AfflictionChatService, 'postStageChange').mockResolvedValue();
    jest.spyOn(AfflictionChatService, 'postPoisonReExposure').mockResolvedValue();
    jest.spyOn(AfflictionEffectBuilder, 'createOrUpdateEffect').mockResolvedValue();
  });
  afterEach(() => { jest.restoreAllMocks(); delete global.Hooks; });

  test('setting is optional and GM controlled', () => {
    expect(DEFAULT_SETTINGS.poisonSuccessStageOne).toMatchObject({ default: false, scope: 'world', restricted: true, config: true });
  });

  test('success applies stage one with persistent cap and normal timer', async () => {
    await AfflictionService.handleInitialSave(token, value, 20, 20);
    expect(value).toMatchObject({ currentStage: 1, successStageLimit: 1, needsInitialSave: false, nextSaveTimestamp: 106 });
    expect(AfflictionService.applyStageEffects).toHaveBeenCalledWith(token, value, value.stages[0]);
    expect(Store.removeAffliction).not.toHaveBeenCalled();
  });

  test.each([['critical success', 'poison', 30, true], ['disease', 'disease', 20, true], ['curse', 'curse', 20, true], ['disabled setting', 'poison', 20, false]])('%s resists normally', async (_name, type, total, enabled) => {
    value.type = type;
    game.settings.get.mockReturnValue(enabled);
    await AfflictionService.handleInitialSave(token, value, total, 20);
    expect(Store.removeAffliction).toHaveBeenCalledWith(token, value.id);
    expect(Store.updateAffliction).not.toHaveBeenCalled();
  });

  test.each([[19, 1], [9, 2]])('failure total %s starts uncapped stage %s', async (total, stage) => {
    await AfflictionService.handleInitialSave(token, value, total, 20);
    expect(value).toMatchObject({ currentStage: stage, successStageLimit: null });
  });

  test('success honors onset before stage one', async () => {
    value.onset = { value: 1, unit: 'minute' };
    await AfflictionService.handleInitialSave(token, value, 20, 20);
    expect(value).toMatchObject({ currentStage: 0, inOnset: true, stageAdvancement: 1, successStageLimit: 1, nextSaveTimestamp: 160 });
    expect(AfflictionService.applyStageEffects).not.toHaveBeenCalled();
  });

  test.each([19, 9])('later failed save %s stays at stage one and renews timer', async total => {
    Object.assign(value, { currentStage: 1, needsInitialSave: false, successStageLimit: 1 });
    await AfflictionService.handleStageSave(token, value, total, 20);
    expect(value).toMatchObject({ currentStage: 1, successStageLimit: 1, nextSaveTimestamp: 106 });
  });

  test('successful recovery removes capped poison', async () => {
    Object.assign(value, { currentStage: 1, successStageLimit: 1 });
    await AfflictionService.handleStageSave(null, value, 20, 20, false, null, actor);
    expect(Store.removeAfflictionForActor).toHaveBeenCalledWith(actor, value.id);
  });

  test('actor without token receives capped poison', async () => {
    await AfflictionService.handleInitialSave(null, value, 20, 20, null, actor);
    expect(Store.updateAfflictionForActor).toHaveBeenCalledWith(actor, value.id, expect.objectContaining({ currentStage: 1, successStageLimit: 1 }));
  });

  test.each([true, false])('failed re-exposure lifts cap (token: %s)', async hasToken => {
    Object.assign(value, { currentStage: 1, successStageLimit: 1 });
    const exposure = { ...value, id: 'exposure', _isReExposure: true, _existingAfflictionId: value.id };
    await AfflictionService.handleInitialSave(hasToken ? token : null, exposure, 19, 20, null, actor);
    expect(value).toMatchObject({ currentStage: 2, successStageLimit: null });
    expect(hasToken ? Store.removeAffliction : Store.removeAfflictionForActor).toHaveBeenCalledWith(hasToken ? token : actor, exposure.id);
  });

  test('successful re-exposure preserves existing cap', async () => {
    Object.assign(value, { currentStage: 1, successStageLimit: 1 });
    const exposure = { ...value, id: 'exposure', _isReExposure: true, _existingAfflictionId: value.id };
    await AfflictionService.handleInitialSave(token, exposure, 20, 20);
    expect(value).toMatchObject({ currentStage: 1, successStageLimit: 1 });
    expect(Store.removeAffliction).toHaveBeenCalledWith(token, exposure.id);
    expect(Store.updateAffliction).not.toHaveBeenCalled();
  });

  test('GM effect badge cannot advance past cap', async () => {
    jest.useFakeTimers();
    const originalUsers = game.users;
    const originalCanvas = global.canvas;
    try {
      Object.assign(value, { currentStage: 1, successStageLimit: 1, needsInitialSave: false });
      game.users = { get: () => ({ isGM: true }) };
      global.canvas = { tokens: { get: () => token } };
      const item = {
        type: 'effect', parent: { token: { id: 'token' } },
        getFlag: (_module, key) => key === 'isAfflictionEffect' ? true : value.id
      };
      expect(await onPreUpdateItem(item, { system: { badge: { value: 3 } } }, {}, 'gm')).toBe(false);
      await jest.runAllTimersAsync();
      expect(value.currentStage).toBe(1);
      expect(AfflictionService.applyStageEffects).toHaveBeenCalledWith(token, value, value.stages[0]);
    } finally {
      game.users = originalUsers;
      global.canvas = originalCanvas;
      jest.useRealTimers();
    }
  });
});
