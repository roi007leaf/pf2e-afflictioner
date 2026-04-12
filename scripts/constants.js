export const MODULE_ID = 'pf2e-afflictioner';

export const AFFLICTION_TYPES = {
  POISON: 'poison',
  DISEASE: 'disease',
  CURSE: 'curse'
};

export const DEGREE_OF_SUCCESS = {
  CRITICAL_SUCCESS: 'criticalSuccess',
  SUCCESS: 'success',
  FAILURE: 'failure',
  CRITICAL_FAILURE: 'criticalFailure'
};

export const DEFAULT_SETTINGS = {
  'showVisualIndicators': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.SHOW_INDICATORS_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.SHOW_INDICATORS_HINT',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true,
    restricted: true
  },
  'autoDetectAfflictions': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.AUTO_DETECT_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.AUTO_DETECT_HINT',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true,
    restricted: true
  },
  'autoPromptSaves': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.AUTO_PROMPT_SAVES_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.AUTO_PROMPT_SAVES_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'integrateWithStoryframe': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.STORYFRAME_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.STORYFRAME_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'requireSaveConfirmation': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.REQUIRE_CONFIRMATION_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.REQUIRE_CONFIRMATION_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'anonymizeSaveMessages': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.ANONYMIZE_SAVES_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.ANONYMIZE_SAVES_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'gmRollMysteriousSaves': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.GM_ROLL_MYSTERIOUS_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.GM_ROLL_MYSTERIOUS_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'useApplicationInitiative': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.USE_APP_INITIATIVE_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.USE_APP_INITIATIVE_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'useTokenToolsButton': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.USE_TOKEN_TOOLS_BUTTON_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.USE_TOKEN_TOOLS_BUTTON_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true,
    requiresReload: true
  },
  'promptCoatingDuration': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.PROMPT_COATING_DURATION_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.PROMPT_COATING_DURATION_HINT',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true,
    restricted: true
  },
  'allowPlayerWeaponCoatingAccess': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.ALLOW_PLAYER_WEAPON_COATING_ACCESS_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.ALLOW_PLAYER_WEAPON_COATING_ACCESS_HINT',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true,
    restricted: true
  },
  'editedAfflictions': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.EDITED_AFFLICTIONS_STORE_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.EDITED_AFFLICTIONS_STORE_HINT',
    scope: 'world',
    type: Object,
    default: {},
    config: false,
    restricted: true
  },
  'communityDataVersion': {
    name: 'PF2E_AFFLICTIONER.SETTINGS.COMMUNITY_DATA_VERSION_NAME',
    hint: 'PF2E_AFFLICTIONER.SETTINGS.COMMUNITY_DATA_VERSION_HINT',
    scope: 'world',
    type: String,
    default: '',
    config: false,
    restricted: true
  },
  'migrationVersion': {
    scope: 'world',
    type: Number,
    default: 0,
    config: false,
    restricted: true
  }
};

export const PERSISTENT_CONDITIONS = ['frightened', 'drained', 'stunned', 'doomed', 'wounded'];

export const VALUELESS_CONDITIONS = [
  'blinded', 'concealed', 'confused', 'controlled', 'dazzled', 'deafened',
  'encumbered', 'fascinated', 'fatigued', 'fleeing', 'grabbed', 'hidden',
  'immobilized', 'invisible', 'observed', 'off-guard', 'paralyzed', 'petrified',
  'prone', 'quickened', 'restrained', 'unconscious', 'undetected'
];

export const PF2E_CONDITIONS = [
  'blinded', 'broken', 'clumsy', 'concealed', 'confused', 'controlled',
  'cursebound', 'dazzled', 'deafened', 'doomed', 'drained', 'dying',
  'encumbered', 'enfeebled', 'fascinated', 'fatigued', 'fleeing', 'frightened',
  'friendly', 'grabbed', 'helpful', 'hidden', 'hostile', 'immobilized',
  'indifferent', 'invisible', 'malevolence', 'observed', 'off-guard',
  'paralyzed', 'persistent-damage', 'petrified', 'prone', 'quickened',
  'restrained', 'sickened', 'slowed', 'stunned', 'stupefied', 'unconscious',
  'undetected', 'unfriendly', 'unnoticed', 'wounded'
];

export const DURATION_MULTIPLIERS = {
  'round': 6,
  'minute': 60,
  'hour': 3600,
  'day': 86400,
  'week': 604800
};
