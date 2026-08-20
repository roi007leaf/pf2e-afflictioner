import { MODULE_ID } from '../constants.js';
import { getSystemFlags } from '../systemCompat.js';

const DAMAGE_OPTION_PREFIX = `${MODULE_ID}:unhealable-damage:`;
const DEBT_RULE_SLUG = `${MODULE_ID}-unhealable-damage`;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeHTML(value) {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value));
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, character => replacements[character]);
}

export class RecoveryRestrictionService {
  static isActive(affliction) {
    return !!affliction?.recoveryRestriction && affliction.recoveryRestrictionResolved !== true;
  }

  static getMinimumStage(affliction) {
    if (!this.isActive(affliction)) return 0;
    const minimumStage = Number(affliction.recoveryRestriction?.minimumStage);
    return Number.isInteger(minimumStage) && minimumStage > 0 ? minimumStage : 0;
  }

  static preventsHealing(affliction) {
    return this.isActive(affliction) && affliction.recoveryRestriction?.unhealableDamage === true;
  }

  static requiresCounteract(affliction) {
    return this.isActive(affliction) && affliction.recoveryRestriction?.requiresCounteract === true;
  }

  static getDamageRollOption(affliction) {
    return this.preventsHealing(affliction) && affliction?.id
      ? `${DAMAGE_OPTION_PREFIX}${affliction.id}`
      : null;
  }

  static buildDamageLink(formula, type, affliction) {
    const typedFormula = type && type !== 'untyped' ? `${formula}[${type}]` : formula;
    const option = this.getDamageRollOption(affliction);
    return `@Damage[${typedFormula}${option ? `|options:${option}` : ''}]`;
  }

  static tagDamageLinks(text, affliction) {
    if (typeof text !== 'string' || !text.includes('@Damage[')) return text;

    const option = this.getDamageRollOption(affliction);
    if (!option) return text;

    const marker = '@Damage[';
    let result = '';
    let searchStart = 0;

    while (searchStart < text.length) {
      const markerIndex = text.indexOf(marker, searchStart);
      if (markerIndex === -1) {
        result += text.slice(searchStart);
        break;
      }

      result += text.slice(searchStart, markerIndex);
      let depth = 1;
      let endIndex = markerIndex + marker.length;

      for (; endIndex < text.length; endIndex++) {
        const char = text[endIndex];
        if (char === '[') depth += 1;
        if (char === ']') depth -= 1;
        if (depth === 0) break;
      }

      if (depth !== 0) {
        result += text.slice(markerIndex);
        break;
      }

      const contentStart = markerIndex + marker.length;
      const content = text.slice(contentStart, endIndex);
      const optionsPattern = /(^|\|)options:([^|]*)/;
      const optionsMatch = content.match(optionsPattern);
      let taggedContent = content;

      if (optionsMatch) {
        const options = optionsMatch[2].split(',').map(value => value.trim()).filter(Boolean);
        if (!options.includes(option)) {
          taggedContent = content.replace(
            optionsPattern,
            `${optionsMatch[1]}options:${[...options, option].join(',')}`,
          );
        }
      } else {
        taggedContent = `${content}|options:${option}`;
      }

      result += `${marker}${taggedContent}]`;
      searchStart = endIndex + 1;
    }

    return result;
  }

  static getAfflictionIdFromMessage(message) {
    const options = getSystemFlags(message)?.context?.options;
    if (!Array.isArray(options)) return null;
    const option = options.find(value => typeof value === 'string' && value.startsWith(DAMAGE_OPTION_PREFIX));
    return option?.slice(DAMAGE_OPTION_PREFIX.length) || null;
  }

  static getAppliedHitPointLoss(message) {
    const appliedDamage = getSystemFlags(message)?.appliedDamage;
    if (!appliedDamage || appliedDamage.isHealing || appliedDamage.isReverted) return 0;

    return (appliedDamage.updates || [])
      .filter(update => update?.path === 'system.attributes.hp.value')
      .reduce((total, update) => total + Math.max(0, Number(update.value) || 0), 0);
  }

  static isDebtRule(rule) {
    return rule?.key === 'LoseHitPoints' && rule?.slug === DEBT_RULE_SLUG;
  }

  static buildDebtRule(afflictionName, value) {
    return {
      key: 'LoseHitPoints',
      slug: DEBT_RULE_SLUG,
      label: `${afflictionName} - Unhealable Damage`,
      value,
      recoverable: false,
      reevaluateOnUpdate: false,
    };
  }

  static withDebtRule(rules, afflictionName, value) {
    const nextRules = clone(Array.isArray(rules) ? rules : []).filter(rule => !this.isDebtRule(rule));
    if (value > 0) nextRules.push(this.buildDebtRule(afflictionName, value));
    return nextRules;
  }

  static preserveDebtRule(rules, effect, affliction) {
    const debt = this.preventsHealing(affliction)
      ? Math.max(0, Number(effect?.flags?.[MODULE_ID]?.unhealableDamage) || 0)
      : 0;
    return this.withDebtRule(rules, affliction?.name || effect?.name || 'Affliction', debt);
  }

