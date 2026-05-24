import { AfflictionService } from '../services/AfflictionService.js';
import * as WeaponCoatingStore from '../stores/WeaponCoatingStore.js';

export async function onCombatPreUpdate(combat, changed, _options, _userId) {
  if (!game.user.isGM) return;
  if (!('turn' in changed) && !('round' in changed)) return;
  if (!combat.started || !combat.combatant) return;

  await checkScheduledSavesForCombatant(combat, combat.combatant);
}

export async function onCombatUpdate(combat, changed, options, userId) {
  if (!game.user.isGM) return;
  if (!changed.turn && !changed.round) return;

  if (changed.round) {
    for (const combatant of combat.combatants) {
      const token = canvas.tokens.get(combatant.tokenId);
      if (!token) continue;

      await AfflictionService.updateOnsetTimers(token, combat);
      await AfflictionService.checkDurations(token, combat);
      await AfflictionService.checkEffectIntervals(token, combat);
    }
  }
}

export async function onPf2eStartTurn(combatant, _encounter, _userId) {
  if (!game.user.isGM) return;

  // Check coating expiration for "start-next-turn" mode
  await checkCoatingExpiration(combatant, 'start-next-turn');
}

export async function onPf2eEndTurn(combatant, _encounter, _userId) {
  if (!game.user.isGM) return;

  // Check coating expiration for "end-next-turn" mode
  await checkCoatingExpiration(combatant, 'end-next-turn');
}

export async function onDeleteCombat(_combat, _options, _userId) {
  if (!game.user.isGM) return;

  // When combat ends, expire all turn-based coatings
  const allCoatings = WeaponCoatingStore.getAllCoatingsOnCanvas();
  for (const coating of allCoatings) {
    if (coating.expirationMode !== 'start-next-turn' && coating.expirationMode !== 'end-next-turn') continue;

    const actor = coating.actor || game.actors.get(coating.actorId);
    if (!actor) continue;

    await WeaponCoatingStore.removeCoating(actor, coating.weaponId);
    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.EXPIRED', {
      poisonName: coating.poisonName,
      weaponName: coating.weaponName
    }));
  }
}

async function checkCoatingExpiration(combatant, triggerMode) {
  const combat = game.combat;
  if (!combat) return;

  const actor = combatant.actor;
  if (!actor) return;

  const coatings = WeaponCoatingStore.getCoatings(actor);
  for (const [weaponId, coating] of Object.entries(coatings)) {
    if (coating.expirationMode !== triggerMode) continue;

    // Only expire if at least one full turn has passed since application
    if (coating.appliedRound != null && coating.appliedRound >= combat.round) continue;

    await WeaponCoatingStore.removeCoating(actor, weaponId);
    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.EXPIRED', {
      poisonName: coating.poisonName,
      weaponName: coating.weaponName
    }));
  }
}

async function checkScheduledSavesForCombatant(combat, combatant) {
  for (const c of combat.combatants) {
    const token = canvas.tokens.get(c.tokenId);
    if (!token) continue;

    await AfflictionService.checkForScheduledSaves(token, combat, combatant);
  }
}
