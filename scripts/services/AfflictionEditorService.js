import * as AfflictionDefinitionStore from '../stores/AfflictionDefinitionStore.js';
import { AfflictionParser } from './AfflictionParser.js';
import { DEFAULT_AFFLICTION_ICON, PF2E_CONDITIONS } from '../constants.js';

export class AfflictionEditorService {
  static hasEditedVersion(afflictionData) {
    const key = AfflictionDefinitionStore.generateDefinitionKey(afflictionData);
    return AfflictionDefinitionStore.getEditedDefinition(key) !== null;
  }

  static applyEditedDefinition(afflictionData, editedDef) {
    if (!afflictionData || !editedDef) {
      console.warn('AfflictionEditorService: Invalid data for merging');
      return afflictionData;
    }

    const merged = { ...afflictionData };

    if (editedDef.dc !== undefined) merged.dc = editedDef.dc;
    if (editedDef.saveType !== undefined) merged.saveType = editedDef.saveType;
    if (editedDef.onset !== undefined) merged.onset = editedDef.onset;
    if (editedDef.onsetEffectInterval !== undefined) merged.onsetEffectInterval = editedDef.onsetEffectInterval;
    if (editedDef.onsetDamage !== undefined) merged.onsetDamage = editedDef.onsetDamage;
    if (editedDef.onsetConditions !== undefined) merged.onsetConditions = editedDef.onsetConditions;
    if (editedDef.onsetWeakness !== undefined) merged.onsetWeakness = editedDef.onsetWeakness;
    if (editedDef.stages !== undefined) merged.stages = editedDef.stages;
    if (editedDef.isVirulent !== undefined) merged.isVirulent = editedDef.isVirulent;
    if (editedDef.recoveryRestriction !== undefined) merged.recoveryRestriction = editedDef.recoveryRestriction;
    if (editedDef.img !== undefined) merged.img = editedDef.img;

    return merged;
  }

  static validateEditedData(editedData) {
    const errors = [];

    if (editedData.dc !== undefined) {
      if (!Number.isInteger(editedData.dc) || editedData.dc < 1 || editedData.dc > 50) {
        errors.push('DC must be an integer between 1 and 50');
      }
    }

    if (editedData.saveType !== undefined) {
      const validSaveTypes = ['fortitude', 'reflex', 'will'];
      if (!validSaveTypes.includes(editedData.saveType.toLowerCase())) {
        errors.push('Save type must be Fortitude, Reflex, or Will');
      }
    }

    if (editedData.onset) {
      if (!Number.isInteger(editedData.onset.value) || editedData.onset.value < 0) {
        errors.push('Onset value must be a non-negative integer');
      }

      const validUnits = ['round', 'minute', 'hour', 'day', 'week'];
      if (!validUnits.includes(editedData.onset.unit)) {
        errors.push('Onset unit must be round, minute, hour, day, or week');
      }
    }

    if (editedData.onsetEffectInterval) {
      if (!Number.isInteger(editedData.onsetEffectInterval.value) || editedData.onsetEffectInterval.value <= 0) {
        errors.push('Onset effect interval value must be a positive integer');
      }
      const validUnits = ['round', 'minute', 'hour', 'day', 'week'];
      if (!validUnits.includes(editedData.onsetEffectInterval.unit)) {
        errors.push('Onset effect interval unit must be round, minute, hour, day, or week');
      }
    }

    if (editedData.stages && Array.isArray(editedData.stages)) {
      for (const stage of editedData.stages) {
        if (stage.effectInterval) {
          if (!Number.isInteger(stage.effectInterval.value) || stage.effectInterval.value <= 0) {
            errors.push(`Stage ${stage.number}: Effect interval value must be a positive integer`);
          }

          const validEffectUnits = ['round', 'minute', 'hour', 'day', 'week'];
          if (!validEffectUnits.includes(stage.effectInterval.unit)) {
            errors.push(`Stage ${stage.number}: Effect interval unit must be round, minute, hour, day, or week`);
          }
        }

        if (stage.duration) {
          if (!Number.isInteger(stage.duration.value) || stage.duration.value <= 0) {
            errors.push(`Stage ${stage.number}: Duration value must be a positive integer`);
          }

          const validUnits = ['round', 'minute', 'hour', 'day', 'week'];
          if (!validUnits.includes(stage.duration.unit)) {
            errors.push(`Stage ${stage.number}: Duration unit must be round, minute, hour, day, or week`);
          }
        }

        if (stage.damage && Array.isArray(stage.damage)) {
          for (const dmg of stage.damage) {
            try {
              if (dmg.formula && !Roll.validate(dmg.formula)) {
                errors.push(`Stage ${stage.number}: Invalid damage formula "${dmg.formula}"`);
              }
            } catch (e) {
              errors.push(`Stage ${stage.number}: Invalid damage formula "${dmg.formula}"`);
            }
          }
        }

        if (stage.conditions && Array.isArray(stage.conditions)) {
          for (const cond of stage.conditions) {
            const normalizedName = cond.name?.toLowerCase().replace(/\s+/g, '-');
            if (!PF2E_CONDITIONS.includes(normalizedName)) {
              errors.push(`Stage ${stage.number}: Unknown condition "${cond.name}"`);
            }

            if (cond.value !== null && cond.value !== undefined) {
              if (!Number.isInteger(cond.value) || cond.value < 0 || cond.value > 4) {
                errors.push(`Stage ${stage.number}: Condition value must be 0-4 or null`);
              }
            }
          }
        }

        if (stage.weakness && Array.isArray(stage.weakness)) {
          for (const weak of stage.weakness) {
            if (!Number.isInteger(weak.value) || weak.value <= 0) {
              errors.push(`Stage ${stage.number}: Weakness value must be a positive integer`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  static async prepareForEditing(afflictionOrUuid) {
    try {
      if (typeof afflictionOrUuid === 'string') {
        const item = await fromUuid(afflictionOrUuid);
        if (!item) {
          ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.COULD_NOT_LOAD_ITEM'));
          return null;
        }

        const afflictionData = AfflictionParser.parseFromItem(item);
        return afflictionData;
      }

      if (afflictionOrUuid.sourceItemUuid) {
        const item = await fromUuid(afflictionOrUuid.sourceItemUuid);
        if (item) {
          return AfflictionParser.parseFromItem(item);
        }
      }

      return afflictionOrUuid;
    } catch (error) {
      console.error('AfflictionEditorService: Error preparing for editing', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.FAILED_PREPARE_AFFLICTION'));
      return null;
    }
  }

  static prepareEditStructure(afflictionData) {
    return {
      name: afflictionData.name || 'Unknown Affliction',
      type: afflictionData.type || 'affliction',
      dc: afflictionData.dc || 15,
      saveType: afflictionData.saveType || 'fortitude',
      img: afflictionData.img || DEFAULT_AFFLICTION_ICON,
      isVirulent: afflictionData.isVirulent || false,
      onset: afflictionData.onset || null,
      onsetEffectInterval: afflictionData.onsetEffectInterval || null,
      onsetDamage: afflictionData.onsetDamage || [],
      onsetConditions: afflictionData.onsetConditions || [],
      onsetWeakness: afflictionData.onsetWeakness || [],
      maxDuration: afflictionData.maxDuration || null,
      recoveryRestriction: afflictionData.recoveryRestriction || null,
      stages: afflictionData.stages || [],
      sourceItemUuid: afflictionData.sourceItemUuid || null
    };
  }
}
