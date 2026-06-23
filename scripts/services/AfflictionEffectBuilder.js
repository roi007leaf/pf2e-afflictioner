import * as AfflictionStore from '../stores/AfflictionStore.js';
import { DEFAULT_AFFLICTION_ICON, PERSISTENT_CONDITIONS } from '../constants.js';
import { getParserLocale } from '../locales/parser-locales.js';
import { getConditionPack, getConditionUuidFromEntry } from '../systemCompat.js';

export class AfflictionEffectBuilder {
  static async createOrUpdateEffect(token, actor, affliction, stage) {
    const bonuses = this.extractBonuses(stage.effects);

    if (affliction.appliedEffectUuid) {
      return await this.updateEffect(token, actor, affliction, stage, bonuses);
    }

    return await this.createEffect(token, actor, affliction, stage, bonuses);
  }

  static async createEffect(token, actor, affliction, stage, bonuses) {
    try {
      const rules = await this._buildRulesFromStage(affliction, stage, bonuses);
      const stageDesc = this._buildStageDescription(affliction, stage);
      const shouldBeUnidentified = this.shouldBeUnidentified(affliction);
      const badgeConfig = this._buildBadgeConfig(affliction);
      const durationConfig = this._buildDurationConfig(affliction, stage);

      let itemImg = affliction.img || DEFAULT_AFFLICTION_ICON;
      if (!affliction.img && affliction.sourceItemUuid) {
        try {
          const notify = ui.notifications.notify;
          ui.notifications.notify = () => { };
          const sourceItem = await fromUuid(affliction.sourceItemUuid);
          ui.notifications.notify = notify;
          if (sourceItem?.img) itemImg = sourceItem.img;
        } catch {
          ui.notifications.notify = ui.notifications.notify.bind?.(ui.notifications) || ui.notifications.notify;
        }
      }

      const effectData = {
        type: 'effect',
        name: affliction.name,
        img: itemImg,
        system: {
          description: { value: stageDesc },
          tokenIcon: { show: true },
          duration: durationConfig,
          badge: badgeConfig,
          rules: rules,
          slug: `${affliction.name.toLowerCase().replace(/\s+/g, '-')}-affliction`,
          unidentified: shouldBeUnidentified
        },
        flags: {
          'pf2e-afflictioner': {
            afflictionId: affliction.id,
            isAfflictionEffect: true
          }
        }
      };

      const [created] = await actor.createEmbeddedDocuments('Item', [effectData]);
      return created?.uuid;
    } catch (error) {
      console.error('PF2e Afflictioner | Error creating effect:', error);
      return null;
    }
  }

  static async updateEffect(token, _actor, affliction, stage, bonuses) {
    try {
      const effect = await fromUuid(affliction.appliedEffectUuid);
      if (!effect) return null;

      const rules = await this._buildRulesFromStage(affliction, stage, bonuses);
      const stageDesc = this._buildStageDescription(affliction, stage);
      const shouldBeUnidentified = this.shouldBeUnidentified(affliction);
      const badgeConfig = this._buildBadgeConfig(affliction);
      const durationConfig = this._buildDurationConfig(affliction, stage);

      if (!shouldBeUnidentified && !affliction.hasBeenIdentified) {
        await AfflictionStore.updateAffliction(token, affliction.id, {
          hasBeenIdentified: true
        });
      }

      const updateData = {
        'system.badge': badgeConfig,
        'system.duration': durationConfig,
        'system.rules': rules,
        'system.description.value': stageDesc,
        'system.unidentified': shouldBeUnidentified
      };
      if (affliction.img) updateData.img = affliction.img;

      await effect.update(updateData);

      return effect.uuid;
    } catch (error) {
      console.error('PF2e Afflictioner | Error updating effect:', error);
      return null;
    }
  }

