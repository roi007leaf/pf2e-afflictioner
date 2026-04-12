import * as AfflictionStore from '../stores/AfflictionStore.js';
import { MODULE_ID } from '../constants.js';

export function onRenderTokenHUD(app, html) {
  const token = app.object;
  const allowPlayer = game.settings.get(MODULE_ID, 'allowPlayerWeaponCoatingAccess');
  const canUse = game.user.isGM || (allowPlayer && token?.actor?.isOwner);
  if (!canUse) return;
  if (game.settings.get(MODULE_ID, 'useTokenToolsButton')) return;
  if (!token) return;

  const root = html?.jquery ? html[0] : html;
  if (!root) return;

  let column = root.querySelector('div.col.right');
  if (!column && html?.find) {
    column = html.find('div.col.right')[0];
  }
  if (!column) {
    console.warn('PF2e Afflictioner: Could not find right column in token HUD');
    return;
  }

  const existing = column.querySelector('[data-action="pf2e-afflictioner-manage"]');
  if (existing) existing.remove();

  const afflictions = AfflictionStore.getAfflictions(token);
  const hasAfflictions = Object.keys(afflictions).length > 0;

  const buttonElement = document.createElement('div');
  buttonElement.className = hasAfflictions ? 'control-icon active' : 'control-icon';
  buttonElement.style.display = 'flex';
  buttonElement.setAttribute('data-action', 'pf2e-afflictioner-manage');
  buttonElement.setAttribute('data-tooltip', game.i18n.localize(
    game.user.isGM
      ? 'PF2E_AFFLICTIONER.MANAGER.MANAGE_AFFLICTIONS_TOOLTIP'
      : 'PF2E_AFFLICTIONER.MANAGER.MANAGE_WEAPON_COATINGS_TOOLTIP'
  ));
  buttonElement.innerHTML = '<i class="fas fa-biohazard"></i>';

  buttonElement.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const { AfflictionManager } = await import('../managers/AfflictionManager.js');

      if (AfflictionManager.currentInstance) {
        AfflictionManager.currentInstance.close();
      }

      new AfflictionManager({ filterTokenId: token.id }).render(true);
    } catch (error) {
      console.error('PF2e Afflictioner: Error opening manager:', error);
    }
  });

  column.insertBefore(buttonElement, column.firstChild);
}
