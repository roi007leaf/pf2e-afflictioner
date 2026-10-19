jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: {},
}));

import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';
import { VishkanyaService } from '../scripts/services/VishkanyaService.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';

function actorWith(slugs = [], extra = {}) {
  return {
    id: 'actor-1',
    name: 'Actor',
    items: slugs.map(slug => ({ type: 'feat', name: slug, system: { slug } })),
    system: { attributes: { immunities: [] } },
    classDC: { dc: { value: 30 } },
    getFlag: jest.fn(() => ({})),
    setFlag: jest.fn(async () => {}),
    ...extra,
  };
}

function poison(extra = {}) {
  return {
    id: 'aff-1',
    name: 'Giant Wasp Venom',
    type: 'poison',
    traits: ['alchemical', 'injury', 'poison'],
    dc: 22,
    level: 7,
    saveType: 'fortitude',
    stages: [
      { number: 1, duration: { value: 1, unit: 'round', isDice: false }, damage: [{ formula: '6d6', type: 'poison' }], conditions: [] },
      { number: 2, duration: { value: 1, unit: 'round', isDice: false }, damage: [{ formula: '7d6', type: 'poison' }], conditions: [] },
      { number: 3, duration: { value: 1, unit: 'round', isDice: false }, damage: [{ formula: '8d6', type: 'poison' }], conditions: [] },
    ],
    ...extra,
  };
}

beforeEach(() => {
  global.foundry = { utils: { randomID: jest.fn(() => 'new-id') } };
  global.fromUuid = jest.fn();
  game.combat = null;
  game.users = [{ id: 'gm-1', isGM: true }];
  game.user = { isGM: true };
  game.settings.get = jest.fn(() => false);
  game.time = { worldTime: 0 };
  ChatMessage.create = jest.fn();
  ChatMessage.getSpeaker = jest.fn(() => ({}));
  ui.notifications.info = jest.fn();
  ui.notifications.warn = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.foundry;
  delete global.fromUuid;
});

describe('exposure applies source and target feats', () => {
  test('Potent Poisoner raises the stored DC', async () => {
    const prompt = jest.spyOn(AfflictionChatService, 'promptInitialSave').mockResolvedValue(undefined);
    const source = actorWith(['potent-poisoner'], { id: 'source', uuid: 'Actor.source' });
    global.fromUuid.mockResolvedValue(source);
    const target = actorWith();

    await AfflictionService.promptInitialSave(null, poison({ originActorUuid: 'Actor.source' }), target);

    expect(prompt.mock.calls[0][1].dc).toBe(26);
  });
});

describe('initial save outcomes', () => {
  beforeEach(() => {
    jest.spyOn(AfflictionStore, 'updateAfflictionForActor').mockResolvedValue(undefined);
    jest.spyOn(AfflictionStore, 'removeAfflictionForActor').mockResolvedValue(undefined);
  });

  test('failed save clears one-shot save modifiers and posts spray + combustible notes', async () => {
    const actor = actorWith();
    const affliction = poison({
      needsInitialSave: true,
      saveModifiers: [{ label: 'Pinpoint Poisoner', value: -2, type: 'circumstance' }],
      sprayOnFailedInitialSave: true,
      combustiblePoison: true,
    });

    await AfflictionService.handleInitialSave(null, affliction, 15, 22, 10, actor);

    expect(AfflictionStore.updateAfflictionForActor).toHaveBeenCalledWith(actor, 'aff-1', expect.objectContaining({ saveModifiers: [] }));
    const contents = ChatMessage.create.mock.calls.map(c => c[0].content).join('\n');
    expect(contents).toContain('affliction-spray-exposure');
    expect(contents).toContain('1d4[persistent,fire]');
  });

  test('successful save posts no spray note', async () => {
    const affliction = poison({ needsInitialSave: true, sprayOnFailedInitialSave: true });
    await AfflictionService.handleInitialSave(null, affliction, 25, 22, 10, actorWith());
    const contents = ChatMessage.create.mock.calls.map(c => c[0].content).join('\n');
    expect(contents).not.toContain('affliction-spray-exposure');
  });

  test('Poison Drinker heals on a critical Fortitude success against poison', async () => {
    const affliction = poison({ needsInitialSave: true });
    await AfflictionService.handleInitialSave(null, affliction, 35, 22, 15, actorWith(['poison-drinker']));
    const contents = ChatMessage.create.mock.calls.map(c => c[0].content).join('\n');
    expect(contents).toContain('7[healing]');
  });
});

