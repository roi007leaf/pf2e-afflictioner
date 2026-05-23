import { MODULE_ID } from '../constants.js';

const suppressedEffectDeletionUuids = new Set();

function _getDocument(target) {
  if (target?.document) {
    if (target.document.actorLink && target.actor) return target.actor;
    return target.document;
  }
  if (target?.actorLink !== undefined && target.actor) {
    return target.actorLink ? target.actor : target;
  }
  return target;
}

export function getCoatings(target) {
  return _getDocument(target)?.getFlag(MODULE_ID, 'weaponCoatings') || {};
}

export function getCoating(target, weaponId) {
  return getCoatings(target)[weaponId] || null;
}

export function getInjections(target) {
  return _getDocument(target)?.getFlag(MODULE_ID, 'weaponInjections') || {};
}

export function getInjection(target, weaponId) {
  return getInjections(target)[weaponId] || null;
}

export async function addCoating(target, weaponId, coatingData) {
  const doc = _getDocument(target);
  const coatings = getCoatings(target);
  coatings[weaponId] = coatingData;
  await doc.setFlag(MODULE_ID, 'weaponCoatings', coatings);
}

export async function addInjection(target, weaponId, injectionData) {
  const doc = _getDocument(target);
  const injections = getInjections(target);
  injections[weaponId] = injectionData;
  await doc.setFlag(MODULE_ID, 'weaponInjections', injections);
}

export async function updateCoating(target, weaponId, updates) {
  const doc = _getDocument(target);
  const coatings = getCoatings(target);
  if (!coatings[weaponId]) return;
  Object.assign(coatings[weaponId], updates);
  await doc.setFlag(MODULE_ID, 'weaponCoatings', coatings);
}

export async function updateInjection(target, weaponId, updates) {
  const doc = _getDocument(target);
  const injections = getInjections(target);
  if (!injections[weaponId]) return;
  Object.assign(injections[weaponId], updates);
  await doc.setFlag(MODULE_ID, 'weaponInjections', injections);
}

export async function removeCoating(target, weaponId) {
  const doc = _getDocument(target);
  const coating = getCoating(target, weaponId);
  if (coating?.coatingEffectUuid) {
    suppressedEffectDeletionUuids.add(coating.coatingEffectUuid);
    try {
      const effect = await fromUuid(coating.coatingEffectUuid);
      if (effect) await effect.delete();
    } catch (e) {
      console.warn('PF2e Afflictioner | Could not remove coating effect:', e);
    } finally {
      suppressedEffectDeletionUuids.delete(coating.coatingEffectUuid);
    }
  }
  await doc.unsetFlag(MODULE_ID, `weaponCoatings.${weaponId}`);
}

export async function removeCoatingFlag(target, weaponId) {
  await _getDocument(target)?.unsetFlag(MODULE_ID, `weaponCoatings.${weaponId}`);
}

export async function removeInjection(target, weaponId) {
  const doc = _getDocument(target);
  const injection = getInjection(target, weaponId);
  if (injection?.injectionEffectUuid) {
    suppressedEffectDeletionUuids.add(injection.injectionEffectUuid);
    try {
      const effect = await fromUuid(injection.injectionEffectUuid);
      if (effect) await effect.delete();
    } catch (e) {
      console.warn('PF2e Afflictioner | Could not remove injection effect:', e);
    } finally {
      suppressedEffectDeletionUuids.delete(injection.injectionEffectUuid);
    }
  }
  await doc.unsetFlag(MODULE_ID, `weaponInjections.${weaponId}`);
}

export async function removeInjectionFlag(target, weaponId) {
  await _getDocument(target)?.unsetFlag(MODULE_ID, `weaponInjections.${weaponId}`);
}

export function isCoatingEffectDeletionSuppressed(effectUuid) {
  return suppressedEffectDeletionUuids.has(effectUuid);
}

export function getAllCoatingsOnCanvas() {
  const result = [];
  for (const token of canvas.tokens.placeables) {
    const actor = token.actor;
    if (!actor) continue;
    const coatings = getCoatings(token);
    for (const [weaponId, coating] of Object.entries(coatings)) {
      result.push({
        actor,
        actorId: actor.id,
        actorUuid: actor.uuid || actor.id,
        tokenId: token.id,
        actorName: token.name || actor.name,
        weaponId,
        ...coating
      });
    }
  }
  return result;
}
