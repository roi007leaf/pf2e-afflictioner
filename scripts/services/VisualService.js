import { MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';

function getItemActor(item) {
  return item?.actor ?? (typeof item?.parent?.getActiveTokens === 'function' ? item.parent : null);
}

function getActiveTokensForActor(actor) {
  if (!actor) return [];
  if (typeof actor.getActiveTokens === 'function') return actor.getActiveTokens(true, false) ?? [];

  const placeables = canvas?.tokens?.placeables ?? [];
  return placeables.filter(token => token.actor?.id === actor.id);
}

function canModifyToken(token) {
  const doc = token?.document;
  if (!doc) return false;

  return (
    game.user.isGM ||
    doc.canUserModify?.(game.user, 'update') ||
    doc.isOwner === true
  );
}

function hasChangedProperty(changes, path) {
  if (!changes || !path) return false;

  if (globalThis.foundry?.utils?.hasProperty?.(changes, path)) return true;
  if (Object.prototype.hasOwnProperty.call(changes, path)) return true;
  if (Object.keys(changes).some(key => key.startsWith(`${path}.`))) return true;

  return path.split('.').reduce((current, part) => current?.[part], changes) !== undefined;
}

function actorChangeCanAffectAfflictions(changes) {
  return (
    hasChangedProperty(changes, 'system') ||
    hasChangedProperty(changes, `flags.${MODULE_ID}.afflictions`)
  );
}

function refreshActorTokens(actor) {
  for (const token of getActiveTokensForActor(actor)) {
    VisualService.refreshTokenIndicator(token);
  }
}

export class VisualService {
  static async addAfflictionIndicator(token) {
    if (!game.settings.get(MODULE_ID, 'showVisualIndicators')) return;

    this.refreshTokenIndicator(token);
  }

  static async removeAfflictionIndicator(token) {
    const afflictions = AfflictionStore.getAfflictions(token);

    if (Object.keys(afflictions).length === 0) {
      this.refreshTokenIndicator(token);
    }
  }

  static refreshTokenIndicator(token) {
    if (!game.settings.get(MODULE_ID, 'showVisualIndicators')) {
      this.removeIndicatorElement(token);
      return;
    }

    const afflictions = AfflictionStore.getAfflictions(token);
    const hasAfflictions = Object.keys(afflictions).length > 0;

    if (hasAfflictions) {
      this.addIndicatorElement(token);
    } else {
      this.removeIndicatorElement(token);
    }
  }

  static async addIndicatorElement(token) {
    if (!canModifyToken(token)) return;

    await token.document.setFlag(MODULE_ID, 'hasAffliction', true);

    if (!token.document.texture.tint) {
      await token.document.update({ 'texture.tint': '#ff000020' });
    }
  }

  static async removeIndicatorElement(token) {
    if (!canModifyToken(token)) return;

    await token.document.unsetFlag(MODULE_ID, 'hasAffliction');

    if (token.document.texture.tint === '#ff000020') {
      await token.document.update({ 'texture.tint': null });
    }
  }

  static refreshAllIndicators() {
    if (!canvas.tokens) return;

    for (const token of canvas.tokens.placeables) {
      this.refreshTokenIndicator(token);
    }
  }
}

Hooks.on('createItem', (item) => refreshActorTokens(getItemActor(item)));
Hooks.on('updateItem', (item) => refreshActorTokens(getItemActor(item)));
Hooks.on('deleteItem', (item) => refreshActorTokens(getItemActor(item)));

Hooks.on('updateActor', (actor, changes) => {
  if (actorChangeCanAffectAfflictions(changes)) refreshActorTokens(actor);
});

Hooks.on('controlToken', (token, controlled) => {
  if (controlled) VisualService.refreshTokenIndicator(token);
});

Hooks.on('canvasReady', () => {
  VisualService.refreshAllIndicators();
});