  static shouldBeUnidentified(affliction) {
    if (affliction.inOnset) {
      return true;
    }

    if (affliction.hasBeenIdentified) {
      return false;
    }

    const currentStageIndex = affliction.currentStage - 1;
    if (currentStageIndex < 0 || !affliction.stages || !affliction.stages[currentStageIndex]) {
      return true;
    }

    const currentStage = affliction.stages[currentStageIndex];
    const hasConditions = currentStage.conditions && currentStage.conditions.length > 0;
    const hasWeakness = currentStage.weakness && currentStage.weakness.length > 0;
    const hasDamage = currentStage.damage && currentStage.damage.length > 0;

    const hasVisibleEffects = hasConditions || hasWeakness || hasDamage;

    return !hasVisibleEffects;
  }

  static _normalizeUnit(unit) {
    if (unit === 'round') return 'rounds';
    if (unit === 'minute') return 'minutes';
    if (unit === 'hour') return 'hours';
    if (unit === 'day') return 'days';
    if (unit === 'week') return 'weeks';
    return unit;
  }

  static _buildDurationConfig(affliction, stage) {
    if (affliction.inOnset && stage.duration && typeof stage.duration === 'object' && stage.duration.value) {
      return {
        value: stage.duration.value,
        unit: this._normalizeUnit(stage.duration.unit || 'rounds'),
        expiry: 'turn-start',
        sustained: false
      };
    }

    return {
      value: -1,
      unit: 'unlimited',
      expiry: null,
      sustained: false
    };
  }

  static _buildBadgeConfig(affliction) {
    if (affliction.inOnset || affliction.currentStage < 1) {
      return null;
    }

    return {
      type: 'counter',
      value: affliction.currentStage,
      min: 1,
      max: affliction.stages?.length || 4
    };
  }

  static _buildStageDescription(affliction, stage) {
    if (affliction.inOnset) {
      return '<p><strong>Onset</strong></p>';
    }

    if (stage?.rawText) {
      return `<p>${stage.rawText}</p>`;
    }

    return `<p>Stage ${affliction.currentStage}</p>`;
  }

  static async _buildRulesFromStage(affliction, stage, bonuses) {
    const rules = [];

    if (Array.isArray(stage.ruleElements)) {
      rules.push(...stage.ruleElements.map(rule => this._cloneRuleElement(rule)));
    }

    for (const bonus of bonuses) {
      const rule = {
        key: 'FlatModifier',
        selector: bonus.selector,
        type: bonus.type,
        value: bonus.value,
        label: affliction.name
      };
      if (bonus.predicate) rule.predicate = bonus.predicate;
      this._pushRuleIfNew(rules, rule);
    }

    if (stage.weakness && stage.weakness.length > 0) {
      for (const weak of stage.weakness) {
        rules.push({
          key: 'Weakness',
          type: weak.type,
          value: weak.value,
          label: `${affliction.name} (Weakness)`
        });
      }
    }

    if (stage.conditions && stage.conditions.length > 0) {
      for (const condition of stage.conditions) {
        if (condition.name === 'persistent damage' || condition.name === 'persistent-damage') continue;
        if (condition.duration) continue;
        if (PERSISTENT_CONDITIONS.includes(condition.name)) continue;

        const conditionUuid = await this.getConditionUuid(condition.name);
        if (conditionUuid) {
          const grantRule = {
            key: 'GrantItem',
            uuid: conditionUuid,
            allowDuplicate: true,
            inMemoryOnly: true,
            onDeleteActions: { grantee: 'restrict' }
          };

          if (condition.value) {
            grantRule.alterations = [{
              mode: 'override',
              property: 'badge-value',
              value: condition.value
            }];
          }

          rules.push(grantRule);
        }
      }
    }

    return rules;
  }

  static _pushRuleIfNew(rules, rule) {
    const flatModifierKey = candidate => {
      if (candidate?.key !== 'FlatModifier') return null;
      return JSON.stringify({
        key: candidate.key,
        selector: candidate.selector,
        type: candidate.type,
        value: candidate.value,
        predicate: candidate.predicate || [],
      });
    };

    const ruleKey = flatModifierKey(rule);
    if (ruleKey && rules.some(existing => flatModifierKey(existing) === ruleKey)) return;

    rules.push(rule);
  }

