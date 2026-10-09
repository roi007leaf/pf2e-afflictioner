import { MODULE_ID } from '../constants.js';

export function getEditedDefinition(key) {
  if (!key) return null;

  const editedAfflictions = game.settings.get(MODULE_ID, 'editedAfflictions');
  return editedAfflictions[key] || null;
}

export async function saveEditedDefinition(key, editedData) {
  if (!game.user.isGM) {
    console.error('AfflictionDefinitionStore: Non-GM user attempted to save definition');
    ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_EDITOR'));
    return;
  }

  if (!key || !editedData) {
    console.error('AfflictionDefinitionStore: Invalid key or data');
    return;
  }

  const editedAfflictions = { ...game.settings.get(MODULE_ID, 'editedAfflictions') };

  editedData.editedAt = Date.now();
  editedData.editedBy = game.user.id;

  editedAfflictions[key] = editedData;

  await game.settings.set(MODULE_ID, 'editedAfflictions', editedAfflictions);
}

export async function removeEditedDefinition(key) {
  if (!game.user.isGM) {
    console.error('AfflictionDefinitionStore: Non-GM user attempted to remove definition');
    ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_DEFINITIONS'));
    return;
  }

  if (!key) {
    console.error('AfflictionDefinitionStore: Invalid key');
    return;
  }

  const editedAfflictions = { ...game.settings.get(MODULE_ID, 'editedAfflictions') };
  delete editedAfflictions[key];

  await game.settings.set(MODULE_ID, 'editedAfflictions', editedAfflictions);
}

export function getAllEditedDefinitions() {
  return game.settings.get(MODULE_ID, 'editedAfflictions') || {};
}

export function generateDefinitionKey(afflictionData) {
  if (!afflictionData) {
    console.error('AfflictionDefinitionStore: Cannot generate key from invalid data');
    return null;
  }

  // A drug's poison and its addiction have independent editable definitions.
  if (afflictionData.isAddiction) return `addiction-${afflictionData.drugKey}`;

  if (afflictionData.sourceItemUuid) {
    return afflictionData.sourceItemUuid;
  }

  const name = afflictionData.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  const type = afflictionData.type || 'affliction';
  return `custom-${name}-${type}`;
}