  static async recordAppliedDamage(message) {
    const afflictionId = this.getAfflictionIdFromMessage(message);
    const hitPointLoss = this.getAppliedHitPointLoss(message);
    if (!afflictionId || hitPointLoss <= 0 || !message?.id) return false;

    const effect = await this._findEffect(message, afflictionId);
    const restrictionFlags = effect?.flags?.[MODULE_ID];
    if (!effect || restrictionFlags?.tracksUnhealableDamage !== true) return false;

    const applications = { ...(restrictionFlags.unhealableDamageApplications || {}) };
    if (applications[message.id]) return false;

    applications[message.id] = hitPointLoss;
    const debt = Math.max(0, Number(restrictionFlags.unhealableDamage) || 0) + hitPointLoss;
    await effect.update({
      'system.rules': this.withDebtRule(effect.system?.rules, effect.name, debt),
      [`flags.${MODULE_ID}.unhealableDamage`]: debt,
      [`flags.${MODULE_ID}.unhealableDamageApplications`]: applications,
    });
    return true;
  }

  static async annotateHealingMessage(message) {
    const appliedDamage = getSystemFlags(message)?.appliedDamage;
    if (!appliedDamage?.isHealing || !message?.update) return false;
    if (message.flags?.[MODULE_ID]?.unhealableHealingNotice === true) return false;

    const actor = await this._findActor(message);
    if (!actor) return false;

    const effects = actor.itemTypes?.effect || Array.from(actor.items || []).filter(item => item.type === 'effect');
    const debts = effects
      .map(effect => ({
        name: effect.name || 'Affliction',
        flags: effect.flags?.[MODULE_ID],
      }))
      .filter(entry => entry.flags?.tracksUnhealableDamage === true)
      .map(entry => ({
        name: entry.name,
        amount: Math.max(0, Number(entry.flags.unhealableDamage) || 0),
      }))
      .filter(entry => entry.amount > 0);

    if (debts.length === 0) return false;

    const summary = debts.map(entry => game.i18n.format(
      'PF2E_AFFLICTIONER.CHAT.UNHEALABLE_DAMAGE_ENTRY',
      { afflictionName: escapeHTML(entry.name), amount: entry.amount },
    )).join(', ');
    const notice = game.i18n.format(
      'PF2E_AFFLICTIONER.CHAT.UNHEALABLE_DAMAGE_REMAINS',
      { summary },
    );
    const content = `${message.content || ''}
      <div class="pf2e-afflictioner-unhealable-healing-note" style="margin-top: 8px; padding: 6px 8px; border-left: 3px solid #b42318; background: rgba(180, 35, 24, 0.12);">
        <i class="fas fa-ban" style="color: #b42318;"></i> <strong>${notice}</strong>
      </div>`;

    await message.update({
      content,
      [`flags.${MODULE_ID}.unhealableHealingNotice`]: true,
    });
    return true;
  }

  static async releaseRevertedDamage(message) {
    const appliedDamage = getSystemFlags(message)?.appliedDamage;
    const afflictionId = this.getAfflictionIdFromMessage(message);
    if (!appliedDamage?.isReverted || !afflictionId || !message?.id) return false;

    const effect = await this._findEffect(message, afflictionId);
    const restrictionFlags = effect?.flags?.[MODULE_ID];
    const applications = { ...(restrictionFlags?.unhealableDamageApplications || {}) };
    const reverted = Math.max(0, Number(applications[message.id]) || 0);
    if (!effect || reverted <= 0) return false;

    delete applications[message.id];
    const debt = Math.max(0, (Number(restrictionFlags.unhealableDamage) || 0) - reverted);
    await effect.update({
      'system.rules': this.withDebtRule(effect.system?.rules, effect.name, debt),
      [`flags.${MODULE_ID}.unhealableDamage`]: debt,
      [`flags.${MODULE_ID}.unhealableDamageApplications`]: applications,
    });
    return true;
  }

  static async releaseAll(actor, affliction) {
    const effect = await this._findAfflictionEffect(actor, affliction?.id);
    if (!effect) return false;

    await effect.update({
      'system.rules': this.withDebtRule(effect.system?.rules, effect.name, 0),
      [`flags.${MODULE_ID}.tracksUnhealableDamage`]: false,
      [`flags.${MODULE_ID}.unhealableDamage`]: 0,
      [`flags.${MODULE_ID}.unhealableDamageApplications`]: {},
    });
    return true;
  }

  static async _findEffect(message, afflictionId) {
    const actor = await this._findActor(message);
    return this._findAfflictionEffect(actor, afflictionId);
  }

  static async _findActor(message) {
    const actorUuid = getSystemFlags(message)?.appliedDamage?.uuid;
    let actor = null;
    if (actorUuid && typeof globalThis.fromUuid === 'function') {
      try {
        actor = await fromUuid(actorUuid);
      } catch {
        // Fall through to speaker actor.
      }
    }
    actor ||= message?.speakerActor || message?.actor || null;
    return actor;
  }

  static async _findAfflictionEffect(actor, afflictionId) {
    if (!actor || !afflictionId) return null;
    const effects = actor.itemTypes?.effect || Array.from(actor.items || []).filter(item => item.type === 'effect');
    return effects.find(effect => effect.flags?.[MODULE_ID]?.afflictionId === afflictionId) || null;
  }
}
