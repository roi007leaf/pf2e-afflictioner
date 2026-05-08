import { getSystemFlags } from './systemCompat.js';

/**
 * Returns true if an affliction should be silently skipped during processing.
 * Callers should do: if (shouldSkipAffliction(affliction)) continue; // or return;
 */
export function shouldSkipAffliction(affliction) {
  if (!affliction) return true;
  if (affliction.skip === true) return true;
  if (!affliction.stages || affliction.stages.length === 0) return true;
  return false;
}

export function shouldSkipPromptAffliction(affliction) {
  if (affliction?.isEffectOnly) return false;
  return shouldSkipAffliction(affliction);
}

export function extractMessageAfflictionContext(message) {
  const context = {};
  const flags = getSystemFlags(message);
  const flagDc = flags?.context?.dc?.value;
  if (Number.isFinite(flagDc)) context.dc = flagDc;

  const content = message?.content || '';
  const root = createMessageContentRoot(content);
  if (root) {
    const dcElement = root.querySelector('[data-action="spell-save"][data-dc], [data-dc], [data-pf2-dc]');
    const dc = parseInt(dcElement?.dataset?.dc ?? dcElement?.dataset?.pf2Dc);
    if (Number.isFinite(dc)) context.dc = dc;

    const saveType = dcElement?.dataset?.save || dcElement?.dataset?.saveType || dcElement?.dataset?.pf2Check;
    if (isSaveType(saveType)) context.saveType = saveType.toLowerCase();
  } else {
    const dcMatch = content.match(/data-dc=["'](\d+)["']/i) || content.match(/data-pf2-dc=["'](\d+)["']/i);
    if (dcMatch) context.dc = parseInt(dcMatch[1]);

    const saveMatch = content.match(/data-save=["'](\w+)["']/i) ||
      content.match(/data-save-type=["'](\w+)["']/i) ||
      content.match(/data-pf2-check=["'](\w+)["']/i);
    if (saveMatch && isSaveType(saveMatch[1])) context.saveType = saveMatch[1].toLowerCase();
  }

  return context;
}

export function applyMessageAfflictionContext(afflictionData, message) {
  if (!afflictionData) return afflictionData;

  const context = extractMessageAfflictionContext(message);
  if (context.dc) afflictionData.dc = context.dc;
  if (context.saveType) afflictionData.saveType = context.saveType;
  return afflictionData;
}

function createMessageContentRoot(content) {
  if (!content || typeof document === 'undefined') return null;
  const root = document.createElement('div');
  root.innerHTML = content;
  return root;
}

function isSaveType(value) {
  return ['fortitude', 'reflex', 'will'].includes(String(value || '').toLowerCase());
}
