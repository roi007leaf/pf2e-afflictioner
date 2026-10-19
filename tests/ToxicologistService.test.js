import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';
import { RecoveryRestrictionService } from '../scripts/services/RecoveryRestrictionService.js';
import { ToxicologistService } from '../scripts/services/ToxicologistService.js';

function buildToken(immunities = []) {
  const actor = {
    id: 'actor-1',
    name: 'Golem',
    hasPlayerOwner: false,
    system: { attributes: { immunities } },
    getFlag: jest.fn(() => ({})),
    setFlag: jest.fn(async () => {}),
  };
  return { id: 'token-1', name: 'Golem', actor, document: { actorLink: true } };
}

function buildSourceActor(featSlugs = ['toxicologist']) {
  return {
    id: 'alchemist',
    uuid: 'Actor.alchemist',
    name: 'Alchemist',
    items: featSlugs.map(slug => ({ type: 'feat', system: { slug } })),
    getFlag: jest.fn(() => null),
  };
}

function buildPoison(traits = ['alchemical', 'consumable', 'infused', 'injury', 'poison']) {
  return {
    name: 'Giant Scorpion Venom',
    type: 'poison',
    traits,
    dc: 22,
    saveType: 'fortitude',
    originActorUuid: 'Actor.alchemist',
    stages: [{
      number: 1,
      duration: { value: 1, unit: 'round', isDice: false },
      damage: [{ formula: '1d10', type: 'poison' }],
      conditions: [],
      weakness: [],
    }],
  };
}

describe('Toxicologist infused poisons', () => {
  let promptInitialSaveSpy;

  beforeEach(() => {
    global.foundry = { utils: { randomID: jest.fn(() => 'affliction-id') } };
    global.Hooks = { on: jest.fn() };
    global.fromUuid = jest.fn();
    game.combat = null;
    game.users = [{ id: 'gm-1', isGM: true }];
    game.settings.get = jest.fn((_moduleId, key) => (key === 'showVisualIndicators' ? false : {}));
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ alias: 'Golem' }));
    promptInitialSaveSpy = jest.spyOn(AfflictionChatService, 'promptInitialSave').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete global.Hooks;
    delete global.fromUuid;
  });

  test('infused poison from toxicologist bypasses poison immunity and deals acid', async () => {
    const token = buildToken([{ type: 'poison' }]);
    global.fromUuid.mockResolvedValue(buildSourceActor());

    await AfflictionService.promptInitialSave(token, buildPoison());

    expect(promptInitialSaveSpy).toHaveBeenCalled();
    const affliction = promptInitialSaveSpy.mock.calls[0][1];
    expect(affliction.toxicologistDamage).toBe('acid');
  });

  test('non-infused poison from toxicologist still respects poison immunity', async () => {
    const token = buildToken([{ type: 'poison' }]);
    global.fromUuid.mockResolvedValue(buildSourceActor());

    await AfflictionService.promptInitialSave(token, buildPoison(['alchemical', 'consumable', 'injury', 'poison']));

    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
  });

  test('infused poison from non-toxicologist still respects poison immunity', async () => {
    const token = buildToken([{ type: 'poison' }]);
    global.fromUuid.mockResolvedValue(buildSourceActor([]));

    await AfflictionService.promptInitialSave(token, buildPoison());

    expect(promptInitialSaveSpy).not.toHaveBeenCalled();
  });

  test('toxicologist poison on non-immune target offers poison or acid', async () => {
    const token = buildToken([]);
    global.fromUuid.mockResolvedValue(buildSourceActor());

    await AfflictionService.promptInitialSave(token, buildPoison());

    const affliction = promptInitialSaveSpy.mock.calls[0][1];
    expect(affliction.toxicologistDamage).toBe('choice');
  });

  test('damage links swap poison to acid or offer both', () => {
    expect(RecoveryRestrictionService.buildDamageLink('1d10', 'poison', { toxicologistDamage: 'acid' }))
      .toBe('@Damage[1d10[acid]|immutable]');
    expect(RecoveryRestrictionService.buildDamageLink('1d10', 'fire', { toxicologistDamage: 'acid' }))
      .toBe('@Damage[1d10[fire]|immutable]');

    const choice = RecoveryRestrictionService.buildDamageLink('1d10', 'poison', { toxicologistDamage: 'choice' });
    expect(choice).toContain('@Damage[1d10[poison]|immutable]');
    expect(choice).toContain('@Damage[1d10[acid]|immutable]');
  });

  test('resolveDamageType only swaps poison in acid mode', () => {
    expect(ToxicologistService.resolveDamageType('poison', { toxicologistDamage: 'acid' })).toBe('acid');
    expect(ToxicologistService.resolveDamageType('poison', { toxicologistDamage: 'choice' })).toBe('poison');
    expect(ToxicologistService.resolveDamageType('poison', {})).toBe('poison');
  });
});
