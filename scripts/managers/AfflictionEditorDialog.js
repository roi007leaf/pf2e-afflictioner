import * as AfflictionDefinitionStore from '../stores/AfflictionDefinitionStore.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionEditorService } from '../services/AfflictionEditorService.js';
import { AfflictionService } from '../services/AfflictionService.js';
import { StageEditorDialog } from './StageEditorDialog.js';
import { DEFAULT_AFFLICTION_ICON, VALUELESS_CONDITIONS } from '../constants.js';

export class AfflictionEditorDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'pf2e-afflictioner-editor',
    classes: ['pf2e-afflictioner', 'affliction-editor'],
    tag: 'form',
    window: {
      title: 'PF2E_AFFLICTIONER.EDITOR.TITLE',
      icon: 'fas fa-edit',
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      editStage: AfflictionEditorDialog.editStage,
      addStage: AfflictionEditorDialog.addStage,
      removeStage: AfflictionEditorDialog.removeStage,
      toggleOnset: AfflictionEditorDialog.toggleOnset,
      toggleOnsetEffectInterval: AfflictionEditorDialog.toggleOnsetEffectInterval,
      addOnsetDamage: AfflictionEditorDialog.addOnsetDamage,
      removeOnsetDamage: AfflictionEditorDialog.removeOnsetDamage,
      addOnsetCondition: AfflictionEditorDialog.addOnsetCondition,
      removeOnsetCondition: AfflictionEditorDialog.removeOnsetCondition,
      addOnsetWeakness: AfflictionEditorDialog.addOnsetWeakness,
      removeOnsetWeakness: AfflictionEditorDialog.removeOnsetWeakness,
      toggleMaxDuration: AfflictionEditorDialog.toggleMaxDuration,
      pickIcon: AfflictionEditorDialog.pickIcon,
      saveChanges: AfflictionEditorDialog.saveChanges,
      cancelEdit: AfflictionEditorDialog.cancelEdit,
      resetToDefault: AfflictionEditorDialog.resetToDefault
    }
  };

  static PARTS = {
    form: {
      template: 'modules/pf2e-afflictioner/templates/affliction-editor.hbs'
    }
  };

  constructor(afflictionData, options = {}) {
    super(options);

    if (!game.user.isGM) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_EDITOR'));
      this.close();
      return;
    }

    this.originalData = foundry.utils.deepClone(afflictionData);
    this.editedData = AfflictionEditorService.prepareEditStructure(afflictionData);
  }

  async _prepareContext(_options) {
    const affliction = foundry.utils.deepClone(this.editedData);

    if (affliction.stages) {
      const TextEditorClass = foundry.applications?.ux?.TextEditor?.implementation || TextEditor;
      for (const stage of affliction.stages) {
        if (stage.effects) {
          stage.enrichedEffects = await TextEditorClass.enrichHTML(stage.effects, { async: true });
        }
      }
    }

    if (affliction.onsetConditions) {
      affliction.onsetConditions = affliction.onsetConditions.map(c => ({
        ...c,
        isValueless: VALUELESS_CONDITIONS.includes(c.name?.toLowerCase())
      }));
    }

    return {
      affliction
    };
  }

  static async editStage(_event, button) {
    const dialog = this;
    const stageNumber = parseInt(button.dataset.stageNumber);
    const stage = dialog.editedData.stages.find(s => s.number === stageNumber);

    if (!stage) {
      ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.STAGE_NOT_FOUND', { number: stageNumber }));
      return;
    }

    const stageEditor = new StageEditorDialog(stage, {
      onSave: async (updatedStage) => {
        const index = dialog.editedData.stages.findIndex(s => s.number === stageNumber);
        if (index !== -1) {
          dialog.editedData.stages[index] = updatedStage;
          await dialog.render({ force: true });
        }
      }
    });

    stageEditor.render(true);
  }

  static async addStage(_event, _button) {
    const dialog = this;

    const nextStageNumber = dialog.editedData.stages.length + 1;
    const newStage = {
      number: nextStageNumber,
      effects: '',
      rawText: '',
      duration: { value: 1, unit: 'day', isDice: false },
      damage: [],
      conditions: [],
      weakness: [],
      requiresManualHandling: false
    };

    dialog.editedData.stages.push(newStage);
    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.ADDED_STAGE', { number: nextStageNumber }));
    await dialog.render({ force: true });
  }

  static async removeStage(_event, button) {
    const dialog = this;
    const stageNumber = parseInt(button.dataset.stageNumber);

    if (dialog.editedData.stages.length <= 1) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CANNOT_REMOVE_LAST_STAGE'));
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.REMOVE_STAGE'),
      content: `<p>${game.i18n.format('PF2E_AFFLICTIONER.EDITOR.CONFIRM_REMOVE_STAGE', { number: stageNumber })}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    const index = dialog.editedData.stages.findIndex(s => s.number === stageNumber);
    if (index !== -1) {
      dialog.editedData.stages.splice(index, 1);

      dialog.editedData.stages.forEach((stage, idx) => {
        stage.number = idx + 1;
      });

      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.REMOVED_STAGE', { number: stageNumber }));
      await dialog.render({ force: true });
    }
  }

  static async toggleOnset(_event, _button) {
    const dialog = this;

    if (dialog.editedData.onset && dialog.editedData.onset.value > 0) {
      dialog.editedData.onset = null;
      dialog.editedData.onsetEffectInterval = null;
      dialog.editedData.onsetDamage = [];
      dialog.editedData.onsetConditions = [];
      dialog.editedData.onsetWeakness = [];
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ONSET_REMOVED'));
    } else {
      dialog.editedData.onset = {
        value: 1,
        unit: 'round'
      };
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ONSET_ADDED'));
    }

    await dialog.render({ force: true });
  }

  static async toggleOnsetEffectInterval(_event, _button) {
    const dialog = this;

    if (dialog.editedData.onsetEffectInterval) {
      dialog.editedData.onsetEffectInterval = null;
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ONSET_EFFECT_INTERVAL_REMOVED'));
    } else {
      dialog.editedData.onsetEffectInterval = { value: 6, unit: 'hour' };
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.ONSET_EFFECT_INTERVAL_ADDED'));
    }

    await dialog.render({ force: true });
  }

  static async addOnsetDamage(_event, _button) {
    const dialog = this;
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetDamage.push({ formula: '', type: '' });
    await dialog.render({ force: true });
  }

  static async removeOnsetDamage(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetDamage.splice(index, 1);
    await dialog.render({ force: true });
  }

  static async addOnsetCondition(_event, _button) {
    const dialog = this;
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetConditions.push({ name: '', value: null });
    await dialog.render({ force: true });
  }

  static async removeOnsetCondition(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetConditions.splice(index, 1);
    await dialog.render({ force: true });
  }

  static async addOnsetWeakness(_event, _button) {
    const dialog = this;
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetWeakness.push({ type: '', value: 0 });
    await dialog.render({ force: true });
  }

  static async removeOnsetWeakness(_event, button) {
    const dialog = this;
    const index = parseInt(button.dataset.index);
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;
    dialog._syncOnsetEffectsFromForm(formData);
    dialog.editedData.onsetWeakness.splice(index, 1);
    await dialog.render({ force: true });
  }

  _syncOnsetEffectsFromForm(formData) {
    const onsetDamage = [];
    let i = 0;
    while (formData[`onsetDamage.${i}.formula`] !== undefined) {
      onsetDamage.push({ formula: formData[`onsetDamage.${i}.formula`] || '', type: formData[`onsetDamage.${i}.type`] || '' });
      i++;
    }
    this.editedData.onsetDamage = onsetDamage;

    const onsetConditions = [];
    i = 0;
    while (formData[`onsetConditions.${i}.name`] !== undefined) {
      const val = formData[`onsetConditions.${i}.value`];
      onsetConditions.push({ name: formData[`onsetConditions.${i}.name`] || '', value: val !== undefined && val !== '' ? parseInt(val) : null });
      i++;
    }
    this.editedData.onsetConditions = onsetConditions;

    const onsetWeakness = [];
    i = 0;
    while (formData[`onsetWeakness.${i}.type`] !== undefined) {
      onsetWeakness.push({ type: formData[`onsetWeakness.${i}.type`] || '', value: parseInt(formData[`onsetWeakness.${i}.value`]) || 0 });
      i++;
    }
    this.editedData.onsetWeakness = onsetWeakness;
  }

  static async toggleMaxDuration(_event, _button) {
    const dialog = this;

    if (dialog.editedData.maxDuration && dialog.editedData.maxDuration.value > 0) {
      dialog.editedData.maxDuration = null;
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.MAX_DURATION_REMOVED'));
    } else {
      dialog.editedData.maxDuration = {
        value: 6,
        unit: 'round'
      };
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.MAX_DURATION_ADDED'));
    }

    await dialog.render({ force: true });
  }

  static async pickIcon(_event, _button) {
    const dialog = this;
    const input = dialog.element?.querySelector('input[name="img"]');
    const preview = dialog.element?.querySelector('.affliction-icon-preview');
    const current = input?.value || dialog.editedData.img || DEFAULT_AFFLICTION_ICON;
    const FilePickerClass = globalThis.FilePicker || foundry.applications?.apps?.FilePicker?.implementation;

    if (!FilePickerClass) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.FILE_PICKER_UNAVAILABLE'));
      return;
    }

    const picker = new FilePickerClass({
      type: 'image',
      current,
      callback: path => {
        const nextPath = path || DEFAULT_AFFLICTION_ICON;
        dialog.editedData.img = nextPath;
        if (input) input.value = nextPath;
        if (preview) preview.src = nextPath;
      }
    });
    picker.browse();
  }

  static async saveChanges(_event, _button) {
    const dialog = this;
    const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
    const formData = new FormDataClass(dialog.element).object;

    if (formData.dc !== undefined) {
      dialog.editedData.dc = Math.max(1, Math.min(50, parseInt(formData.dc) || 15));
    }

    if (formData.saveType) {
      dialog.editedData.saveType = formData.saveType.toLowerCase();
    }

    dialog.editedData.img = formData.img?.trim() || DEFAULT_AFFLICTION_ICON;

    dialog.editedData.isVirulent = formData.isVirulent === true || formData.isVirulent === 'true';

    if (formData['onset.value'] !== undefined || formData.onset) {
      const onsetValue = parseInt(formData['onset.value'] || formData.onset?.value);
      const onsetUnit = formData['onset.unit'] || formData.onset?.unit || 'round';

      if (onsetValue > 0) {
        dialog.editedData.onset = {
          value: onsetValue,
          unit: onsetUnit
        };
      } else {
        dialog.editedData.onset = null;
      }
    }

    if (formData['onsetEffectInterval.value'] !== undefined || formData.onsetEffectInterval) {
      const intervalValue = parseInt(formData['onsetEffectInterval.value'] || formData.onsetEffectInterval?.value);
      const intervalUnit = formData['onsetEffectInterval.unit'] || formData.onsetEffectInterval?.unit || 'hour';
      if (intervalValue > 0) {
        dialog.editedData.onsetEffectInterval = { value: intervalValue, unit: intervalUnit };
      } else {
        dialog.editedData.onsetEffectInterval = null;
      }
    } else if (!dialog.editedData.onsetEffectInterval) {
      dialog.editedData.onsetEffectInterval = null;
    }

    dialog._syncOnsetEffectsFromForm(formData);

    if (formData['maxDuration.value'] !== undefined || formData.maxDuration) {
      const maxDurationValue = parseInt(formData['maxDuration.value'] || formData.maxDuration?.value);
      const maxDurationUnit = formData['maxDuration.unit'] || formData.maxDuration?.unit || 'round';

      if (maxDurationValue > 0) {
        dialog.editedData.maxDuration = {
          value: maxDurationValue,
          unit: maxDurationUnit
        };
      } else {
        dialog.editedData.maxDuration = null;
      }
    } else if (!dialog.editedData.maxDuration) {
      dialog.editedData.maxDuration = null;
    }

    const validation = AfflictionEditorService.validateEditedData(dialog.editedData);
    if (!validation.valid) {
      ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.VALIDATION_FAILED', { errors: validation.errors.join(', ') }));
      console.error('AfflictionEditorDialog: Validation errors', validation.errors);
      return;
    }

    const key = AfflictionDefinitionStore.generateDefinitionKey(dialog.originalData);
    if (!key) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.KEY_FAILED'));
      return;
    }

    try {
      await AfflictionDefinitionStore.saveEditedDefinition(key, dialog.editedData);

      await dialog.applyToActiveAfflictions(key, dialog.editedData);

      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CHANGES_SAVED'));
      await dialog.close();
    } catch (error) {
      console.error('AfflictionEditorDialog: Error saving', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.SAVE_FAILED'));
    }
  }

  async applyToActiveAfflictions(definitionKey, editedData) {
    if (!canvas?.tokens) return;

    let updatedCount = 0;

    for (const token of canvas.tokens.placeables) {
      const afflictions = AfflictionStore.getAfflictions(token);

      for (const [id, affliction] of Object.entries(afflictions)) {
        const afflictionKey = AfflictionDefinitionStore.generateDefinitionKey(affliction);
        if (afflictionKey === definitionKey) {
          const updates = {
            name: editedData.name,
            type: editedData.type,
            dc: editedData.dc,
            saveType: editedData.saveType,
            img: editedData.img || DEFAULT_AFFLICTION_ICON,
            stages: editedData.stages,
            isVirulent: editedData.isVirulent,
            multipleExposure: editedData.multipleExposure,
            recoveryRestriction: editedData.recoveryRestriction,
            onset: editedData.onset || null
          };

          if (editedData.maxDuration) {
            updates.maxDuration = editedData.maxDuration;
          } else {
            updates.maxDuration = null;
          }

          updates.onsetEffectInterval = editedData.onsetEffectInterval || null;
          updates.onsetDamage = editedData.onsetDamage || [];
          updates.onsetConditions = editedData.onsetConditions || [];
          updates.onsetWeakness = editedData.onsetWeakness || [];

          await AfflictionStore.updateAffliction(token, id, updates);

          const updatedAffliction = AfflictionStore.getAffliction(token, id);
          const currentStageData = updatedAffliction.stages[updatedAffliction.currentStage - 1];

          if (currentStageData) {
            await AfflictionService.removeStageEffects(token, updatedAffliction, currentStageData, currentStageData);
            await AfflictionService.applyStageEffects(token, updatedAffliction, currentStageData);
          }

          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITOR.UPDATED_ACTIVE', { count: updatedCount }));
    }
  }

  static async cancelEdit(_event, _button) {
    const dialog = this;
    await dialog.close();
  }

  static async resetToDefault(_event, _button) {
    const dialog = this;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      title: game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RESET_TO_DEFAULT'),
      content: `<p>${game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.CONFIRM_RESET')}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    const key = AfflictionDefinitionStore.generateDefinitionKey(dialog.originalData);
    if (!key) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.KEY_FAILED'));
      return;
    }

    try {
      await AfflictionDefinitionStore.removeEditedDefinition(key);
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RESET_DONE'));
      await dialog.close();
    } catch (error) {
      console.error('AfflictionEditorDialog: Error resetting', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.EDITOR.RESET_FAILED'));
    }
  }
}
