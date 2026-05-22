import { MODULE_ID } from '../constants.js';
import * as WeaponCoatingStore from '../stores/WeaponCoatingStore.js';

/**
 * When a coating effect is deleted (by PF2e duration expiry or manual deletion),
 * clean up the corresponding coating data without re-deleting the effect.
 */
export async function onDeleteItem(item, _options, _userId) {
  if (!game.user.isGM) return;
  if (item.type !== 'effect') return;
  const isCoatingEffect = item.flags?.[MODULE_ID]?.isCoatingEffect;
  const isInjectionEffect = item.flags?.[MODULE_ID]?.isInjectionEffect;
  if (!isCoatingEffect && !isInjectionEffect) return;

  const actor = item.parent;
  if (!actor) return;

  if (isCoatingEffect) {
    const coatings = WeaponCoatingStore.getCoatings(actor);
    for (const [weaponId, coating] of Object.entries(coatings)) {
      if (coating.coatingEffectUuid === item.uuid) {
        if (WeaponCoatingStore.isCoatingEffectDeletionSuppressed(item.uuid)) return;

        // Remove coating data directly without calling removeCoating
        // (which would try to delete the already-deleted effect)
        await actor.unsetFlag(MODULE_ID, `weaponCoatings.${weaponId}`);

        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.EXPIRED', {
          poisonName: coating.poisonName,
          weaponName: coating.weaponName
        }));
        break;
      }
    }
    return;
  }

  const injections = WeaponCoatingStore.getInjections(actor);
  for (const [weaponId, injection] of Object.entries(injections)) {
    if (injection.injectionEffectUuid === item.uuid) {
      if (WeaponCoatingStore.isCoatingEffectDeletionSuppressed(item.uuid)) return;

      await actor.unsetFlag(MODULE_ID, `weaponInjections.${weaponId}`);

      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.INJECTION_REMOVED', {
        poisonName: injection.poisonName,
        weaponName: injection.weaponName
      }));
      break;
    }
  }
}
