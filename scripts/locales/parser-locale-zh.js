import { PF2E_CONDITIONS } from '../constants.js';

// Condition display map: Chinese display name (lowercase-equivalent) → PF2e condition key.
// Source: PF2e CN system translation.
const _conditionDisplayMap = new Map([
  ['目盲',   'blinded'],
  ['破损',   'broken'],
  ['笨拙',   'clumsy'],
  ['隐蔽',   'concealed'],
  ['困惑',   'confused'],
  ['被控制', 'controlled'],
  ['咒缚',   'cursebound'],
  ['目眩',   'dazzled'],
  ['耳聋',   'deafened'],
  ['毁灭',   'doomed'],
  ['流失',   'drained'],
  ['濒死',   'dying'],
  ['超载',   'encumbered'],
  ['力竭',   'enfeebled'],
  ['迷魂',   'fascinated'],
  ['疲乏',   'fatigued'],
  ['逃跑',   'fleeing'],
  ['惊惧',   'frightened'],
  ['友善',   'friendly'],
  ['擒抱',   'grabbed'],
  ['乐于帮助', 'helpful'],
  ['藏匿',   'hidden'],
  ['敌对',   'hostile'],
  ['禁足',   'immobilized'],
  ['不关心', 'indifferent'],
  ['隐形',   'invisible'],
  ['恶意',   'malevolence'],
  ['可见',   'observed'],
  ['措手不及', 'off-guard'],
  ['麻痹',   'paralyzed'],
  ['持续伤害', 'persistent-damage'],
  ['石化',   'petrified'],
  ['倒地',   'prone'],
  ['迅捷',   'quickened'],
  ['束缚',   'restrained'],
  ['恶心',   'sickened'],
  ['缓慢',   'slowed'],
  ['震慑',   'stunned'],
  ['呆滞',   'stupefied'],
  ['失去意识', 'unconscious'],
  ['无踪',   'undetected'],
  ['不友善', 'unfriendly'],
  ['未发现', 'unnoticed'],
  ['受伤',   'wounded'],
]);

export const ZH_PARSER_LOCALE = {
  id: 'zh',

  // ── Section header regex fragments ─────────────────────────────────────────
  // Pre-escaped for regex use.  stageLabelRe must capture the stage number in group 1.
  stageLabelRe:       '阶段\\s*(\\d+)',
  onsetLabelRe:       '潜伏期',
  maxDurationLabelRe: '最大持续时间',
  // Chinese may omit whitespace between label and content.
  afterLabel:    '\\s*',
  afterLabelOpt: '\\s*',

  // ── Standalone patterns ────────────────────────────────────────────────────
  // "如同阶段 2"
  asStagePattern:     /如同阶段\s*(\d+)/i,
  // DC stays as "DC" in Chinese PF2e text
  dcPattern:          /DC\s*(\d+)/i,
  // 死亡 = dead/dies, 即死 = instant death
  deathPattern:       /死亡|即死/i,
  // Duration at end of plain-text stage content, e.g. "持续 1 轮"
  forDurationPattern: /持续\s*(\d+d\d+(?:\s*[+-]\s*\d+)?\s*[\u4e00-\u9fff]+|\d+\s*[\u4e00-\u9fff]+)\s*$/i,
  // "1d6 火焰 或 寒冷 伤害"
  orDamagePattern:    /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([\u4e00-\u9fff]+)\s*或\s*([\u4e00-\u9fff]+)\s*伤害/gi,

  // ── Duration ───────────────────────────────────────────────────────────────
  // CJK unit characters follow the number directly or with a space: "1轮" or "1 轮".
  durationDiceRegex:  /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([\u4e00-\u9fff]+|\w+)/i,
  durationFixedRegex: /(\d+)\s*([\u4e00-\u9fff]+|\w+)/i,
  durationUnitMap: {
    '轮':   'round',
    '分钟': 'minute',
    '小时': 'hour',
    '天':   'day',
    '周':   'week',
    // English fallbacks — system structured data (item.system.onset.unit etc.) is always English.
    round: 'round', rounds: 'round',
    minute: 'minute', minutes: 'minute',
    hour: 'hour', hours: 'hour',
    day: 'day', days: 'day',
    week: 'week', weeks: 'week',
  },

  // ── Manual-handling keywords ───────────────────────────────────────────────
  manualKeywords: [
    '秘密', 'gm', 'GM', '特殊', '能力', '再次豁免',
    '选择', '选项', '或', '或者', '改为', '永久',
  ],

  // ── Plain-text damage type tokens ─────────────────────────────────────────
  damageTypes: [
    '酸蚀', '钝击', '寒冷', '电击', '火焰', '力场',
    '心灵', '穿刺', '毒素', '挥砍', '音波', '流血', '持续',
  ],

  // ── Condition matching ─────────────────────────────────────────────────────
  conditionDisplayMap: _conditionDisplayMap,
  // Chinese text has no ASCII word boundaries.
  useWordBoundaries: false,

  // ── Weakness patterns ──────────────────────────────────────────────────────
  // Chinese syntax is uniformly "弱点 <type> N" — no flipped form.
  weaknessPatterns: [
    { regex: /弱点\s*([\u4e00-\u9fff]+)\s*(\d+)/gi, typeGroup: 1, valueGroup: 2 },
  ],

  // ── Speed penalty patterns ────────────────────────────────────────────────
  // "速度-5尺状态减值" = speed –5-foot status penalty
  speedPenaltyPatterns: [
    { regex: /速度[\u2013\u2014-](\d+)尺状态减值/g, valueGroup: 1 },
  ],

  // ── Effect section label ──────────────────────────────────────────────────
  effectLabelRe: '(?:效果|Effect)',

  // ── Referenced affliction patterns ──────────────────────────────────────────
  referencedAfflictionPatterns: [
    // "暴露于 X" / "感染 X"
    /暴露于\s*(.+?)(?:\s*[（(]|\s*$)/gi,
    /感染\s*(.+?)(?:\s*[（(]|\s*$)/gi,
  ],

  // ── Multiple-exposure patterns ─────────────────────────────────────────────
  multipleExposurePatterns: [
    {
      main: /每次(?:暴露|额外.*?暴露).*?阶段增加.*?(\d+)/i,
      minStage: /处于阶段\s*(\d+)/i,
    },
    {
      main: /多次暴露.*?阶段增加.*?(\d+)/i,
      minStage: null,
    },
  ],
};
