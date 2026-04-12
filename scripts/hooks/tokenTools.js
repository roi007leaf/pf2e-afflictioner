import { MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';


export function onGetSceneControlButtons(controls) {
  const allowPlayer = game.settings.get(MODULE_ID, 'allowPlayerWeaponCoatingAccess');
  if (!game.user.isGM && !allowPlayer) return;
  if (!game.settings.get(MODULE_ID, 'useTokenToolsButton')) return;

  const groups = Array.isArray(controls) ? controls : Object.values(controls || {});
  const tokens = groups.find((c) => c?.name === 'tokens' || c?.name === 'token');
  if (!tokens?.tools) return;

  const tool = {
    name: 'pf2e-afflictioner-manage',
    title: game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.MANAGE_AFFLICTIONS_TOOLTIP'),
    icon: 'fas fa-biohazard',
    button: true,
    onChange: async () => {
      try {
        const controlled = canvas?.tokens?.controlled ?? [];
        if (!controlled.length) return;
        const { AfflictionManager } = await import('../managers/AfflictionManager.js');
        if (AfflictionManager.currentInstance) {
          AfflictionManager.currentInstance.close();
        }
        new AfflictionManager({ filterTokenId: controlled[0].id }).render(true);
      } catch (error) {
        console.error('PF2e Afflictioner: Error opening manager from token tools:', error);
      }
    }
  };

  if (Array.isArray(tokens.tools)) tokens.tools.push(tool);
  else if (typeof tokens.tools === 'object') tokens.tools[tool.name] = tool;
}

export function onRenderSceneControls() {
  const allowPlayer = game.settings.get(MODULE_ID, 'allowPlayerWeaponCoatingAccess');
  if (!game.user?.isGM && !allowPlayer) return;
  if (!game.settings.get(MODULE_ID, 'useTokenToolsButton')) return;

  const toolEl = document.querySelector('[data-tool="pf2e-afflictioner-manage"]');
  if (!toolEl) return;

  const selected = canvas?.tokens?.controlled ?? [];
  if (!selected.length) {
    toolEl.style.display = 'none';
    return;
  }

  if (!game.user.isGM && !selected[0]?.actor?.isOwner) {
    toolEl.style.display = 'none';
    return;
  }

  toolEl.style.display = '';
  const afflictions = AfflictionStore.getAfflictions(selected[0]);
  const hasAfflictions = Object.keys(afflictions).length > 0;
  toolEl.classList.toggle('active', hasAfflictions);
}

export function onUpdateToken(tokenDocument, changes) {
  if (!game.settings.get(MODULE_ID, 'useTokenToolsButton')) return;
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) return;

  const controlled = canvas?.tokens?.controlled ?? [];
  if (!controlled.some(t => t.document.id === tokenDocument.id)) return;

  ui.controls?.render();
}

export function onControlToken() {
  if (!game.settings.get(MODULE_ID, 'useTokenToolsButton')) return;
  ui.controls?.render();
}
