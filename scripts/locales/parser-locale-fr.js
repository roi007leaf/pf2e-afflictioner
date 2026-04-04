import { PF2E_CONDITIONS } from '../constants.js';

// Condition display map: French display name (lowercase) → PF2e condition key.
// Source: PF2e Fr system translation.
const _conditionDisplayMap = new Map([
  // French display names
  ['aveuglé',           'blinded'],
  ['brisé',            'broken'],
  ['maladroit',       'clumsy'],
  ['masqué',             'concealed'],
  ['confus',    'confused'],
  ['contrôlé',     'controlled'],
  ['lié à la malédiction',         'cursebound'],
  ['ébloui',          'dazzled'],
  ['sourd',           'deafened'],
  ['condamné',           'doomed'],
  ['drainé',           'drained'],
  ['mourant',        'dying'],
  ['surchargé',        'encumbered'],
  ['affaibli',          'enfeebled'],
  ['fasciné',         'fascinated'],
  ['fatigué',         'fatigued'],
  ['en fuite',           'fleeing'],
  ['effrayé',           'frightened'],
  ['amical',     'friendly'],
  ['aggripé',           'grabbed'],
  ['serviable',          'helpful'],
  ['caché',           'hidden'],
  ['hostile',        'hostile'],
  ['immobilisé',        'immobilized'],
  ['indifférent',       'indifferent'],
  ['invisible',       'invisible'],
  ['malveillance',             'malevolence'],
  ['observé',           'observed'],
  ['pris au dépourvu', 'off-guard'],
  ['paralysé',       'paralyzed'],
  ['dégâts persistants', 'persistent-damage'],
  ['pétrifié',        'petrified'],
  ['à terre',            'prone'],
  ['accéléré',           'quickened'],
  ['entravé',        'restrained'],
  ['nauséeux',           'sickened'],
  ['ralenti',          'slowed'],
  ['étourdi',         'stunned'],
  ['stupéfié',         'stupefied'],
  ['inconscient',      'unconscious'],
  ['non détecté',       'undetected'],
  ['inamical',   'unfriendly'],
  ['inaperçu',         'unnoticed'],
  ['blessé',             'wounded'],
  // English fallbacks — UUID enrichers may still use English display names
  ...PF2E_CONDITIONS.map(c => [c, c]),
  ['flat-footed',       'off-guard'],
]);

