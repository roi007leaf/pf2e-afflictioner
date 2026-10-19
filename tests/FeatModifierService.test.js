import { FeatModifierService } from '../scripts/services/FeatModifierService.js';

function actorWith(slugs = [], { classDC = 30, heritage = null, conditions = [] } = {}) {
  const items = slugs.map(slug => ({ type: 'feat', name: slug, system: { slug } }));
  if (heritage) items.push({ type: 'heritage', name: heritage, system: { slug: heritage } });
  return {
    name: 'Actor',
    items,
    classDC: classDC === null ? null : { dc: { value: classDC } },
    hasCondition: slug => conditions.includes(slug),
  };
}

function poison(extra = {}) {
  return {
    name: 'Giant Wasp Venom',
    type: 'poison',
    traits: ['alchemical', 'consumable', 'injury', 'poison'],
    dc: 22,
    level: 7,
    onset: null,
    maxDuration: { value: 6, unit: 'round', isDice: false },
    stages: [
      { number: 1, duration: { value: 1, unit: 'round', isDice: false }, damage: [{ formula: '6d6', type: 'poison' }], conditions: [] },
      { number: 2, duration: { value: 2, unit: 'hour', isDice: false }, damage: [{ formula: '7d6', type: 'poison' }], conditions: [] },
      { number: 3, duration: { formula: '1d4', value: null, unit: 'hour', isDice: true }, damage: [], conditions: [] },
    ],
    ...extra,
  };
}

const apply = (data, source, target) => FeatModifierService.applyExposureFeats(data, { sourceActor: source, targetActor: target });

describe('Potent Poisoner', () => {
  test('raises alchemical poison DC by 4', () => {
    expect(apply(poison(), actorWith(['potent-poisoner']), actorWith()).dc).toBe(26);
  });
  test('caps at class DC but never lowers', () => {
    expect(apply(poison({ dc: 28 }), actorWith(['potent-poisoner']), actorWith()).dc).toBe(30);
    expect(apply(poison({ dc: 31 }), actorWith(['potent-poisoner']), actorWith()).dc).toBe(31);
  });
  test('ignores non-alchemical poisons and actors without the feat', () => {
    expect(apply(poison({ traits: ['poison', 'injury'] }), actorWith(['potent-poisoner']), actorWith()).dc).toBe(22);
    expect(apply(poison(), actorWith(), actorWith()).dc).toBe(22);
  });
});

describe('Tenacious Toxins', () => {
  test('adds the stage 1 interval to the maximum duration', () => {
    expect(apply(poison(), actorWith(['tenacious-toxins']), actorWith()).maxDuration).toEqual({ value: 7, unit: 'round', isDice: false });
  });
  test('caps at twice the maximum duration', () => {
    const data = poison({ maxDuration: { value: 2, unit: 'round', isDice: false } });
    data.stages[0].duration = { value: 3, unit: 'round', isDice: false };
    expect(apply(data, actorWith(['tenacious-toxins']), actorWith()).maxDuration).toEqual({ value: 4, unit: 'round', isDice: false });
  });
  test('mixes units by converting to a common one', () => {
    const data = poison({ maxDuration: { value: 1, unit: 'hour', isDice: false } });
    data.stages[0].duration = { value: 10, unit: 'minute', isDice: false };
    expect(apply(data, actorWith(['tenacious-toxins']), actorWith()).maxDuration).toEqual({ value: 70, unit: 'minute', isDice: false });
  });
});

describe('Strike delivery feats', () => {
  test('Deadly Poison Weapon: +2 DC for injury poisons delivered by a Strike, capped at class DC', () => {
    expect(apply(poison({ deliveredByStrike: true }), actorWith(['deadly-poison-weapon']), actorWith()).dc).toBe(24);
    expect(apply(poison({ deliveredByStrike: true, dc: 29 }), actorWith(['deadly-poison-weapon']), actorWith()).dc).toBe(30);
    expect(apply(poison(), actorWith(['deadly-poison-weapon']), actorWith()).dc).toBe(22);
  });

  test('Pinpoint Poisoner: -2 circumstance on the initial save when the target is off-guard', () => {
    const result = apply(poison({ deliveredByStrike: true }), actorWith(['pinpoint-poisoner']), actorWith([], { conditions: ['off-guard'] }));
    expect(result.saveModifiers).toEqual([expect.objectContaining({ value: -2, type: 'circumstance' })]);
    expect(apply(poison({ deliveredByStrike: true }), actorWith(['pinpoint-poisoner']), actorWith()).saveModifiers ?? []).toEqual([]);
  });

  test('Greater Field Discovery: infused injury poison sprays on a failed initial save', () => {
    const data = poison({ deliveredByStrike: true, traits: ['alchemical', 'infused', 'injury', 'poison'] });
    expect(apply(data, actorWith(['greater-field-discovery-toxicologist']), actorWith()).sprayOnFailedInitialSave).toBe(true);
    expect(apply(data, actorWith(['chemical-contagion']), actorWith()).sprayOnFailedInitialSave).toBe(true);
    expect(apply(poison({ deliveredByStrike: true }), actorWith(['greater-field-discovery-toxicologist']), actorWith()).sprayOnFailedInitialSave).toBeFalsy();
  });
});

