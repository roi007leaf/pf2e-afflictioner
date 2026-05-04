import { MODULE_ID } from '../constants.js';

export const IMMUNITY_BYPASS_RULE_FLAG = 'immunityBypassRule';

export const DEFAULT_IMMUNITY_BYPASS_RULE = Object.freeze({
  enabled: false,
  traits: ['poison'],
  afflictionKeys: [],
});

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function normalizeAfflictionKeys(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const entry = typeof value === 'object' && value !== null
      ? {
        key: String(value.key || value.uuid || '').trim(),
        name: String(value.name || value.key || value.uuid || '').trim(),
        uuid: String(value.uuid || value.key || '').trim(),
      }
      : {
        key: String(value || '').trim(),
        name: String(value || '').trim(),
        uuid: String(value || '').trim(),
      };

    if (!entry.key || seen.has(entry.key)) continue;
    seen.add(entry.key);
    normalized.push(entry);
  }

  return normalized;
}

export function normalizeRule(rule = {}) {
  const legacyTraits = rule.traits || rule.immunityTraits || rule.afflictionTraits;
  return {
    enabled: rule.enabled === true,
    traits: uniqueStrings(legacyTraits),
    afflictionKeys: normalizeAfflictionKeys(rule.afflictionKeys),
  };
}

export function getRule(actor) {
  if (!actor) return normalizeRule(DEFAULT_IMMUNITY_BYPASS_RULE);
  return normalizeRule({
    ...DEFAULT_IMMUNITY_BYPASS_RULE,
    ...(actor.getFlag?.(MODULE_ID, IMMUNITY_BYPASS_RULE_FLAG) || {}),
  });
}

export async function saveRule(actor, rule) {
  if (!actor || !game.user.isGM) return false;
  await actor.setFlag(MODULE_ID, IMMUNITY_BYPASS_RULE_FLAG, normalizeRule(rule));
  return true;
}