export const FR_PARSER_LOCALE = {
  id: 'fr',

  // ── Section header regex fragments ─────────────────────────────────────────
  // Pre-escaped for regex use.  stageLabelRe must capture the stage number in group 1.
  stageLabelRe:       'Stade\\s*(\\d+)',
  onsetLabelRe:       '(?:Durée\\s+initiale|Délai)',
  maxDurationLabelRe: 'Durée\\s+maximale',
  // Separator: colon and/or whitespace (colon may appear outside <strong> tag too).
  afterLabel:    '\\s+',
  afterLabelOpt: '\\s*',

  // ── Standalone patterns ────────────────────────────────────────────────────
  asStagePattern:      /\bcomme\s+au\s+stade\s+(\d+)\b/i,
  dcPattern:           /DD\s+(\d+)/i,
  deathPattern:        /\bmort\b|\bmeurt\b|\bmort\s+instantanée\b/i,
  // "for 1 round" / "for 2d6 hours" at end of plain-text stage content
  forDurationPattern:  /\b(\d+d\d+\s+\w+|\d+\s+\w+)\s*$/i,
  // "1d6 fire or cold damage"
  orDamagePattern:     /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+ou\s+(\w+)\s+dégâts/gi,

  // ── Duration ───────────────────────────────────────────────────────────────
  durationDiceRegex:  /(\d+d\d+)\s+(\S+)/i,
  durationFixedRegex: /(\d+)\s+(\S+)/i,
  durationUnitMap: {
    // French forms (singular, genitive singular, genitive plural)
    'round':  'round',  'rounds':  'round',
    'minute': 'minute', 'minutes':  'minute',
    'heure':    'hour',   'heures':    'hour',
    'jour':   'day',    'jours':     'day',
    'semaine': 'week',   'semaines':  'week',
    // English fallbacks — system structured data is always English
    round: 'round', rounds: 'round',
    minute: 'minute', minutes: 'minute',
    hour: 'hour', hours: 'hour',
    day: 'day', days: 'day',
    week: 'week', weeks: 'week',
  },

  // ── Manual-handling keywords ───────────────────────────────────────────────
  manualKeywords: [
    'secret', 'mj', 'special', 'compétence', 'save again',
    'choisir', 'option', 'ou', 'either', 'à la place de', 'permanent',
  ],

  // ── Plain-text damage type tokens ─────────────────────────────────────────
  damageTypes: [
    'acide', 'acid',
    'air', 'air',
    'saignement', 'bleed',
    'contondant', 'bludgeoning',
    'froid', 'cold',
    'terre', 'earth',
    'électricité', 'electricity',
    'feu', 'fire',
    'force', 'force',
    'mentaux', 'mental',
    'metal', 'metal',
    'persistants', 'persistent',
    'perforant', 'piercing',
    'poison', 'poison',
    'précision', 'precision',
    'tranchant', 'slashing',
    'son', 'sonic',
    'spirituel', 'spirit',
    'éclaboussure', 'splash',
    'vitalité', 'vitality',
    'vide', 'void',
    'non-typé', 'untyped',
  ],

  // ── Condition matching ─────────────────────────────────────────────────────
  conditionDisplayMap: _conditionDisplayMap,
  // French uses spaces between words, so word boundaries work.
  useWordBoundaries: true,

  // ── Weakness patterns ──────────────────────────────────────────────────────
  weaknessPatterns: [
    { regex: /faiblesse\s+à\s+(\w+)\s+(\d+)/gi, typeGroup: 1, valueGroup: 2 },
    { regex: /faiblesse\s+(\d+)\s+contre\s+le\s+(\w+)/gi, typeGroup: 2, valueGroup: 1 },
    // English fallbacks
    { regex: /weakness\s+to\s+(\w+)\s+(\d+)/gi, typeGroup: 1, valueGroup: 2 },
    { regex: /weakness\s+(\d+)\s+to\s+(\w+)/gi, typeGroup: 2, valueGroup: 1 },
  ],

  // ── Speed penalty patterns ────────────────────────────────────────────────
  speedPenaltyPatterns: [
    { regex: /pénalité\s+de\s+statut\s+de\s+[\u2013\u2014-](\d+)[\u2013\u2014-]m\s+à\s+(?:toutes\s+)?les\s+[Vv]itesse/g, valueGroup: 1 },
    // English fallback
    { regex: /[\u2013\u2014-](\d+)[\u2013\u2014-]foot\s+status\s+penalty\s+to\s+(?:all\s+)?[Ss]peed/g, valueGroup: 1 },
  ],

  // ── Effect section label ──────────────────────────────────────────────────
  effectLabelRe: '(?:Effet|Effect)',

  // ── Referenced affliction patterns ──────────────────────────────────────────
  referencedAfflictionPatterns: [
    // French
    /\b(?:exposé|sujet)\s+à\s+(?:la\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\battrape?\s+(?:le\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\batteint\s+par\s+(?:le\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    // English fallbacks
    /\b(?:exposed|subjected)\s+to\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\bcontracts?\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\bafflicted\s+with\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
  ],

  // ── Multiple-exposure patterns ─────────────────────────────────────────────
  multipleExposurePatterns: [
    {
      main: /(?:each\s+(?:time\s+you(?:'re|\s+are)\s+exposed|additional\s+exposure)).*?(?:increase|advance).*?(?:stage|stages)\s*(?:by\s*)?(\d+)/i,
      minStage: /(?:while|at|when)\s+(?:already\s+)?(?:at\s+)?stage\s+(\d+)/i,
    },
    {
      main: /expositions\s+multiples.*?(?:augmente|avance).*?(?:stade|stades)\s*(?:par\s*)?(\d+)/i,
      minStage: null,
    },
    // English fallbacks
    {
      main: /(?:each\s+(?:time\s+you(?:'re|\s+are)\s+exposed|additional\s+exposure)).*?(?:increase|advance).*?(?:stage|stages)\s*(?:by\s*)?(\d+)/i,
      minStage: /(?:while|at|when)\s+(?:already\s+)?(?:at\s+)?stage\s+(\d+)/i,
    },
    {
      main: /multiple\s+exposures.*?(?:increase|advance).*?(?:stage|stages)\s*(?:by\s*)?(\d+)/i,
      minStage: null,
    },
  ],
};
