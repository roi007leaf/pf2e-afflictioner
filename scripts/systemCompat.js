/**
 * System compatibility layer for PF2e and SF2e support.
 * Both systems share the same codebase, so hooks (pf2e.*) and game.pf2e API are identical.
 * Differences: message/document flags use game.system.id as namespace (pf2e vs sf2e),
 * and condition compendium packs may use either conditionitems or conditions.
 */

let _systemId = null;

/**
 * Call once during the 'init' hook to capture the active system ID.
 * FoundryVTT namespaces flags by game.system.id, so this is the source of truth.
 */
export function detectSystem() {
  _systemId = game.system.id;
}

/** Returns the system ID ('pf2e' or 'sf2e'), used for flag namespacing. */
export function getSystemId() {
  return _systemId || game.system?.id || 'pf2e';
}

/** Returns system-specific flags from a message or document. */
export function getSystemFlags(obj) {
  return obj?.flags?.[getSystemId()];
}

/** Returns the conditions compendium pack. */
export function getConditionPack() {
  const systemId = getSystemId();
  return game.packs.get(`${systemId}.conditionitems`) ||
    game.packs.get(`${systemId}.conditions`) ||
    game.packs.get('pf2e.conditionitems') ||
    game.packs.get('pf2e.conditions') ||
    game.packs.get('sf2e.conditionitems') ||
    game.packs.get('sf2e.conditions');
}

/** Returns a Compendium UUID for a condition entry. */
export function getConditionUuidFromEntry(pack, entryId) {
  return `Compendium.${pack.collection}.Item.${entryId}`;
}
