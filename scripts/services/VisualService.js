import { MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';

const AFFLICTION_TINT = '#ffdfdf';

function getStoredTint(token) {
  return token?.document?._source?.texture?.tint ?? token?.document?.texture?.tint;
}

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

    await this.refreshTokenIndicator(token);
  }

  static async removeAfflictionIndicator(token) {
    const afflictions = AfflictionStore.getAfflictions(token);

    if (Object.keys(afflictions).length === 0) {
      await this.refreshTokenIndicator(token);
    }
  }

  static async refreshTokenIndicator(token) {
    if (!game.settings.get(MODULE_ID, 'showVisualIndicators')) {
      await this.removeIndicatorElement(token);
      return;
    }

    const afflictions = AfflictionStore.getAfflictions(token);
    const hasAfflictions = Object.keys(afflictions).length > 0;

    if (hasAfflictions) {
      await this.addIndicatorElement(token);
    } else {
      await this.removeIndicatorElement(token);
    }
  }

  static async addIndicatorElement(token) {
    if (!canModifyToken(token)) return;

    await token.document.setFlag(MODULE_ID, 'hasAffliction', true);

    const tint = getStoredTint(token);
    if (!tint || String(tint) === '#ffffff') {
      await token.document.update({ 'texture.tint': AFFLICTION_TINT });
    }
  }

  static async removeIndicatorElement(token) {
    if (!canModifyToken(token)) return;

    await token.document.unsetFlag(MODULE_ID, 'hasAffliction');

    if (String(getStoredTint(token)) === AFFLICTION_TINT) {
      await token.document.update({ 'texture.tint': null });
    }
  }

  static async refreshAllIndicators() {
    if (!canvas.tokens) return;

    await Promise.all(canvas.tokens.placeables.map(token => this.refreshTokenIndicator(token)));
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
