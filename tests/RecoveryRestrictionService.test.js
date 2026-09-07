import { RecoveryRestrictionService } from '../scripts/services/RecoveryRestrictionService.js';

const MODULE_ID = 'pf2e-afflictioner';

function activeAffliction(overrides = {}) {
  return {
    id: 'bog-rot-id',
    name: 'Bog Rot',
    recoveryRestriction: {
      minimumStage: 1,
      unhealableDamage: true,
      requiresCounteract: true,
    },
    ...overrides,
  };
}

function makeEffect(overrides = {}) {
  const effect = {
    name: 'Bog Rot',
    system: { rules: [{ key: 'FlatModifier', selector: 'fortitude', value: -1 }] },
    flags: {
      [MODULE_ID]: {
        afflictionId: 'bog-rot-id',
        tracksUnhealableDamage: true,
        unhealableDamage: 0,
        unhealableDamageApplications: {},
      },
    },
    ...overrides,
  };
  effect.update = jest.fn(async changes => {
    if (changes['system.rules']) effect.system.rules = changes['system.rules'];
    const moduleFlags = effect.flags[MODULE_ID];
    if (`flags.${MODULE_ID}.tracksUnhealableDamage` in changes) {
      moduleFlags.tracksUnhealableDamage = changes[`flags.${MODULE_ID}.tracksUnhealableDamage`];
    }
    if (`flags.${MODULE_ID}.unhealableDamage` in changes) {
      moduleFlags.unhealableDamage = changes[`flags.${MODULE_ID}.unhealableDamage`];
    }
    if (`flags.${MODULE_ID}.unhealableDamageApplications` in changes) {
      moduleFlags.unhealableDamageApplications = changes[`flags.${MODULE_ID}.unhealableDamageApplications`];
    }
  });
  return effect;
}

