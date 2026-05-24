import { onCombatPreUpdate, onPf2eStartTurn, onPf2eEndTurn } from '../scripts/hooks/combat.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import * as WeaponCoatingStore from '../scripts/stores/WeaponCoatingStore.js';

describe('combat hook scheduled saves', () => {
  beforeEach(() => {
    global.canvas = {
      tokens: {
        get: jest.fn(id => (id === 'token-1' ? { id: 'token-1' } : null)),
      },
    };
    game.user = { isGM: true };
    game.combat = {
      started: true,
      combatants: [{ tokenId: 'token-1' }],
      combatant: { id: 'combatant-1', tokenId: 'token-1', initiative: 20 },
    };
    jest.spyOn(WeaponCoatingStore, 'getCoatings').mockReturnValue({});
    jest.spyOn(AfflictionService, 'checkForScheduledSaves').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
    delete game.combat;
  });

  test('does not check scheduled saves at combatant start turn', async () => {
    const combatant = { actor: { id: 'actor-1' }, initiative: 20 };

    await onPf2eStartTurn(combatant);

    expect(AfflictionService.checkForScheduledSaves).not.toHaveBeenCalled();
  });

  test('checks scheduled saves before combat advances away from the ending combatant', async () => {
    const combatant = { id: 'combatant-1', actor: { id: 'actor-1' }, initiative: 20 };
    game.combat.combatant = combatant;

    await onCombatPreUpdate(game.combat, { turn: 1 });

    expect(AfflictionService.checkForScheduledSaves).toHaveBeenCalledWith(
      { id: 'token-1' },
      game.combat,
      combatant
    );
  });

  test('does not check scheduled saves from PF2e endTurn after combat has advanced', async () => {
    const combatant = { id: 'combatant-1', actor: { id: 'actor-1' }, initiative: 20 };

    await onPf2eEndTurn(combatant);

    expect(AfflictionService.checkForScheduledSaves).not.toHaveBeenCalled();
  });
});