  static _cloneRuleElement(rule) {
    return globalThis.foundry?.utils?.deepClone
      ? foundry.utils.deepClone(rule)
      : JSON.parse(JSON.stringify(rule));
  }

  static extractBonuses(effectText) {
    if (!effectText) return [];
    const bonuses = [];

    const bonusMatch = effectText.match(/([+-]\d+)\s+(item|circumstance|status)\s+bonus\s+to\s+([^(]+)/gi);
    if (bonusMatch) {
      for (const match of bonusMatch) {
        const parts = match.match(/([+-]\d+)\s+(\w+)\s+bonus\s+to\s+(.+)/i);
        if (parts) {
          const value = parseInt(parts[1]);
          const type = parts[2].toLowerCase();
          const targetText = parts[3];

          const targets = targetText.split(/,\s*(?:and\s+)?|\s+and\s+/);

          for (const target of targets) {
            const trimmed = target.trim();
            if (!trimmed) continue;

            bonuses.push({
              value: value,
              type: type,
              selector: this.parseSelector(trimmed),
              predicate: this.parsePredicate(trimmed)
            });
          }
        }
      }
    }

    // Status/circumstance/item penalties: "–2 status penalty to checks made to Recall Knowledge"
    // Supports en-dash \u2013, em-dash \u2014, and ASCII hyphen.
    const penaltyRe = /[\u2013\u2014-](\d+)\s+(item|circumstance|status)\s+penalty\s+to\s+([^(]+)/gi;
    for (const match of effectText.matchAll(penaltyRe)) {
      const value = -parseInt(match[1]);
      const type = match[2].toLowerCase();
      const targetText = match[3];

      const targets = targetText.split(/,\s*(?:and\s+)?|\s+and\s+/);
      for (const target of targets) {
        const trimmed = target.trim().replace(/\s+checks?$/i, '').replace(/\s+made$/i, '');
        if (!trimmed) continue;

        bonuses.push({
          value,
          type,
          selector: this.parseSelector(trimmed),
          predicate: this.parsePredicate(trimmed)
        });
      }
    }

    // Speed penalties (locale-aware)
    for (const { regex, valueGroup } of getParserLocale().speedPenaltyPatterns) {
      regex.lastIndex = 0;
      let speedMatch;
      while ((speedMatch = regex.exec(effectText)) !== null) {
        bonuses.push({
          value: -parseInt(speedMatch[valueGroup]),
          type: 'status',
          selector: 'all-speeds'
        });
      }
    }

    return bonuses;
  }

  static parseSelector(text) {
    const lower = text.toLowerCase().trim();

    if (lower.includes('saving throw') || lower.includes('saves')) {
      if (lower.includes('fortitude')) return 'fortitude';
      if (lower.includes('reflex')) return 'reflex';
      if (lower.includes('will')) return 'will';
      return 'saving-throw';
    }

    if (lower.includes('armor class') || /\bac\b/.test(lower)) return 'ac';
    if (lower.includes('attack')) return 'attack-roll';
    if (lower.includes('weapon') || lower.includes('unarmed')) return 'attack-roll';
    if (lower.includes('perception')) return 'perception';
    if (lower.includes('acrobatics')) return 'acrobatics';
    if (lower.includes('athletics')) return 'athletics';
    if (lower.includes('recall knowledge')) return 'skill-check';
    if (lower.includes('skill') || lower.includes('check')) return 'skill-check';

    return 'attack-roll';
  }

  static parsePredicate(text) {
    const lower = text.toLowerCase().trim();
    const predicates = [];

    if (lower.includes('against mental')) predicates.push('item:trait:mental');
    if (lower.includes('against emotion')) predicates.push('item:trait:emotion');
    if (lower.includes('against fear')) predicates.push('item:trait:fear');
    if (lower.includes('against poison')) predicates.push('item:trait:poison');
    if (lower.includes('against disease')) predicates.push('item:trait:disease');
    if (lower.includes('recall knowledge')) predicates.push('action:recall-knowledge');

    return predicates.length > 0 ? predicates : undefined;
  }

  static async applyPersistentDamage(actor, affliction, stage) {
    if (!stage.conditions) return;

    for (const condition of stage.conditions) {
      if (condition.name !== 'persistent damage' && condition.name !== 'persistent-damage') continue;

      const formula = condition.persistentFormula || '1d6';
      const damageType = condition.persistentType || 'untyped';
      const dc = affliction.dc || 15;

      const baseCondition = game.pf2e.ConditionManager.getCondition('persistent-damage');
      if (!baseCondition) {
        console.warn('PF2e Afflictioner | Could not find persistent-damage condition');
        continue;
      }

      await this.removePersistentDamage(actor, affliction.id, damageType);

      const source = foundry.utils.mergeObject(baseCondition.toObject(), {
        system: { persistent: { formula, damageType, dc } },
        flags: { 'pf2e-afflictioner': { afflictionId: affliction.id, persistentDamage: true } }
      });

      await actor.createEmbeddedDocuments('Item', [source]);
    }
  }

  static async removePersistentDamage(actor, afflictionId, damageType = null) {
    const persistentConditions = actor.itemTypes.condition.filter(c =>
      c.slug === 'persistent-damage' &&
      c.flags?.['pf2e-afflictioner']?.afflictionId === afflictionId &&
      c.flags?.['pf2e-afflictioner']?.persistentDamage === true &&
      (damageType === null || c.system?.persistent?.damageType === damageType)
    );

    for (const condition of persistentConditions) {
      await condition.delete();
    }
  }

  static async applyPersistentConditions(actor, affliction, stage) {
    if (!stage.conditions) return;

    for (const condition of stage.conditions) {
      if (!condition.duration && !PERSISTENT_CONDITIONS.includes(condition.name)) continue;

      const slug = condition.name.toLowerCase();
      const conditionUuid = await this.getConditionUuid(slug);
      if (!conditionUuid) continue;

      const existing = actor.itemTypes.condition.find(c => c.slug === slug);

      if (existing) {
        if (condition.value && existing.value < condition.value) {
          await existing.update({ 'system.value.value': condition.value });
        }
        continue;
      }

      const conditionItem = await fromUuid(conditionUuid);
      if (!conditionItem) continue;

      const source = conditionItem.toObject();
      source.flags = source.flags || {};
      source.flags['pf2e-afflictioner'] = { afflictionId: affliction.id, persistentCondition: true };

      if (condition.value) {
        foundry.utils.setProperty(source, 'system.value.value', condition.value);
      }

      if (condition.duration) {
        source.system = source.system || {};
        source.system.duration = this._buildConditionDurationConfig(condition.duration);
      }

      await actor.createEmbeddedDocuments('Item', [source]);
    }
  }

  static _buildConditionDurationConfig(duration) {
    if (!duration) return null;
    return {
      value: duration.value ?? -1,
      unit: this._normalizeUnit(duration.unit || 'round'),
      expiry: 'turn-start',
      sustained: false
    };
  }

  static async getConditionUuid(conditionName) {
    const slug = this.normalizeConditionSlug(conditionName);
    if (!slug) return null;

    const conditionManager = game.pf2e?.ConditionManager;
    if (conditionManager?.getCondition) {
      try {
        const condition = conditionManager.getCondition(slug);
        const uuid = condition?.uuid || condition?.sourceId || condition?._stats?.compendiumSource;
        if (uuid) return uuid;
      } catch {
        // Fall back to compendium index lookup below.
      }
    }

    const pack = getConditionPack();
    if (!pack) {
      console.warn('PF2e Afflictioner | Could not find conditions compendium');
      return null;
    }

    let index;
    try {
      index = await pack.getIndex({ fields: ['system.slug'] });
    } catch {
      index = await pack.getIndex();
    }

    const entry = index.find(i =>
      this.normalizeConditionSlug(i.name) === slug ||
      this.normalizeConditionSlug(i.system?.slug) === slug
    );

    if (!entry) {
      console.warn(`PF2e Afflictioner | Condition "${conditionName}" not found in compendium`);
      return null;
    }

    return getConditionUuidFromEntry(pack, entry._id);
  }

  static normalizeConditionSlug(conditionName) {
    return String(conditionName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
}
