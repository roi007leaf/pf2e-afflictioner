import { WeaponCoatingService } from '../scripts/services/WeaponCoatingService.js';

function stage(number, duration, effects, extra = {}) {
  return {
    number,
    duration,
    effects,
    rawText: effects,
    damage: extra.damage || [],
    conditions: extra.conditions || [],
    weakness: extra.weakness || [],
    effectInterval: extra.effectInterval || null,
  };
}

function poison(overrides = {}) {
  return {
    name: 'Test Poison',
    type: 'poison',
    traits: ['consumable', 'injury', 'poison'],
    dc: 20,
    saveType: 'fortitude',
    isVirulent: false,
    stages: [
      stage(1, { value: 1, unit: 'round', isDice: false }, '1 poison damage'),
      stage(2, { value: 1, unit: 'minute', isDice: false }, '2 poison damage'),
    ],
    ...overrides,
  };
}

describe('WeaponCoatingService Double Poison support', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete global.fromUuid;
  });

  test('detects the Double Poison feat by slug', () => {
    const actor = {
      items: [
        { type: 'feat', system: { slug: 'double-poison' } },
      ],
    };

    expect(WeaponCoatingService._canUseDoublePoison(actor)).toBe(true);
  });

  test('merges two poisons into one double poison using lower DC, lower stage count, and both-virulent rule', () => {
    const first = poison({
      name: 'Aconite',
      dc: 24,
      isVirulent: true,
      stages: [
        stage(1, { value: 1, unit: 'round', isDice: false }, 'Aconite stage 1', {
          damage: [{ formula: '1d6', type: 'poison' }],
        }),
        stage(2, { value: 1, unit: 'minute', isDice: false }, 'Aconite stage 2'),
        stage(3, { value: 1, unit: 'hour', isDice: false }, 'Aconite stage 3'),
      ],
    });
    const second = poison({
      name: 'Belladonna',
      dc: 21,
      isVirulent: false,
      stages: [
        stage(1, { value: 2, unit: 'round', isDice: false }, 'Belladonna stage 1', {
          conditions: [{ name: 'sickened', value: 1 }],
        }),
        stage(2, { value: 10, unit: 'minute', isDice: false }, 'Belladonna stage 2'),
      ],
    });

    const merged = WeaponCoatingService._buildDoublePoisonAffliction(first, second, 'will');

    expect(merged.name).toBe('Double Poison: Aconite + Belladonna');
    expect(merged.dc).toBe(21);
    expect(merged.saveType).toBe('will');
    expect(merged.isVirulent).toBe(false);
    expect(merged.stages).toHaveLength(2);
    expect(merged.stages[0].duration).toEqual({ value: 2, unit: 'round', isDice: false });
    expect(merged.stages[1].duration).toEqual({ value: 10, unit: 'minute', isDice: false });
    expect(merged.stages[0].effects).toContain('Aconite stage 1');
    expect(merged.stages[0].effects).toContain('Belladonna stage 1');
    expect(merged.stages[0].damage).toEqual([{ formula: '1d6', type: 'poison' }]);
    expect(merged.stages[0].conditions).toEqual([{ name: 'sickened', value: 1 }]);
  });

  test('keeps virulent only when both poisons are virulent', () => {
    const first = poison({ isVirulent: true });
    const second = poison({ isVirulent: true });

    const merged = WeaponCoatingService._buildDoublePoisonAffliction(first, second, 'fortitude');

    expect(merged.isVirulent).toBe(true);
  });

  test('uses the longer effect interval when both stages have one', () => {
    const first = poison({
      stages: [
        stage(1, { value: 1, unit: 'round', isDice: false }, 'First', {
          effectInterval: { value: 1, unit: 'minute', isDice: false },
        }),
      ],
    });
    const second = poison({
      stages: [
        stage(1, { value: 1, unit: 'round', isDice: false }, 'Second', {
          effectInterval: { value: 1, unit: 'hour', isDice: false },
        }),
      ],
    });

    const merged = WeaponCoatingService._buildDoublePoisonAffliction(first, second, 'fortitude');

    expect(merged.stages[0].effectInterval).toEqual({ value: 1, unit: 'hour', isDice: false });
  });

  test('prompts for save type only when the two poisons use different saves', async () => {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async () => 'reflex'),
          },
        },
      },
    };

    const choice = await WeaponCoatingService._chooseDoublePoisonSaveType(
      poison({ name: 'Fort Poison', saveType: 'fortitude' }),
      poison({ name: 'Reflex Poison', saveType: 'reflex' })
    );

    expect(choice).toBe('reflex');
    expect(global.foundry.applications.api.DialogV2.wait).toHaveBeenCalledWith(expect.objectContaining({
      buttons: expect.arrayContaining([
        expect.objectContaining({ action: 'fortitude' }),
        expect.objectContaining({ action: 'reflex' }),
      ]),
    }));

    delete global.foundry;
  });

  test('does not prompt when both poisons use the same save type', async () => {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(),
          },
        },
      },
    };

    const choice = await WeaponCoatingService._chooseDoublePoisonSaveType(
      poison({ saveType: 'will' }),
      poison({ saveType: 'will' })
    );

    expect(choice).toBe('will');
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test('applying a second poison with Double Poison stores the merged coating instead of replacing outright', async () => {
    const flags = {
      weaponCoatings: {
        'weapon-1': {
          poisonItemUuid: 'Item.first',
          poisonName: 'Aconite',
          weaponName: 'Dagger',
          afflictionData: poison({ name: 'Aconite', dc: 24, saveType: 'fortitude' }),
          expirationMode: 'unlimited',
        },
      },
    };
    const actor = {
      id: 'actor-1',
      name: 'Alchemist',
      items: [{ type: 'feat', system: { slug: 'double-poison' } }],
      getFlag: jest.fn((_moduleId, key) => flags[key] || {}),
      setFlag: jest.fn(async (_moduleId, key, value) => {
        flags[key] = value;
      }),
      unsetFlag: jest.fn(async (_moduleId, key) => {
        const [, weaponId] = key.split('.');
        delete flags.weaponCoatings[weaponId];
      }),
      createEmbeddedDocuments: jest.fn(async () => [{ uuid: 'Actor.actor-1.Item.effect' }]),
    };

    game.actors = { get: jest.fn(() => actor) };
    game.combat = null;
    game.time = { worldTime: 1234 };
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async () => 'will'),
          },
        },
      },
    };

    const applied = await WeaponCoatingService._applyCoatingToActor('actor-1', 'weapon-1', {
      poisonItemUuid: 'Item.second',
      poisonName: 'Belladonna',
      weaponName: 'Dagger',
      afflictionData: poison({ name: 'Belladonna', dc: 21, saveType: 'will' }),
      expirationMode: 'unlimited',
      poisonImg: 'poison.webp',
    });

    expect(applied).toBe(true);
    expect(flags.weaponCoatings['weapon-1'].poisonItemUuid).toBeNull();
    expect(flags.weaponCoatings['weapon-1'].poisonName).toBe('Double Poison: Aconite + Belladonna');
    expect(flags.weaponCoatings['weapon-1'].afflictionData.dc).toBe(21);
    expect(flags.weaponCoatings['weapon-1'].afflictionData.saveType).toBe('will');
    expect(flags.weaponCoatings['weapon-1'].afflictionData.doublePoison).toBe(true);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
  });

  test('does not offer Double Poison when the existing coating is already a double poison', () => {
    const actor = {
      items: [{ type: 'feat', system: { slug: 'double-poison' } }],
    };
    const existingCoating = {
      afflictionData: poison({
        name: 'Double Poison: Aconite + Belladonna',
        doublePoison: true,
      }),
    };

    expect(WeaponCoatingService._shouldOfferDoublePoison(actor, existingCoating, poison())).toBe(false);
    expect(WeaponCoatingService._canAddSecondPoison(actor, existingCoating)).toBe(false);
  });
});
