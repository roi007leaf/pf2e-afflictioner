import { MODULE_ID } from '../constants.js';
import * as WeaponCoatingStore from '../stores/WeaponCoatingStore.js';

/**
 * When a coating effect is deleted (by PF2e duration expiry or manual deletion),
 * clean up the corresponding coating data without re-deleting the effect.
 */
export async function onDeleteItem(item, _options, _userId) {
  if (!game.user.isGM) return;
  if (item.type !== 'effect') return;
  if (!item.flags?.[MODULE_ID]?.isCoatingEffect) return;

  const actor = item.parent;
  if (!actor) return;

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
}
