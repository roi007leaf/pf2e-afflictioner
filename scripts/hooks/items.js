import { MODULE_ID } from '../constants.js';
import * as WeaponCoatingStore from '../stores/WeaponCoatingStore.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AddictionService } from '../services/AddictionService.js';

function getPotentialStorageTargets(actor) {
  const targets = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor === actor || (actor.uuid && token.actor?.uuid === actor.uuid) || token.actor?.id === actor.id) {
      targets.push(token);
    }
  }
  targets.push(actor);
  return targets;
}

/**
 * When a coating effect is deleted (by PF2e duration expiry or manual deletion),
 * clean up the corresponding coating data without re-deleting the effect.
 */
export async function onDeleteItem(item, _options, _userId) {
  if (!game.user.isGM) return;
  if (item.type !== 'effect') return;
  const afflictionId = item.flags?.[MODULE_ID]?.afflictionId;
  if (afflictionId && item.parent && (!game.users?.activeGM || game.users.activeGM.id === game.user.id)) {
    const actor = item.parent;
    const token = actor.token ? actor.token.object || { actor, document: actor.token } : AfflictionStore.findTokenForActor(actor);
    const affliction = AddictionService.get(token, actor, afflictionId);
    if (affliction?.isAddiction) {
      // Symptoms cannot be removed independently of the addiction. Disease removal
      // clears storage first, so intentional recovery/removal will not recreate it.
      await AddictionService.syncEffect(token, actor, affliction);
      return;
    }
  }
  const isCoatingEffect = item.flags?.[MODULE_ID]?.isCoatingEffect;
  const isInjectionEffect = item.flags?.[MODULE_ID]?.isInjectionEffect;
  if (!isCoatingEffect && !isInjectionEffect) return;

  const actor = item.parent;
  if (!actor) return;

  if (isCoatingEffect) {
    for (const target of getPotentialStorageTargets(actor)) {
      const coatings = WeaponCoatingStore.getCoatings(target);
      for (const [weaponId, coating] of Object.entries(coatings)) {
        if (coating.coatingEffectUuid === item.uuid) {
          if (WeaponCoatingStore.isCoatingEffectDeletionSuppressed(item.uuid)) return;

          // Remove coating data directly without calling removeCoating
          // (which would try to delete the already-deleted effect)
          await WeaponCoatingStore.removeCoatingFlag(target, weaponId);

          ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.EXPIRED', {
            poisonName: coating.poisonName,
            weaponName: coating.weaponName
          }));
          return;
        }
      }
    }
    return;
  }

  for (const target of getPotentialStorageTargets(actor)) {
    const injections = WeaponCoatingStore.getInjections(target);
    for (const [weaponId, injection] of Object.entries(injections)) {
      if (injection.injectionEffectUuid === item.uuid) {
        if (WeaponCoatingStore.isCoatingEffectDeletionSuppressed(item.uuid)) return;

        await WeaponCoatingStore.removeInjectionFlag(target, weaponId);

        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.INJECTION_REMOVED', {
          poisonName: injection.poisonName,
          weaponName: injection.weaponName
        }));
        return;
      }
    }
  }
}
