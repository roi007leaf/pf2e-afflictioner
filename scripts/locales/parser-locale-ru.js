import { PF2E_CONDITIONS } from '../constants.js';

// Condition display map: Russian display name (lowercase) → PF2e condition key.
// Source: PF2e RU system translation.
const _conditionDisplayMap = new Map([
  // Russian display names
  ['слепота',           'blinded'],
  ['сломан',            'broken'],
  ['неуклюжесть',       'clumsy'],
  ['скрыт',             'concealed'],
  ['замешательство',    'confused'],
  ['под контролем',     'controlled'],
  ['проклятый',         'cursebound'],
  ['ослеплён',          'dazzled'],
  ['глухота',           'deafened'],
  ['обречён',           'doomed'],
  ['истощён',           'drained'],
  ['при смерти',        'dying'],
  ['перегружен',        'encumbered'],
  ['ослаблен',          'enfeebled'],
  ['заворожён',         'fascinated'],
  ['утомление',         'fatigued'],
  ['бегство',           'fleeing'],
  ['напуган',           'frightened'],
  ['дружественный',     'friendly'],
  ['схвачен',           'grabbed'],
  ['любезный',          'helpful'],
  ['спрятан',           'hidden'],
  ['враждебный',        'hostile'],
  ['обездвижен',        'immobilized'],
  ['безразличие',       'indifferent'],
  ['невидимость',       'invisible'],
  ['злоба',             'malevolence'],
  ['замечен',           'observed'],
  ['застигнут врасплох', 'off-guard'],
  ['парализован',       'paralyzed'],
  ['продолжительный урон', 'persistent-damage'],
  ['окаменение',        'petrified'],
  ['ничком',            'prone'],
  ['ускорен',           'quickened'],
  ['удерживаем',        'restrained'],
  ['тошнота',           'sickened'],
  ['замедлен',          'slowed'],
  ['ошеломлён',         'stunned'],
  ['одурманен',         'stupefied'],
  ['без сознания',      'unconscious'],
  ['необнаружен',       'undetected'],
  ['недружественный',   'unfriendly'],
  ['незамечен',         'unnoticed'],
  ['ранен',             'wounded'],
  // English fallbacks — UUID enrichers may still use English display names
  ...PF2E_CONDITIONS.map(c => [c, c]),
  ['flat-footed',       'off-guard'],
]);

