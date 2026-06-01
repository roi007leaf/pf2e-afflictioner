import { VALUELESS_CONDITIONS } from '../constants.js';

export class StageEditorDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'pf2e-afflictioner-stage-editor',
    classes: ['pf2e-afflictioner', 'stage-editor'],
    tag: 'form',
    window: {
      title: game.i18n.format('PF2E_AFFLICTIONER.EDITOR.STAGE_EDITOR_TITLE'),
      icon: 'fas fa-edit',
      resizable: true
    },
    position: {
      width: 600,
      height: 'auto'
    },
    actions: {
      parseEffectsText: StageEditorDialog.parseEffectsText,
      addDamage: StageEditorDialog.addDamage,
      removeDamage: StageEditorDialog.removeDamage,
      addCondition: StageEditorDialog.addCondition,
      removeCondition: StageEditorDialog.removeCondition,
      addWeakness: StageEditorDialog.addWeakness,
      removeWeakness: StageEditorDialog.removeWeakness,
      openEffect: StageEditorDialog.openEffect,
      addRuleElement: StageEditorDialog.addRuleElement,
      editRuleElement: StageEditorDialog.editRuleElement,
      removeRuleElement: StageEditorDialog.removeRuleElement,
      removeEffect: StageEditorDialog.removeEffect,
      removeAllEffects: StageEditorDialog.removeAllEffects,
      toggleEffectInterval: StageEditorDialog.toggleEffectInterval,
      saveStage: StageEditorDialog.saveStage,
      cancelStageEdit: StageEditorDialog.cancelStageEdit
    }
  };

  static PARTS = {
    form: {
      template: 'modules/pf2e-afflictioner/templates/stage-editor.hbs'
    }
  };

  constructor(stageData, options = {}) {
    super(options);
    this.stageData = foundry.utils.deepClone(stageData);
    this.onSave = options.onSave || null;
    this.afflictionName = options.afflictionName || 'Affliction';
    this.stageNumber = options.stageNumber || this.stageData.number;

    if (!this.stageData.damage) this.stageData.damage = [];
    if (!this.stageData.conditions) this.stageData.conditions = [];
    if (!this.stageData.weakness) this.stageData.weakness = [];
    if (!this.stageData.autoEffects) this.stageData.autoEffects = [];
    if (!this.stageData.ruleElements) this.stageData.ruleElements = [];

    this.options.window.title = game.i18n.format('PF2E_AFFLICTIONER.EDITOR.STAGE_EDITOR_TITLE', {
      number: this.stageData.number
    });
  }

  async _prepareContext(_options) {
    const effectsText = this.stageData.effects || '';

    const stageWithParsedDamage = {
      ...this.stageData,
      effects: this.stripEnrichers(effectsText),
      conditions: this.stageData.conditions.map(c => ({
        ...c,
        isValueless: VALUELESS_CONDITIONS.includes(c.name?.toLowerCase())
      })),
      damage: this.stageData.damage.map(dmg => {
        const parsed = this.parseDamageFormula(dmg.formula);
        return {
          ...dmg,
          diceCount: parsed.diceCount,
          diceType: parsed.diceType,
          bonus: parsed.bonus,
          damageType: dmg.type
        };
      }),
      parsedEnrichers: this.parseEffectEnrichers(effectsText)
    };

    return {
      stage: stageWithParsedDamage
    };
  }

  stripEnrichers(text) {
    if (!text) return '';

    let cleaned = text;

    cleaned = cleaned.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/@Damage\[[^\]]+\]/g, '');
    cleaned = cleaned.replace(/@Check\[[^\]]+\]/g, '');
    cleaned = cleaned.replace(/\s+and\s*$/g, '').trim();
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
  }

  parseEffectEnrichers(effectsText) {
    if (!effectsText) return [];

    const enrichers = [];

    const uuidMatches = effectsText.matchAll(/@UUID\[([^\]]+)\]\{([^}]+)\}/g);
    for (const match of uuidMatches) {
      const uuid = match[1];
      const label = match[2];

      let icon = 'fa-link';
      let type = 'uuid';
      if (/\.conditionitems\.Item\.|\.conditions\.Item\./.test(uuid)) {
        icon = 'fa-heartbeat';
        type = 'condition';
      } else if (uuid.includes('equipment-effects') || uuid.includes('spell-effects')) {
        icon = 'fa-magic';
        type = 'effect';
      }

      enrichers.push({
        type: type,
        label: label,
        icon: icon,
        uuid: uuid
      });
    }

    const damageMatches = effectsText.matchAll(/@Damage\[([^[]+)\[([^\]]+)\]\]/g);
    for (const match of damageMatches) {
      const formula = match[1];
      const damageType = match[2];

      enrichers.push({
        type: 'damage',
        label: damageType.charAt(0).toUpperCase() + damageType.slice(1),
        icon: 'fa-heart-broken',
        formula: formula
      });
    }

    const checkMatches = effectsText.matchAll(/@Check\[([^:]+):(\d+)\]/g);
    for (const match of checkMatches) {
      const checkType = match[1];
      const dc = match[2];

      enrichers.push({
        type: 'check',
        label: `${checkType.charAt(0).toUpperCase() + checkType.slice(1)} DC ${dc}`,
        icon: 'fa-dice-d20'
      });
    }

    return enrichers;
  }

  parseDamageFormula(formula) {
    if (!formula) return { diceCount: 1, diceType: 'd6', bonus: 0 };

    const match = formula.match(/^(\d+)(d\d+)([+-]\d+)?$/);
    if (match) {
      return {
        diceCount: parseInt(match[1]) || 1,
        diceType: match[2] || 'd6',
        bonus: match[3] ? parseInt(match[3]) : 0
      };
    }

    return { diceCount: 1, diceType: 'd6', bonus: 0 };
  }

  static async parseEffectsText(_event, _button) {
    const dialog = this;

    const textarea = dialog.element.querySelector('#stage-effects');
    if (!textarea) return;

    const text = textarea.value;
    if (!text) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.NO_EFFECTS_TO_PARSE'));
      return;
    }

    const damageMatches = text.matchAll(/(\d+d\d+(?:[+-]\d+)?)\s+(\w+)/gi);
    for (const match of damageMatches) {
      const formula = match[1];
      const type = match[2].toLowerCase();

      const validTypes = ['acid', 'bleed', 'bludgeoning', 'cold', 'electricity', 'fire', 'force', 'mental', 'piercing', 'poison', 'slashing', 'sonic', 'spirit', 'vitality', 'void', 'untyped'];
      if (validTypes.includes(type)) {
        if (!dialog.stageData.damage.some(d => d.formula === formula && d.type === type)) {
          dialog.stageData.damage.push({ formula, type });
        }
      }
    }

    const conditionPattern = /(blinded|clumsy|confused|dazzled|deafened|doomed|drained|dying|enfeebled|fascinated|fatigued|fleeing|frightened|grabbed|immobilized|paralyzed|prone|restrained|sickened|slowed|stunned|stupefied|unconscious|wounded)(?:\s+(\d+))?/gi;
    const conditionMatches = text.matchAll(conditionPattern);
    for (const match of conditionMatches) {
      const name = match[1].toLowerCase();
      const value = match[2] ? parseInt(match[2]) : null;

      if (!dialog.stageData.conditions.some(c => c.name === name)) {
        dialog.stageData.conditions.push({ name, value });
      }
    }

    const weaknessPatterns = [
      /weakness\s+to\s+([\w-]+)\s+(\d+)/gi,
      /weakness\s+(\d+)\s+to\s+([\w-]+)/gi,
      /(\d+)\s+weakness\s+to\s+([\w-]+)/gi,
      /([\w-]+)\s+weakness\s+(\d+)/gi
    ];

    const validTypes = [
      'acid', 'cold', 'electricity', 'fire', 'sonic', 'force', 'vitality', 'void',
      'physical', 'bludgeoning', 'piercing', 'slashing',
      'bleed', 'mental', 'poison', 'spirit', 'emotion',
      'cold-iron', 'silver', 'adamantine', 'orichalcum', 'abysium', 'dawnsilver',
      'djezet', 'duskwood', 'inubrix', 'noqual', 'peachwood', 'siccatite',
      'holy', 'unholy',
      'arcane', 'divine', 'occult', 'primal',
      'magical', 'non-magical', 'ghost-touch', 'alchemical',
      'area-damage', 'critical-hits', 'precision', 'splash-damage', 'persistent-damage',
      'spells', 'weapons', 'unarmed-attacks',
      'arrow-vulnerability', 'axe-vulnerability', 'vampire-weaknesses', 'vulnerable-to-sunlight',
      'vorpal', 'vorpal-fear', 'weapons-shedding-bright-light',
      'air', 'earth', 'water', 'salt-water', 'salt',
      'all-damage', 'energy', 'glass', 'light', 'metal', 'plant', 'radiation', 'time', 'wood'
    ];

    for (const pattern of weaknessPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let type, value;

        if (match[1] && isNaN(match[1])) {
          type = match[1].toLowerCase();
          value = parseInt(match[2]);
        } else if (match[2] && isNaN(match[2])) {
          value = parseInt(match[1]);
          type = match[2].toLowerCase();
        } else {
          type = (match[1] && isNaN(match[1])) ? match[1].toLowerCase() : match[2].toLowerCase();
          value = parseInt((match[1] && !isNaN(match[1])) ? match[1] : match[2]);
        }

        if (type === 'physical') {
          ['bludgeoning', 'piercing', 'slashing'].forEach(physType => {
            if (!dialog.stageData.weakness.some(w => w.type === physType)) {
              dialog.stageData.weakness.push({ type: physType, value });
            }
          });
        } else if (validTypes.includes(type)) {
          if (!dialog.stageData.weakness.some(w => w.type === type)) {
            dialog.stageData.weakness.push({ type, value });
          }
        }
      }
    }

    const bonusPattern = /([+-]\d+)\s+(item|circumstance|status)\s+(bonus|penalty)\s+to\s+([\w\s]+?)(?:\s+against\s+([\w\s]+?))?(?=\.|,|$|\s+and\s+)/gi;
    const bonusMatches = text.matchAll(bonusPattern);

    for (const match of bonusMatches) {
      const value = parseInt(match[1]);
      const bonusType = match[2].toLowerCase();
      const bonusPenalty = match[3].toLowerCase();
      const targetRaw = match[4].trim().toLowerCase();
      const againstRaw = match[5] ? match[5].trim().toLowerCase() : null;

      const adjustedValue = bonusPenalty === 'penalty' ? -Math.abs(value) : value;

      let selector = '';
      const predicate = [];

      const hasWord = (word) => new RegExp(`\\b${word}\\b`, 'i').test(targetRaw);

      if (hasWord('saving throw') || hasWord('save')) {
        if (hasWord('fortitude')) {
          selector = 'fortitude';
        } else if (hasWord('reflex')) {
          selector = 'reflex';
        } else if (hasWord('will')) {
          selector = 'will';
        } else {
          selector = 'saving-throw';
        }
      } else if (targetRaw.includes('attack roll') || hasWord('attack')) {
        if (hasWord('spell')) {
          selector = 'spell-attack-roll';
        } else {
          selector = 'attack-roll';
        }
      } else if (hasWord('ac') || targetRaw.includes('armor class')) {
        selector = 'ac';
      } else if (hasWord('perception')) {
        selector = 'perception';
      } else if (hasWord('initiative')) {
        selector = 'initiative';
      } else if (hasWord('damage')) {
        selector = 'damage';
      } else if (hasWord('check')) {
        if (hasWord('stealth')) {
          selector = 'stealth';
        } else if (hasWord('athletics')) {
          selector = 'athletics';
        } else if (hasWord('acrobatics')) {
          selector = 'acrobatics';
        } else if (hasWord('medicine')) {
          selector = 'medicine';
        } else if (hasWord('arcana')) {
          selector = 'arcana';
        } else if (hasWord('nature')) {
          selector = 'nature';
        } else if (hasWord('occultism')) {
          selector = 'occultism';
        } else if (hasWord('religion')) {
          selector = 'religion';
        } else if (hasWord('society')) {
          selector = 'society';
        } else if (hasWord('crafting')) {
          selector = 'crafting';
        } else if (hasWord('deception')) {
          selector = 'deception';
        } else if (hasWord('diplomacy')) {
          selector = 'diplomacy';
        } else if (hasWord('intimidation')) {
          selector = 'intimidation';
        } else if (hasWord('performance')) {
          selector = 'performance';
        } else if (hasWord('survival')) {
          selector = 'survival';
        } else if (hasWord('thievery')) {
          selector = 'thievery';
        } else {
          selector = 'skill-check';
        }
      }

      if (againstRaw) {
        if (againstRaw.includes('mental')) {
          predicate.push('item:trait:mental');
        } else if (againstRaw.includes('poison')) {
          predicate.push('item:trait:poison');
        } else if (againstRaw.includes('disease')) {
          predicate.push('item:trait:disease');
        } else if (againstRaw.includes('fire')) {
          predicate.push('item:trait:fire');
        } else if (againstRaw.includes('cold')) {
          predicate.push('item:trait:cold');
        } else if (againstRaw.includes('acid')) {
          predicate.push('item:trait:acid');
        } else if (againstRaw.includes('electricity')) {
          predicate.push('item:trait:electricity');
        } else if (againstRaw.includes('sonic')) {
          predicate.push('item:trait:sonic');
        } else if (againstRaw.includes('spell')) {
          predicate.push('item:type:spell');
        }
      }

      if (selector) {
        const label = StageEditorDialog.buildRuleElementLabel(dialog.afflictionName, dialog.stageNumber);

        const ruleElement = {
          key: 'FlatModifier',
          type: bonusType,
          selector: selector,
          value: adjustedValue,
          label: label
        };

        if (predicate.length > 0) {
          ruleElement.predicate = predicate;
        }

        const exists = dialog.stageData.ruleElements.some(re =>
          re.key === ruleElement.key &&
          re.type === ruleElement.type &&
          re.selector === ruleElement.selector &&
          re.value === ruleElement.value &&
          JSON.stringify(re.predicate || []) === JSON.stringify(ruleElement.predicate || [])
        );

        if (!exists) {
          dialog.stageData.ruleElements.push(ruleElement);
        }
      }
    }

    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECTS_PARSED'));
    await dialog.render({ force: true });
  }

  static async addDamage(_event, _button) {
    const dialog = this;

    await dialog.updateFromForm();

    dialog.stageData.damage.push({
      formula: '1d6',
      type: 'poison'
    });
    await dialog.render({ force: true });
  }

  static async removeDamage(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    dialog.stageData.damage.splice(index, 1);
    await dialog.render({ force: true });
  }

  static async addCondition(_event, _button) {
    const dialog = this;

    await dialog.updateFromForm();

    dialog.stageData.conditions.push({
      name: '',
      value: null
    });
    await dialog.render({ force: true });
  }

  static async removeCondition(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    dialog.stageData.conditions.splice(index, 1);
    await dialog.render({ force: true });
  }

  static async addWeakness(_event, _button) {
    const dialog = this;

    await dialog.updateFromForm();

    dialog.stageData.weakness.push({
      type: '',
      value: 0
    });
    await dialog.render({ force: true });
  }

  static async removeWeakness(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    dialog.stageData.weakness.splice(index, 1);
    await dialog.render({ force: true });
  }

  static async openEffect(_event, button) {
    const dialog = this;
    const uuid = button.dataset.uuid;
    if (!uuid) return;

    if (uuid.startsWith('custom-')) {
      const effectData = dialog.stageData.autoEffects.find(e => e.uuid === uuid);
      if (!effectData) return;

      const ruleElement = effectData.system?.rules?.[0];
      let ruleDetails = '<p><strong>Auto-Generated Effect Preview</strong></p>';
      ruleDetails += '<p><em>This effect will be created dynamically when the stage becomes active.</em></p>';
      ruleDetails += '<hr>';
      ruleDetails += `<p><strong>Effect Name:</strong> ${effectData.name}</p>`;

      if (ruleElement) {
        ruleDetails += '<p><strong>Rule Element:</strong></p>';
        ruleDetails += '<ul style="margin-left: 20px; line-height: 1.8;">';
        ruleDetails += `<li><strong>Type:</strong> ${ruleElement.key}</li>`;
        ruleDetails += `<li><strong>Bonus Type:</strong> ${ruleElement.type}</li>`;
        ruleDetails += `<li><strong>Selector:</strong> ${ruleElement.selector}</li>`;
        ruleDetails += `<li><strong>Value:</strong> ${ruleElement.value > 0 ? '+' : ''}${ruleElement.value}</li>`;
        if (ruleElement.predicate && ruleElement.predicate.length > 0) {
          ruleDetails += `<li><strong>Predicate:</strong> ${ruleElement.predicate.join(', ')}</li>`;
        }
        ruleDetails += '</ul>';
      }

      new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECT_PREVIEW_TITLE') },
        content: ruleDetails,
        buttons: [{
          action: 'ok',
          label: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CLOSE'),
          default: true
        }],
        modal: true
      }).render(true);

      return;
    }

    try {
      const effect = await fromUuid(uuid);
      if (effect && effect.sheet) {
        effect.sheet.render(true);
      } else {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.EFFECT_NOT_FOUND'));
      }
    } catch (error) {
      console.error('StageEditorDialog: Error opening effect', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.FAILED_OPEN_EFFECT'));
    }
  }

  static async addRuleElement(_event, button) {
    const dialog = this;

    const content = `
      <form>
        <div class="form-group">
          <label>Bonus Type</label>
          <select name="type" required>
            <option value="item">Item</option>
            <option value="circumstance">Circumstance</option>
            <option value="status">Status</option>
          </select>
        </div>

        <div class="form-group">
          <label>Value (use negative for penalties)</label>
          <input type="number" name="value" value="1" required />
        </div>

        <div class="form-group">
          <label>Applies To (Selector)</label>
          <select name="selector" required>
            <optgroup label="Saves">
              <option value="saving-throw">All Saves</option>
              <option value="fortitude">Fortitude</option>
              <option value="reflex">Reflex</option>
              <option value="will">Will</option>
            </optgroup>
            <optgroup label="Defense">
              <option value="ac">AC</option>
              <option value="perception">Perception</option>
            </optgroup>
            <optgroup label="Offense">
              <option value="attack-roll">Attack Rolls</option>
              <option value="spell-attack-roll">Spell Attack Rolls</option>
              <option value="damage">Damage</option>
            </optgroup>
            <optgroup label="Skills">
              <option value="skill-check">All Skills</option>
              <option value="acrobatics">Acrobatics</option>
              <option value="arcana">Arcana</option>
              <option value="athletics">Athletics</option>
              <option value="crafting">Crafting</option>
              <option value="deception">Deception</option>
              <option value="diplomacy">Diplomacy</option>
              <option value="intimidation">Intimidation</option>
              <option value="medicine">Medicine</option>
              <option value="nature">Nature</option>
              <option value="occultism">Occultism</option>
              <option value="performance">Performance</option>
              <option value="religion">Religion</option>
              <option value="society">Society</option>
              <option value="stealth">Stealth</option>
              <option value="survival">Survival</option>
              <option value="thievery">Thievery</option>
            </optgroup>
            <optgroup label="Other">
              <option value="initiative">Initiative</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label>Condition/Predicate (Optional)</label>
          <select name="predicate">
            <option value="">Always Active</option>
            <optgroup label="Item Damage Traits">
              <option value="item:trait:fire">Against Fire</option>
              <option value="item:trait:cold">Against Cold</option>
              <option value="item:trait:acid">Against Acid</option>
              <option value="item:trait:electricity">Against Electricity</option>
              <option value="item:trait:sonic">Against Sonic</option>
              <option value="item:trait:mental">Against Mental</option>
              <option value="item:trait:poison">Against Poison</option>
            </optgroup>
            <optgroup label="Item Effect Traits">
              <option value="item:trait:disease">Against Disease</option>
              <option value="item:trait:fear">Against Fear</option>
              <option value="item:trait:visual">Against Visual</option>
              <option value="item:trait:auditory">Against Auditory</option>
              <option value="item:trait:linguistic">Against Linguistic</option>
              <option value="item:trait:emotion">Against Emotion</option>
            </optgroup>
            <optgroup label="Item Types">
              <option value="item:type:spell">Against Spells</option>
              <option value="item:type:weapon">Against Weapons</option>
              <option value="item:ranged">Against Ranged</option>
              <option value="item:melee">Against Melee</option>
            </optgroup>
            <optgroup label="Attack Traits">
              <option value="attack:trait:ranged">On Ranged Attacks</option>
              <option value="attack:trait:melee">On Melee Attacks</option>
            </optgroup>
            <optgroup label="Self Conditions">
              <option value="self:condition:frightened">While Frightened</option>
              <option value="self:condition:sickened">While Sickened</option>
              <option value="self:condition:off-guard">While Off-Guard</option>
              <option value="self:condition:hidden">While Hidden</option>
              <option value="self:condition:concealed">While Concealed</option>
            </optgroup>
            <optgroup label="Target Conditions">
              <option value="target:condition:off-guard">Against Off-Guard</option>
              <option value="target:condition:frightened">Against Frightened</option>
              <option value="target:condition:prone">Against Prone</option>
            </optgroup>
            <optgroup label="Target Traits">
              <option value="target:trait:dragon">Against Dragons</option>
              <option value="target:trait:undead">Against Undead</option>
              <option value="target:trait:demon">Against Demons</option>
              <option value="target:trait:devil">Against Devils</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label>Custom Predicate (Optional)</label>
          <input type="text" name="customPredicate" placeholder="e.g., attack:trait:ranged or self:condition:hidden" />
          <small style="display: block; margin-top: 4px; color: #888; font-size: 11px;">
            Use custom predicate syntax if the dropdown doesn't have what you need. This will override the dropdown selection.
          </small>
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ADD_RULE_ELEMENT_TITLE') },
      content: content,
      ok: {
        label: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ADD_RULE_ELEMENT_BTN'),
        callback: (_event, button) => new FormDataExtended(button.form).object
      },
      rejectClose: false
    });

    if (!result) return;

    const finalPredicate = result.customPredicate?.trim() || result.predicate;
    const label = StageEditorDialog.buildRuleElementLabel(dialog.afflictionName, dialog.stageNumber);

    const ruleElement = {
      key: 'FlatModifier',
      type: result.type,
      selector: result.selector,
      value: parseInt(result.value),
      label: label
    };

    if (finalPredicate) {
      ruleElement.predicate = [finalPredicate];
    }

    dialog.stageData.ruleElements.push(ruleElement);

    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RULE_ELEMENT_ADDED'));
    await dialog.render({ force: true });
  }

  static getCustomPredicateValue(ruleElement) {
    if (!ruleElement.predicate || ruleElement.predicate.length === 0) return '';

    const predicate = ruleElement.predicate[0];

    const dropdownValues = [
      'item:trait:fire',
      'item:trait:cold',
      'item:trait:acid',
      'item:trait:electricity',
      'item:trait:sonic',
      'item:trait:mental',
      'item:trait:poison',
      'item:trait:disease',
      'item:trait:fear',
      'item:trait:visual',
      'item:trait:auditory',
      'item:trait:linguistic',
      'item:trait:emotion',
      'item:type:spell',
      'item:type:weapon',
      'item:ranged',
      'item:melee',
      'attack:trait:ranged',
      'attack:trait:melee',
      'self:condition:frightened',
      'self:condition:sickened',
      'self:condition:off-guard',
      'self:condition:hidden',
      'self:condition:concealed',
      'target:condition:off-guard',
      'target:condition:frightened',
      'target:condition:prone',
      'target:trait:dragon',
      'target:trait:undead',
      'target:trait:demon',
      'target:trait:devil'
    ];

    return dropdownValues.includes(predicate) ? '' : predicate;
  }

  static async editRuleElement(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    const ruleElement = dialog.stageData.ruleElements[index];

    if (!ruleElement) return;

    const content = `
      <form>
        <div class="form-group">
          <label>Bonus Type</label>
          <select name="type" required>
            <option value="item" ${ruleElement.type === 'item' ? 'selected' : ''}>Item</option>
            <option value="circumstance" ${ruleElement.type === 'circumstance' ? 'selected' : ''}>Circumstance</option>
            <option value="status" ${ruleElement.type === 'status' ? 'selected' : ''}>Status</option>
          </select>
        </div>

        <div class="form-group">
          <label>Value (use negative for penalties)</label>
          <input type="number" name="value" value="${ruleElement.value}" required />
        </div>

        <div class="form-group">
          <label>Applies To (Selector)</label>
          <select name="selector" required>
            <optgroup label="Saves">
              <option value="saving-throw" ${ruleElement.selector === 'saving-throw' ? 'selected' : ''}>All Saves</option>
              <option value="fortitude" ${ruleElement.selector === 'fortitude' ? 'selected' : ''}>Fortitude</option>
              <option value="reflex" ${ruleElement.selector === 'reflex' ? 'selected' : ''}>Reflex</option>
              <option value="will" ${ruleElement.selector === 'will' ? 'selected' : ''}>Will</option>
            </optgroup>
            <optgroup label="Defense">
              <option value="ac" ${ruleElement.selector === 'ac' ? 'selected' : ''}>AC</option>
              <option value="perception" ${ruleElement.selector === 'perception' ? 'selected' : ''}>Perception</option>
            </optgroup>
            <optgroup label="Offense">
              <option value="attack-roll" ${ruleElement.selector === 'attack-roll' ? 'selected' : ''}>Attack Rolls</option>
              <option value="spell-attack-roll" ${ruleElement.selector === 'spell-attack-roll' ? 'selected' : ''}>Spell Attack Rolls</option>
              <option value="damage" ${ruleElement.selector === 'damage' ? 'selected' : ''}>Damage</option>
            </optgroup>
            <optgroup label="Skills">
              <option value="skill-check" ${ruleElement.selector === 'skill-check' ? 'selected' : ''}>All Skills</option>
              <option value="acrobatics" ${ruleElement.selector === 'acrobatics' ? 'selected' : ''}>Acrobatics</option>
              <option value="arcana" ${ruleElement.selector === 'arcana' ? 'selected' : ''}>Arcana</option>
              <option value="athletics" ${ruleElement.selector === 'athletics' ? 'selected' : ''}>Athletics</option>
              <option value="crafting" ${ruleElement.selector === 'crafting' ? 'selected' : ''}>Crafting</option>
              <option value="deception" ${ruleElement.selector === 'deception' ? 'selected' : ''}>Deception</option>
              <option value="diplomacy" ${ruleElement.selector === 'diplomacy' ? 'selected' : ''}>Diplomacy</option>
              <option value="intimidation" ${ruleElement.selector === 'intimidation' ? 'selected' : ''}>Intimidation</option>
              <option value="medicine" ${ruleElement.selector === 'medicine' ? 'selected' : ''}>Medicine</option>
              <option value="nature" ${ruleElement.selector === 'nature' ? 'selected' : ''}>Nature</option>
              <option value="occultism" ${ruleElement.selector === 'occultism' ? 'selected' : ''}>Occultism</option>
              <option value="performance" ${ruleElement.selector === 'performance' ? 'selected' : ''}>Performance</option>
              <option value="religion" ${ruleElement.selector === 'religion' ? 'selected' : ''}>Religion</option>
              <option value="society" ${ruleElement.selector === 'society' ? 'selected' : ''}>Society</option>
              <option value="stealth" ${ruleElement.selector === 'stealth' ? 'selected' : ''}>Stealth</option>
              <option value="survival" ${ruleElement.selector === 'survival' ? 'selected' : ''}>Survival</option>
              <option value="thievery" ${ruleElement.selector === 'thievery' ? 'selected' : ''}>Thievery</option>
            </optgroup>
            <optgroup label="Other">
              <option value="initiative" ${ruleElement.selector === 'initiative' ? 'selected' : ''}>Initiative</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label>Condition/Predicate (Optional)</label>
          <select name="predicate">
            <option value="" ${!ruleElement.predicate || ruleElement.predicate.length === 0 ? 'selected' : ''}>Always Active</option>
            <optgroup label="Item Damage Traits">
              <option value="item:trait:fire" ${ruleElement.predicate?.[0] === 'item:trait:fire' ? 'selected' : ''}>Against Fire</option>
              <option value="item:trait:cold" ${ruleElement.predicate?.[0] === 'item:trait:cold' ? 'selected' : ''}>Against Cold</option>
              <option value="item:trait:acid" ${ruleElement.predicate?.[0] === 'item:trait:acid' ? 'selected' : ''}>Against Acid</option>
              <option value="item:trait:electricity" ${ruleElement.predicate?.[0] === 'item:trait:electricity' ? 'selected' : ''}>Against Electricity</option>
              <option value="item:trait:sonic" ${ruleElement.predicate?.[0] === 'item:trait:sonic' ? 'selected' : ''}>Against Sonic</option>
              <option value="item:trait:mental" ${ruleElement.predicate?.[0] === 'item:trait:mental' ? 'selected' : ''}>Against Mental</option>
              <option value="item:trait:poison" ${ruleElement.predicate?.[0] === 'item:trait:poison' ? 'selected' : ''}>Against Poison</option>
            </optgroup>
            <optgroup label="Item Effect Traits">
              <option value="item:trait:disease" ${ruleElement.predicate?.[0] === 'item:trait:disease' ? 'selected' : ''}>Against Disease</option>
              <option value="item:trait:fear" ${ruleElement.predicate?.[0] === 'item:trait:fear' ? 'selected' : ''}>Against Fear</option>
              <option value="item:trait:visual" ${ruleElement.predicate?.[0] === 'item:trait:visual' ? 'selected' : ''}>Against Visual</option>
              <option value="item:trait:auditory" ${ruleElement.predicate?.[0] === 'item:trait:auditory' ? 'selected' : ''}>Against Auditory</option>
              <option value="item:trait:linguistic" ${ruleElement.predicate?.[0] === 'item:trait:linguistic' ? 'selected' : ''}>Against Linguistic</option>
              <option value="item:trait:emotion" ${ruleElement.predicate?.[0] === 'item:trait:emotion' ? 'selected' : ''}>Against Emotion</option>
            </optgroup>
            <optgroup label="Item Types">
              <option value="item:type:spell" ${ruleElement.predicate?.[0] === 'item:type:spell' ? 'selected' : ''}>Against Spells</option>
              <option value="item:type:weapon" ${ruleElement.predicate?.[0] === 'item:type:weapon' ? 'selected' : ''}>Against Weapons</option>
              <option value="item:ranged" ${ruleElement.predicate?.[0] === 'item:ranged' ? 'selected' : ''}>Against Ranged</option>
              <option value="item:melee" ${ruleElement.predicate?.[0] === 'item:melee' ? 'selected' : ''}>Against Melee</option>
            </optgroup>
            <optgroup label="Attack Traits">
              <option value="attack:trait:ranged" ${ruleElement.predicate?.[0] === 'attack:trait:ranged' ? 'selected' : ''}>On Ranged Attacks</option>
              <option value="attack:trait:melee" ${ruleElement.predicate?.[0] === 'attack:trait:melee' ? 'selected' : ''}>On Melee Attacks</option>
            </optgroup>
            <optgroup label="Self Conditions">
              <option value="self:condition:frightened" ${ruleElement.predicate?.[0] === 'self:condition:frightened' ? 'selected' : ''}>While Frightened</option>
              <option value="self:condition:sickened" ${ruleElement.predicate?.[0] === 'self:condition:sickened' ? 'selected' : ''}>While Sickened</option>
              <option value="self:condition:off-guard" ${ruleElement.predicate?.[0] === 'self:condition:off-guard' ? 'selected' : ''}>While Off-Guard</option>
              <option value="self:condition:hidden" ${ruleElement.predicate?.[0] === 'self:condition:hidden' ? 'selected' : ''}>While Hidden</option>
              <option value="self:condition:concealed" ${ruleElement.predicate?.[0] === 'self:condition:concealed' ? 'selected' : ''}>While Concealed</option>
            </optgroup>
            <optgroup label="Target Conditions">
              <option value="target:condition:off-guard" ${ruleElement.predicate?.[0] === 'target:condition:off-guard' ? 'selected' : ''}>Against Off-Guard</option>
              <option value="target:condition:frightened" ${ruleElement.predicate?.[0] === 'target:condition:frightened' ? 'selected' : ''}>Against Frightened</option>
              <option value="target:condition:prone" ${ruleElement.predicate?.[0] === 'target:condition:prone' ? 'selected' : ''}>Against Prone</option>
            </optgroup>
            <optgroup label="Target Traits">
              <option value="target:trait:dragon" ${ruleElement.predicate?.[0] === 'target:trait:dragon' ? 'selected' : ''}>Against Dragons</option>
              <option value="target:trait:undead" ${ruleElement.predicate?.[0] === 'target:trait:undead' ? 'selected' : ''}>Against Undead</option>
              <option value="target:trait:demon" ${ruleElement.predicate?.[0] === 'target:trait:demon' ? 'selected' : ''}>Against Demons</option>
              <option value="target:trait:devil" ${ruleElement.predicate?.[0] === 'target:trait:devil' ? 'selected' : ''}>Against Devils</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label>Custom Predicate (Optional)</label>
          <input type="text" name="customPredicate" value="${StageEditorDialog.getCustomPredicateValue(ruleElement)}" placeholder="e.g., attack:trait:ranged or self:condition:hidden" />
          <small style="display: block; margin-top: 4px; color: #888; font-size: 11px;">
            Use custom predicate syntax if the dropdown doesn't have what you need. This will override the dropdown selection.
          </small>
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EDIT_RULE_ELEMENT_TITLE') },
      content: content,
      ok: {
        label: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EDIT_RULE_ELEMENT_BTN'),
        callback: (_event, button) => new FormDataExtended(button.form).object
      },
      rejectClose: false
    });

    if (!result) return;

    const finalPredicate = result.customPredicate?.trim() || result.predicate;
    const label = StageEditorDialog.buildRuleElementLabel(dialog.afflictionName, dialog.stageNumber);

    dialog.stageData.ruleElements[index] = {
      key: 'FlatModifier',
      type: result.type,
      selector: result.selector,
      value: parseInt(result.value),
      label: label
    };

    if (finalPredicate) {
      dialog.stageData.ruleElements[index].predicate = [finalPredicate];
    }

    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RULE_ELEMENT_UPDATED'));
    await dialog.render({ force: true });
  }

  static async removeRuleElement(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.REMOVE_RULE_ELEMENT_TITLE') },
      content: `<p>${game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.REMOVE_RULE_ELEMENT_CONTENT')}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    dialog.stageData.ruleElements.splice(index, 1);
    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RULE_ELEMENT_REMOVED'));
    await dialog.render({ force: true });
  }

  static async removeEffect(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    dialog.stageData.autoEffects.splice(index, 1);
    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECT_REMOVED'));
    await dialog.render({ force: true });
  }

  static async removeAllEffects(_event, _button) {
    const dialog = this;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CLEAR_ALL_EFFECTS_TITLE'),
      content: `<p>${game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CLEAR_ALL_EFFECTS_CONTENT')}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    dialog.stageData.autoEffects = [];
    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECTS_CLEARED'));
    await dialog.render({ force: true });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    const element = this.element;
    if (!element) return;

    const dropZone = element.querySelector('.effects-drop-zone');
    if (dropZone) {
      dropZone.removeEventListener('drop', this._boundOnDropEffect);
      dropZone.removeEventListener('dragover', this._boundOnDragOver);
      dropZone.removeEventListener('dragleave', this._boundOnDragLeave);

      this._boundOnDropEffect = this._onDropEffect.bind(this);
      this._boundOnDragOver = this._onDragOver.bind(this);
      this._boundOnDragLeave = this._onDragLeave.bind(this);

      dropZone.addEventListener('drop', this._boundOnDropEffect);
      dropZone.addEventListener('dragover', this._boundOnDragOver);
      dropZone.addEventListener('dragleave', this._boundOnDragLeave);
    }
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    event.currentTarget.classList.add('drag-over');
  }

  _onDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      event.currentTarget.classList.remove('drag-over');
    }
  }

  async _onDropEffect(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }

    if (data.type !== 'Item') {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ONLY_EFFECT_ITEMS'));
      return;
    }

    const item = await fromUuid(data.uuid);
    if (!item) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.COULD_NOT_LOAD_EFFECT'));
      return;
    }

    if (item.type !== 'effect') {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ONLY_EFFECT_ITEMS_ADD'));
      return;
    }

    if (this.stageData.autoEffects.some(e => e.uuid === item.uuid)) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.EFFECT_ALREADY_ADDED'));
      return;
    }

    this.stageData.autoEffects.push({
      uuid: item.uuid,
      name: item.name,
      img: item.img
    });

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.ADDED_EFFECT', { name: item.name }));
    await this.render({ force: true });
  }

  async updateFromForm() {
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(this.element).object;

    if (formData.effects !== undefined) {
      this.stageData.effects = formData.effects || '';
    }

    if (formData.duration) {
      this.stageData.duration = {
        value: parseInt(formData.duration.value) || 1,
        unit: formData.duration.unit || 'day'
      };
    } else if (formData['duration.value'] !== undefined || formData['duration.unit'] !== undefined) {
      this.stageData.duration = {
        value: parseInt(formData['duration.value']) || 1,
        unit: formData['duration.unit'] || 'day'
      };
    }

    if (formData['effectInterval.value'] !== undefined || formData.effectInterval) {
      const effectValue = parseInt(formData['effectInterval.value'] || formData.effectInterval?.value);
      const effectUnit = formData['effectInterval.unit'] || formData.effectInterval?.unit || 'hour';
      if (effectValue > 0) {
        this.stageData.effectInterval = { value: effectValue, unit: effectUnit };
      } else {
        this.stageData.effectInterval = null;
      }
    }

    const damageArray = this.constructor.collectIndexedFormEntries(formData, 'damage', [
      'diceCount',
      'diceType',
      'bonus',
      'damageType',
    ]);

    if (damageArray.length > 0) {
      this.stageData.damage = damageArray
        .filter(d => d.diceType && d.damageType)
        .map(d => {
          const diceCount = parseInt(d.diceCount) || 1;
          const bonus = parseInt(d.bonus) || 0;
          let formula = `${diceCount}${d.diceType}`;
          if (bonus > 0) {
            formula += `+${bonus}`;
          } else if (bonus < 0) {
            formula += `${bonus}`;
          }

          return {
            formula: formula,
            type: d.damageType
          };
        });
    }

    const conditionArray = this.constructor.collectIndexedFormEntries(formData, 'condition', [
      'name',
      'value',
      'persistentFormula',
      'persistentType',
    ]);

    if (conditionArray.length > 0) {
      this.stageData.conditions = conditionArray
        .filter(c => c.name)
        .map(c => {
          const condition = {
            name: c.name
          };

          if (c.name === 'persistent damage') {
            condition.persistentFormula = c.persistentFormula || '1d6';
            condition.persistentType = c.persistentType || 'fire';
            condition.value = null;
          } else if (VALUELESS_CONDITIONS.includes(c.name?.toLowerCase())) {
            condition.value = null;
          } else {
            condition.value = c.value !== undefined && c.value !== '' ? parseInt(c.value) : null;
          }

          return condition;
        });
    }

    const weaknessArray = this.constructor.collectIndexedFormEntries(formData, 'weakness', [
      'type',
      'value',
    ]);

    if (weaknessArray.length > 0) {
      this.stageData.weakness = weaknessArray
        .filter(w => w.type && w.value)
        .map(w => ({
          type: w.type,
          value: parseInt(w.value) || 0
        }));
    }
  }

  static collectIndexedFormEntries(formData, fieldName, fields) {
    const nested = formData[fieldName];

    if (Array.isArray(nested)) return nested;

    if (nested && typeof nested === 'object') {
      if (fields.some(field => nested[field] !== undefined)) return [nested];

      return Object.entries(nested)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, value]) => value)
        .filter(value => value && typeof value === 'object');
    }

    const entries = [];
    let index = 0;
    while (fields.some(field => formData[`${fieldName}.${index}.${field}`] !== undefined)) {
      const entry = {};
      for (const field of fields) {
        entry[field] = formData[`${fieldName}.${index}.${field}`];
      }
      entries.push(entry);
      index++;
    }

    return entries;
  }

  static async toggleEffectInterval(_event, _button) {
    const dialog = this;

    if (dialog.stageData.effectInterval && dialog.stageData.effectInterval.value > 0) {
      dialog.stageData.effectInterval = null;
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECT_INTERVAL_REMOVED'));
    } else {
      dialog.stageData.effectInterval = {
        value: 6,
        unit: 'hour'
      };
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.EFFECT_INTERVAL_ADDED'));
    }

    await dialog.render({ force: true });
  }

  static async saveStage(_event, _button) {
    const dialog = this;

    await dialog.updateFromForm();

    if (dialog.onSave) {
      await dialog.onSave(dialog.stageData);
    }

    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.STAGE_CHANGES_SAVED'));
    await dialog.close();
  }

  static buildRuleElementLabel(afflictionName, stageNumber) {
    return `${afflictionName || 'Affliction'} - Stage ${stageNumber}`;
  }

  static async cancelStageEdit(_event, _button) {
    const dialog = this;
    await dialog.close();
  }
}