describe('stage save rules', () => {
  test('Virulent Strike: a success does not reduce the stage', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const affliction = poison({ currentStage: 2, pendingSaveRule: { label: 'Virulent Strike', noDecrease: true } });

    await AfflictionService.handleStageSave(null, affliction, 25, 22, false, 12, actorWith());

    expect(apply).toHaveBeenCalledWith(null, affliction, 2, expect.anything());
  });

  test('Resilient Physiology: a failure does not increase the stage', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const affliction = poison({ currentStage: 2, pendingSaveRule: { label: 'Resilient Physiology', noIncrease: true } });

    await AfflictionService.handleStageSave(null, affliction, 15, 22, false, 8, actorWith());

    expect(apply).toHaveBeenCalledWith(null, affliction, 2, expect.anything());
  });
});

describe('special saves', () => {
  test('Coral Detoxification stores a +2 modifier and prompts a stage save', async () => {
    const update = jest.spyOn(AfflictionStore, 'updateAfflictionForActor').mockResolvedValue(undefined);
    const prompt = jest.spyOn(AfflictionChatService, 'promptStageSave').mockResolvedValue(undefined);
    const actor = actorWith(['coral-detoxification']);

    await AfflictionService.startSpecialSave(null, poison({ currentStage: 2 }), 'coral-detoxification', actor);

    expect(update).toHaveBeenCalledWith(actor, 'aff-1', expect.objectContaining({
      saveModifiers: [expect.objectContaining({ value: 2 })],
      pendingSaveRule: null,
    }));
    expect(prompt).toHaveBeenCalledWith(null, expect.objectContaining({ saveModifiers: [expect.objectContaining({ value: 2 })] }), actor);
  });

  test('Purge System reduces the stage directly', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const affliction = poison({ currentStage: 2 });

    await AfflictionService.startSpecialSave(null, affliction, 'purge-system-enhanced', actorWith());

    expect(apply).toHaveBeenCalledWith(null, affliction, 0, expect.anything());
  });
});

describe('Stronger Debilitating Venom', () => {
  const venom = () => poison({
    stages: [
      { number: 1, damage: [{ formula: '3d6', type: 'poison' }], conditions: [] },
      { number: 2, damage: [{ formula: '4d6', type: 'poison' }], conditions: [] },
      { number: 3, damage: [{ formula: '5d6', type: 'poison' }], conditions: [] },
    ],
  });

  test('Devitalizing: -3 dice, drained 1/2 at stages 2/3', () => {
    const result = VishkanyaService.applyDebilitation(venom(), 'devitalizing');
    expect(result.stages.map(s => s.damage.map(d => d.formula))).toEqual([[], ['1d6'], ['2d6']]);
    expect(result.stages[1].conditions).toEqual([{ name: 'drained', value: 1 }]);
    expect(result.stages[2].conditions).toEqual([{ name: 'drained', value: 2 }]);
  });

  test('Weakening: -1 die, enfeebled 1/1/2', () => {
    const result = VishkanyaService.applyDebilitation(venom(), 'weakening');
    expect(result.stages.map(s => s.damage[0].formula)).toEqual(['2d6', '3d6', '4d6']);
    expect(result.stages.map(s => s.conditions[0])).toEqual([
      { name: 'enfeebled', value: 1 }, { name: 'enfeebled', value: 1 }, { name: 'enfeebled', value: 2 },
    ]);
  });

  test('Bungling and Nauseating', () => {
    const bungling = VishkanyaService.applyDebilitation(venom(), 'bungling');
    expect(bungling.stages[0].conditions).toEqual([]);
    expect(bungling.stages[2].conditions).toEqual([{ name: 'clumsy', value: 2 }]);
    const nauseating = VishkanyaService.applyDebilitation(venom(), 'nauseating');
    expect(nauseating.stages[1].damage[0].formula).toBe('2d6');
    expect(nauseating.stages[1].conditions).toEqual([{ name: 'sickened', value: 1 }]);
  });
});