export const RU_PARSER_LOCALE = {
  id: 'ru',

  // ── Section header regex fragments ─────────────────────────────────────────
  // Pre-escaped for regex use.  stageLabelRe must capture the stage number in group 1.
  // Russian convention uses a colon after labels — `:?` makes it optional.
  stageLabelRe:       'Стадия\\s*(\\d+):?',
  onsetLabelRe:       'Возникновение:?',
  maxDurationLabelRe: 'Макс\\.продолжительность:?',
  // Separator: colon and/or whitespace (colon may appear outside <strong> tag too).
  afterLabel:    '[:\\s]+',
  afterLabelOpt: '[:\\s]*',

  // ── Standalone patterns ────────────────────────────────────────────────────
  // "как стадия 2" / "as stage 2"
  asStagePattern:     /(?:как\s+стади[яи]\s+|as\s+stage\s+)(\d+)/i,
  // "КС 18" or "DC 18"
  dcPattern:          /(?:КС|DC)\s+(\d+)/i,
  // мёртв/мертв = dead, умирает = dies, смерть = death
  // \b doesn't work with Cyrillic in JS — use (?:^|\\s) / (?:\\s|$) boundaries instead.
  deathPattern:       /(?:^|\s)(?:мёртв|мертв|умирает|смерть)(?:\s|$)|\bdead\b|\bdies\b|\binstant\s+death\b/i,
  // "на 1 раунд" / "на 2d6 часов" at end of plain-text stage content
  forDurationPattern: /\bна\s+(\d+d\d+(?:\s*[+-]\s*\d+)?\s+\S+|\d+\s+\S+)\s*$/i,
  // "1d6 урон огнём или холодом"
  orDamagePattern:    /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(?:урон\s+)?(\S+)\s+или\s+(\S+)(?:\s+урон)?/gi,

  // ── Duration ───────────────────────────────────────────────────────────────
  durationDiceRegex:  /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\S+)/i,
  durationFixedRegex: /(\d+)\s+(\S+)/i,
  durationUnitMap: {
    // Russian forms (singular, genitive singular, genitive plural)
    'раунд':  'round',  'раунда':  'round',  'раундов':  'round',
    'минута': 'minute', 'минуты':  'minute', 'минут':    'minute',
    'час':    'hour',   'часа':    'hour',   'часов':    'hour',
    'день':   'day',    'дня':     'day',    'дней':     'day',
    'неделя': 'week',   'недели':  'week',   'недель':   'week',
    // English fallbacks — system structured data is always English
    round: 'round', rounds: 'round',
    minute: 'minute', minutes: 'minute',
    hour: 'hour', hours: 'hour',
    day: 'day', days: 'day',
    week: 'week', weeks: 'week',
  },

  // ── Manual-handling keywords ───────────────────────────────────────────────
  manualKeywords: [
    'тайна', 'тайный', 'тайную', 'мастер', 'gm',
    'особое', 'special', 'ability', 'save again',
    'choose', 'option',
    'или', 'or', 'либо', 'either', 'вместо', 'instead', 'permanent',
  ],

  // ── Plain-text damage type tokens ─────────────────────────────────────────
  damageTypes: [
    'кислота', 'acid',
    'воздух', 'air',
    'кровотечение', 'bleed',
    'дробящий', 'bludgeoning',
    'холод', 'cold',
    'земля', 'earth',
    'электричество', 'electricity',
    'огонь', 'fire',
    'сила', 'force',
    'ментальный', 'mental',
    'металл', 'metal',
    'продолжительный урон', 'persistent',
    'колющий', 'piercing',
    'яд', 'poison',
    'точный', 'precision',
    'рубящий', 'slashing',
    'звук', 'sonic',
    'духовный', 'spirit',
    'брызги', 'splash',
    'жизненность', 'vitality',
    'пустота', 'void',
    'нетипичный', 'untyped',
  ],

  // ── Condition matching ─────────────────────────────────────────────────────
  conditionDisplayMap: _conditionDisplayMap,
  // Russian uses spaces between words, so word boundaries work.
  useWordBoundaries: true,

  // ── Weakness patterns ──────────────────────────────────────────────────────
  // "уязвим к огню 5" / "уязвим 5 к огню"
  weaknessPatterns: [
    { regex: /уязвим\s+к\s+(\S+)\s+(\d+)/gi, typeGroup: 1, valueGroup: 2 },
    { regex: /уязвим\s+(\d+)\s+к\s+(\S+)/gi, typeGroup: 2, valueGroup: 1 },
    // English fallbacks
    { regex: /weakness\s+to\s+(\w+)\s+(\d+)/gi, typeGroup: 1, valueGroup: 2 },
    { regex: /weakness\s+(\d+)\s+to\s+(\w+)/gi, typeGroup: 2, valueGroup: 1 },
  ],

  // ── Speed penalty patterns ────────────────────────────────────────────────
  // "−5-футовый штраф состояния к Скорости"
  speedPenaltyPatterns: [
    { regex: /[\u2013\u2014-](\d+)[\u2013\u2014-]футов\S*\s+штраф\s+состояния\s+к\s+скорости/gi, valueGroup: 1 },
    // English fallback
    { regex: /[\u2013\u2014-](\d+)[\u2013\u2014-]foot\s+status\s+penalty\s+to\s+(?:all\s+)?[Ss]peed/g, valueGroup: 1 },
  ],

  // ── Effect section label ──────────────────────────────────────────────────
  effectLabelRe: '(?:Эффект|Effect)',

  // ── Referenced affliction patterns ──────────────────────────────────────────
  referencedAfflictionPatterns: [
    // "подвержен проклятию X" / "подвергается проклятию X"
    /(?:подверж\S+|подвергает\S+)\s+(.+?)(?:\s*[（(]|\s*$)/gi,
    // English fallbacks
    /\b(?:exposed|subjected)\s+to\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\bcontracts?\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
    /\bafflicted\s+with\s+(?:the\s+)?(.+?)(?:\s*[（(]|\s*$)/gi,
  ],

  // ── Multiple-exposure patterns ─────────────────────────────────────────────
  multipleExposurePatterns: [
    {
      main: /(?:каждый\s+раз.*?(?:подверг|воздейств)|каждое\s+дополнительное\s+воздействие).*?(?:увелич|продвин).*?(?:стади[яию]|стадий)\s*(?:на\s*)?(\d+)/i,
      minStage: /(?:пока|на|когда)\s+(?:уже\s+)?(?:на\s+)?стадии\s+(\d+)/i,
    },
    {
      main: /многократн\S*\s+воздействи\S*.*?(?:увелич|продвин).*?(?:стади[яию]|стадий)\s*(?:на\s*)?(\d+)/i,
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
