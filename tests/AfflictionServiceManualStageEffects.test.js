import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionEffectBuilder } from '../scripts/services/AfflictionEffectBuilder.js';

describe('AfflictionService manual stage effects', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('still applies automatic stage effects when stage also needs manual handling', async () => {
    const actor = { id: 'actor-1', name: 'Target' };
    const token = { id: 'token-1', name: 'Target Token', actor };
    const affliction = {
      id: 'affliction-1',
      name: 'Rustcreep',
      currentStage: 4,
      stages: [],
    };
    const stage = {
      number: 4,
      requiresManualHandling: true,
      conditions: [
        { name: 'enfeebled', value: 1 },
        { name: 'stupefied', value: 1 },
      ],
      damage: [],
      weakness: [],
    };

    game.i18n.format = jest.fn(key => key);
    ui.notifications.warn = jest.fn();

    const createOrUpdateSpy = jest
      .spyOn(AfflictionEffectBuilder, 'createOrUpdateEffect')
      .mockResolvedValue('Actor.actor-1.Item.effect-1');
    jest.spyOn(AfflictionEffectBuilder, 'removePersistentDamage').mockResolvedValue(undefined);
    jest.spyOn(AfflictionEffectBuilder, 'applyPersistentConditions').mockResolvedValue(undefined);
    jest.spyOn(AfflictionEffectBuilder, 'applyPersistentDamage').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'processReferencedAfflictions').mockResolvedValue(undefined);

    await AfflictionService.applyStageEffects(token, affliction, stage);

    expect(ui.notifications.warn).toHaveBeenCalledWith('PF2E_AFFLICTIONER.NOTIFICATIONS.MANUAL_EFFECTS');
    expect(createOrUpdateSpy).toHaveBeenCalledWith(token, actor, affliction, stage);
    expect(AfflictionEffectBuilder.applyPersistentConditions).toHaveBeenCalledWith(actor, affliction, stage);
  });
});