function appliedDamageMessage(effect, overrides = {}) {
  const actor = { itemTypes: { effect: [effect] } };
  global.fromUuid = jest.fn().mockResolvedValue(actor);
  return {
    id: 'damage-message-id',
    flags: {
      pf2e: {
        context: { options: [`${MODULE_ID}:unhealable-damage:bog-rot-id`] },
        appliedDamage: {
          uuid: 'Actor.target-id',
          updates: [
            { path: 'system.attributes.hp.temp', value: 2 },
            { path: 'system.attributes.hp.value', value: 7 },
          ],
          ...overrides,
        },
      },
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fromUuid;
});

describe('RecoveryRestrictionService', () => {
  test('builds tagged PF2e damage links only while restriction is active', () => {
    const affliction = activeAffliction();
    expect(RecoveryRestrictionService.buildDamageLink('3d6', 'void', affliction)).toBe(
      '@Damage[3d6[void]|immutable|options:pf2e-afflictioner:unhealable-damage:bog-rot-id]',
    );

    affliction.recoveryRestrictionResolved = true;
    expect(RecoveryRestrictionService.buildDamageLink('3d6', 'void', affliction)).toBe('@Damage[3d6[void]|immutable]');
  });

  test('tags raw damage enrichers without losing nested formulas or existing options', () => {
    const text = '@Damage[(max(4,(@item.rank)-1))d6[void]|immutable|options:foo] and @Damage[2d6[void]]';

    expect(RecoveryRestrictionService.tagDamageLinks(text, activeAffliction())).toBe(
      '@Damage[(max(4,(@item.rank)-1))d6[void]|immutable|options:foo,pf2e-afflictioner:unhealable-damage:bog-rot-id] and @Damage[2d6[void]|options:pf2e-afflictioner:unhealable-damage:bog-rot-id|immutable]',
    );
  });

  test('enforces stage floor only before special treatment succeeds', () => {
    const affliction = activeAffliction();
    expect(RecoveryRestrictionService.getMinimumStage(affliction)).toBe(1);
    affliction.recoveryRestrictionResolved = true;
    expect(RecoveryRestrictionService.getMinimumStage(affliction)).toBe(0);
  });

  test('records exact applied HP loss as native unrecoverable HP', async () => {
    const effect = makeEffect();
    const message = appliedDamageMessage(effect);

    await expect(RecoveryRestrictionService.recordAppliedDamage(message)).resolves.toBe(true);
    expect(effect.flags[MODULE_ID].unhealableDamage).toBe(7);
    expect(effect.flags[MODULE_ID].unhealableDamageApplications).toEqual({ 'damage-message-id': 7 });
    expect(effect.system.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'LoseHitPoints', value: 7, recoverable: false }),
    ]));

    await expect(RecoveryRestrictionService.recordAppliedDamage(message)).resolves.toBe(false);
    expect(effect.update).toHaveBeenCalledTimes(1);
  });

  test('annotates healing results with affliction damage that remains unrecoverable', async () => {
    const effect = makeEffect();
    effect.flags[MODULE_ID].unhealableDamage = 7;
    const actor = { itemTypes: { effect: [effect] } };
    global.fromUuid = jest.fn().mockResolvedValue(actor);
    jest.spyOn(game.i18n, 'format').mockImplementation((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.CHAT.UNHEALABLE_DAMAGE_ENTRY') {
        return `${data.afflictionName}: ${data.amount} HP`;
      }
      if (key === 'PF2E_AFFLICTIONER.CHAT.UNHEALABLE_DAMAGE_REMAINS') {
        return `Healing cannot restore affliction damage: ${data.summary}.`;
      }
      return key;
    });
    const message = {
      id: 'healing-message-id',
      content: '<div>Test Actor is healed for 20 damage.</div>',
      flags: {
        pf2e: {
          appliedDamage: {
            uuid: 'Actor.target-id',
            isHealing: true,
            updates: [{ path: 'system.attributes.hp.value', value: -20 }],
          },
        },
      },
      update: jest.fn(),
    };

    await expect(RecoveryRestrictionService.annotateHealingMessage(message)).resolves.toBe(true);
    expect(message.update).toHaveBeenCalledWith({
      content: expect.stringContaining('Healing cannot restore affliction damage: Bog Rot: 7 HP.'),
      [`flags.${MODULE_ID}.unhealableHealingNotice`]: true,
    });
  });

  test('does not annotate ordinary damage or healing without tracked debt', async () => {
    const effect = makeEffect();
    const message = appliedDamageMessage(effect, { isHealing: true });
    message.content = '<div>Healing result</div>';
    message.update = jest.fn();

    await expect(RecoveryRestrictionService.annotateHealingMessage(message)).resolves.toBe(false);
    expect(message.update).not.toHaveBeenCalled();

    message.flags.pf2e.appliedDamage.isHealing = false;
    effect.flags[MODULE_ID].unhealableDamage = 7;
    await expect(RecoveryRestrictionService.annotateHealingMessage(message)).resolves.toBe(false);
    expect(message.update).not.toHaveBeenCalled();
  });

  test('releasing reverted damage preserves unrelated effect rules', async () => {
    const effect = makeEffect();
    const message = appliedDamageMessage(effect);
    await RecoveryRestrictionService.recordAppliedDamage(message);
    message.flags.pf2e.appliedDamage.isReverted = true;

    await expect(RecoveryRestrictionService.releaseRevertedDamage(message)).resolves.toBe(true);
    expect(effect.flags[MODULE_ID].unhealableDamage).toBe(0);
    expect(effect.system.rules).toEqual([{ key: 'FlatModifier', selector: 'fortitude', value: -1 }]);
  });

  test('successful special treatment releases all tracked debt', async () => {
    const effect = makeEffect();
    const message = appliedDamageMessage(effect);
    await RecoveryRestrictionService.recordAppliedDamage(message);
    const actor = await fromUuid('Actor.target-id');

    await expect(RecoveryRestrictionService.releaseAll(actor, activeAffliction())).resolves.toBe(true);
    expect(effect.flags[MODULE_ID]).toMatchObject({
      tracksUnhealableDamage: false,
      unhealableDamage: 0,
      unhealableDamageApplications: {},
    });
    expect(effect.system.rules.some(rule => rule.key === 'LoseHitPoints')).toBe(false);
  });
});
