import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionEffectBuilder } from '../scripts/services/AfflictionEffectBuilder.js';
import { VisionerIntegrationService } from '../scripts/services/VisionerIntegrationService.js';

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
    jest.spyOn(VisionerIntegrationService, 'applyStageVisibility').mockResolvedValue(undefined);

    await AfflictionService.applyStageEffects(token, affliction, stage);

    expect(ui.notifications.warn).toHaveBeenCalledWith('PF2E_AFFLICTIONER.NOTIFICATIONS.MANUAL_EFFECTS');
    expect(createOrUpdateSpy).toHaveBeenCalledWith(token, actor, affliction, stage);
    expect(AfflictionEffectBuilder.applyPersistentConditions).toHaveBeenCalledWith(actor, affliction, stage);
    expect(VisionerIntegrationService.applyStageVisibility).toHaveBeenCalledWith(token, affliction, stage);
  });

  test('restores Visioner visibility while removing stage effects', async () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    const affliction = { id: 'affliction-1' };
    const removeVisibilitySpy = jest
      .spyOn(VisionerIntegrationService, 'removeStageVisibility')
      .mockResolvedValue(undefined);

    await AfflictionService.removeStageEffects(token, affliction, null, {});

    expect(removeVisibilitySpy).toHaveBeenCalledWith(token, affliction);
  });

  test('normalizes legacy relative visibility before building stage effects', async () => {
    const actor = { id: 'actor-1', name: 'Ed' };
    const token = { id: 'token-1', name: 'Ed', actor };
    const affliction = { id: 'affliction-1', name: 'Darkening Poison', currentStage: 2 };
    const stage = {
      number: 2,
      effects: '1d6 poison and creatures you can see only with darkvision are Concealed from you',
      conditions: [{ name: 'concealed', value: null }],
      damage: [{ formula: '1d6', type: 'poison' }],
      weakness: [],
    };

    const createOrUpdateSpy = jest
      .spyOn(AfflictionEffectBuilder, 'createOrUpdateEffect')
      .mockResolvedValue(null);
    jest.spyOn(AfflictionEffectBuilder, 'applyPersistentConditions').mockResolvedValue(undefined);
    jest.spyOn(AfflictionEffectBuilder, 'applyPersistentDamage').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'processReferencedAfflictions').mockResolvedValue(undefined);
    const applyVisibilitySpy = jest
      .spyOn(VisionerIntegrationService, 'applyStageVisibility')
      .mockResolvedValue(undefined);

    await AfflictionService.applyStageEffects(token, affliction, stage);

    const normalizedStage = expect.objectContaining({
      conditions: [],
      visibilityEffects: [{ state: 'concealed', sense: 'darkvision', only: true }],
    });
    expect(createOrUpdateSpy).toHaveBeenCalledWith(token, actor, affliction, normalizedStage);
    expect(applyVisibilitySpy).toHaveBeenCalledWith(token, affliction, normalizedStage);
  });
});
