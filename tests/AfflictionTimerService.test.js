import { AfflictionTimerService } from '../scripts/services/AfflictionTimerService.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';

describe('AfflictionTimerService scheduled saves', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not prompt again after a scheduled save is cleared', async () => {
    const token = { id: 'token-1', name: 'Target' };
    const afflictions = {
      affliction1: {
        id: 'affliction1',
        name: 'Centipede Venom',
        currentStage: 3,
        inOnset: false,
        nextSaveRound: 5,
        nextSaveInitiative: 20,
        stages: [{ number: 1 }, { number: 2 }, { number: 3 }],
      },
    };
    const combat = {
      round: 5,
      combatant: { initiative: 20 },
    };
    const service = {
      promptSave: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(AfflictionStore, 'getAfflictions').mockReturnValue(afflictions);
    jest.spyOn(AfflictionStore, 'updateAffliction').mockImplementation(async (_token, id, updates) => {
      Object.assign(afflictions[id], updates);
    });

    await AfflictionTimerService.checkForScheduledSaves(token, combat, service);
    await AfflictionTimerService.checkForScheduledSaves(token, combat, service);

    expect(service.promptSave).toHaveBeenCalledTimes(1);
  });
});
