import { CounteractService } from '../scripts/services/CounteractService.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { RecoveryRestrictionService } from '../scripts/services/RecoveryRestrictionService.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';
import { DEGREE_OF_SUCCESS } from '../scripts/constants.js';

function bogRot() {
  return {
    id: 'bog-rot-id',
    name: 'Bog Rot',
    currentStage: 1,
    stages: [{ number: 1, duration: { value: 1, unit: 'day' }, damage: [] }],
    recoveryRestriction: {
      minimumStage: 1,
      unhealableDamage: true,
      requiresCounteract: true,
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete game.combat;
  delete game.time;
});

describe('CounteractService recovery restrictions', () => {
  test('stage saves cannot remove an active restricted affliction', async () => {
    game.combat = null;
    game.time = { worldTime: 100 };
    const actor = { name: 'Target' };
    const token = { name: 'Target', actor };
    const affliction = bogRot();
    const updateSpy = jest.spyOn(AfflictionStore, 'updateAffliction').mockResolvedValue(undefined);
    const removeSpy = jest.spyOn(AfflictionStore, 'removeAffliction').mockResolvedValue(undefined);
    jest.spyOn(AfflictionStore, 'getAffliction').mockReturnValue(affliction);
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue(undefined);

    await AfflictionService._applyStageChange(token, affliction, 0, { actor });

    expect(updateSpy).toHaveBeenCalledWith(token, affliction.id, expect.objectContaining({ currentStage: 1 }));
    expect(removeSpy).not.toHaveBeenCalled();
  });

  test('successful remove curse unlocks recovery without curing disease', async () => {
    const actor = { name: 'Target' };
    const token = { name: 'Target', actor };
    const affliction = bogRot();
    const updateSpy = jest.spyOn(AfflictionStore, 'updateAffliction').mockResolvedValue(undefined);
    const removeSpy = jest.spyOn(AfflictionStore, 'removeAffliction').mockResolvedValue(undefined);
    const releaseSpy = jest.spyOn(RecoveryRestrictionService, 'releaseAll').mockResolvedValue(true);

    await expect(CounteractService.handleCounteractResult(
      token,
      affliction,
      3,
      3,
      DEGREE_OF_SUCCESS.SUCCESS,
    )).resolves.toBe(true);

    expect(updateSpy).toHaveBeenCalledWith(token, affliction.id, { recoveryRestrictionResolved: true });
    expect(releaseSpy).toHaveBeenCalledWith(actor, affliction);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  test('cleanse stage reduction respects active stage floor', async () => {
    game.combat = null;
    game.time = { worldTime: 100 };
    const actor = { name: 'Target' };
    const token = { name: 'Target', actor };
    const affliction = bogRot();
    const updateSpy = jest.spyOn(AfflictionStore, 'updateAffliction').mockResolvedValue(undefined);
    jest.spyOn(AfflictionStore, 'getAffliction').mockReturnValue(affliction);
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue(undefined);

    await CounteractService.reduceAfflictionStage(token, affliction);

    expect(updateSpy).toHaveBeenCalledWith(token, affliction.id, expect.objectContaining({ currentStage: 1 }));
  });
});
