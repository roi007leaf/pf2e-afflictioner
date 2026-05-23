import { MODULE_ID } from '../constants.js';

const suppressedEffectDeletionUuids = new Set();

export function getCoatings(actor) {
  return actor.getFlag(MODULE_ID, 'weaponCoatings') || {};
}

export function getCoating(actor, weaponId) {
  return getCoatings(actor)[weaponId] || null;
}

export function getInjections(actor) {
  return actor.getFlag(MODULE_ID, 'weaponInjections') || {};
}

export function getInjection(actor, weaponId) {
  return getInjections(actor)[weaponId] || null;
}

export async function addCoating(actor, weaponId, coatingData) {
  const coatings = getCoatings(actor);
  coatings[weaponId] = coatingData;
  await actor.setFlag(MODULE_ID, 'weaponCoatings', coatings);
}

export async function addInjection(actor, weaponId, injectionData) {
  const injections = getInjections(actor);
  injections[weaponId] = injectionData;
  await actor.setFlag(MODULE_ID, 'weaponInjections', injections);
}

export async function updateCoating(actor, weaponId, updates) {
  const coatings = getCoatings(actor);
  if (!coatings[weaponId]) return;
  Object.assign(coatings[weaponId], updates);
  await actor.setFlag(MODULE_ID, 'weaponCoatings', coatings);
}

export async function updateInjection(actor, weaponId, updates) {
  const injections = getInjections(actor);
  if (!injections[weaponId]) return;
  Object.assign(injections[weaponId], updates);
  await actor.setFlag(MODULE_ID, 'weaponInjections', injections);
}

export async function removeCoating(actor, weaponId) {
  const coating = getCoating(actor, weaponId);
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
  await actor.unsetFlag(MODULE_ID, `weaponCoatings.${weaponId}`);
}

export async function removeInjection(actor, weaponId) {
  const injection = getInjection(actor, weaponId);
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
  await actor.unsetFlag(MODULE_ID, `weaponInjections.${weaponId}`);
}

export function isCoatingEffectDeletionSuppressed(effectUuid) {
  return suppressedEffectDeletionUuids.has(effectUuid);
}

export function getAllCoatingsOnCanvas() {
  const result = [];
  for (const token of canvas.tokens.placeables) {
    const actor = token.actor;
    if (!actor) continue;
    const coatings = getCoatings(actor);
    for (const [weaponId, coating] of Object.entries(coatings)) {
      result.push({
        actor,
        actorId: actor.id,
        actorUuid: actor.uuid || actor.id,
        tokenId: token.id,
        actorName: actor.name,
        weaponId,
        ...coating
      });
    }
  }
  return result;
}