describe('Combustible Poison', () => {
  test('flags alchemical poisons from a creator with the feat', () => {
    expect(apply(poison(), actorWith(['combustible-poison']), actorWith()).combustiblePoison).toBe(true);
    expect(apply(poison({ traits: ['poison'] }), actorWith(['combustible-poison']), actorWith()).combustiblePoison).toBeFalsy();
  });
});

describe('Stronggut Shisk', () => {
  test('lengthens onset and stage durations by 50%, skipping 1 round and dice durations', () => {
    const data = poison({ onset: { value: 1, unit: 'minute', isDice: false } });
    const result = apply(data, null, actorWith([], { heritage: 'stronggut-shisk' }));
    expect(result.onset).toEqual({ value: 15, unit: 'round', isDice: false });
    expect(result.stages[0].duration).toEqual({ value: 1, unit: 'round', isDice: false });
    expect(result.stages[1].duration).toEqual({ value: 3, unit: 'hour', isDice: false });
    expect(result.stages[2].duration).toEqual(data.stages[2].duration);
  });

  test('converts fractional results to a smaller unit', () => {
    expect(FeatModifierService.scaleDuration({ value: 1, unit: 'hour', isDice: false }, 1.5)).toEqual({ value: 90, unit: 'minute', isDice: false });
    expect(FeatModifierService.scaleDuration({ value: 1, unit: 'day', isDice: false }, 1.5)).toEqual({ value: 36, unit: 'hour', isDice: false });
    expect(FeatModifierService.scaleDuration({ value: 3, unit: 'round', isDice: false }, 1.5)).toEqual({ value: 5, unit: 'round', isDice: false });
  });

  test('applies to diseases too but not curses', () => {
    const disease = poison({ type: 'disease', traits: ['disease'] });
    expect(apply(disease, null, actorWith([], { heritage: 'stronggut-shisk' })).stages[1].duration.value).toBe(3);
    const curse = poison({ type: 'curse', traits: ['curse'] });
    expect(apply(curse, null, actorWith([], { heritage: 'stronggut-shisk' })).stages[1].duration.value).toBe(2);
  });
});

describe('applyExposureFeats', () => {
  test('is idempotent and does not mutate its input', () => {
    const data = poison();
    const once = apply(data, actorWith(['potent-poisoner']), actorWith());
    const twice = apply(once, actorWith(['potent-poisoner']), actorWith());
    expect(twice.dc).toBe(26);
    expect(data.dc).toBe(22);
  });
});

describe('reduceDamageDice', () => {
  test.each([
    ['7d6', 3, '4d6'],
    ['2d6+3', 1, '1d6+3'],
    ['1d6', 1, null],
    ['5', 1, '5'],
  ])('%s minus %i dice -> %s', (formula, dice, expected) => {
    expect(FeatModifierService.reduceDamageDice(formula, dice)).toBe(expected);
  });
});

describe('special save options', () => {
  const poisonAff = poison({ currentStage: 2 });
  const diseaseAff = poison({ type: 'disease', traits: ['disease'], currentStage: 2 });
  const kinds = (patient, affliction, ctx = {}) => FeatModifierService.getSpecialSaveOptions(patient, affliction, ctx).map(o => o.kind);

  test('patient feats', () => {
    expect(kinds(actorWith(['coral-detoxification']), poisonAff)).toEqual(['coral-detoxification']);
    expect(kinds(actorWith(['coral-detoxification']), diseaseAff)).toEqual([]);
    expect(kinds(actorWith(['resilient-physiology']), diseaseAff)).toEqual(['resilient-physiology']);
    expect(kinds(actorWith(['purge-system']), poisonAff)).toEqual(['purge-system', 'purge-system-enhanced']);
  });

  test('Virulent Strike when someone has it', () => {
    expect(kinds(actorWith(), poisonAff, { virulentStrikeAvailable: true })).toEqual(['virulent-strike', 'virulent-strike-crit']);
    expect(kinds(actorWith(), poisonAff, { virulentStrikeAvailable: false })).toEqual([]);
  });

  test('none before the initial save', () => {
    expect(kinds(actorWith(['coral-detoxification']), { ...poisonAff, needsInitialSave: true })).toEqual([]);
  });
});
