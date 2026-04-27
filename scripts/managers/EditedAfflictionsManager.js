import * as AfflictionDefinitionStore from '../stores/AfflictionDefinitionStore.js';
import { AfflictionEditorDialog } from './AfflictionEditorDialog.js';
import { AfflictionEditorService } from '../services/AfflictionEditorService.js';
import { AfflictionParser } from '../services/AfflictionParser.js';
import { AfflictionConflictDetector } from '../services/AfflictionConflictDetector.js';
import { ConflictResolutionDialog } from './ConflictResolutionDialog.js';
import { shouldSkipAffliction } from '../utils.js';

export class EditedAfflictionsManager extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'pf2e-afflictioner-edited-manager',
    classes: ['pf2e-afflictioner', 'edited-afflictions-manager'],
    tag: 'div',
    window: {
      title: 'PF2E_AFFLICTIONER.EDITED_MANAGER.TITLE',
      icon: 'fas fa-list',
      resizable: true
    },
    position: {
      width: 700,
      height: 500
    },
    actions: {
      editDefinition: EditedAfflictionsManager.editDefinition,
      applyDefinition: EditedAfflictionsManager.applyDefinition,
      deleteDefinition: EditedAfflictionsManager.deleteDefinition,
      resetDefinition: EditedAfflictionsManager.resetDefinition,
      exportAllEdits: EditedAfflictionsManager.exportAllEdits,
      importEdits: EditedAfflictionsManager.importEdits
    }
  };

  static PARTS = {
    form: {
      template: 'modules/pf2e-afflictioner/templates/edited-afflictions-manager.hbs'
    }
  };

  constructor(options = {}) {
    super(options);

    if (!game.user.isGM) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_EDITED_MANAGER'));
      this.close();
      return;
    }
  }

  async _prepareContext(options) {
    const allEdits = AfflictionDefinitionStore.getAllEditedDefinitions();
    const editsList = [];

    for (const [key, edit] of Object.entries(allEdits)) {
      const editInfo = {
        key: key,
        name: edit.name || 'Unknown',
        type: edit.type || 'affliction',
        dc: edit.dc || 15,
        saveType: edit.saveType || 'fortitude',
        onset: edit.onset ? `${edit.onset.value} ${edit.onset.unit}(s)` : 'None',
        stageCount: edit.stages?.length || 0,
        editedAt: edit.editedAt ? new Date(edit.editedAt).toLocaleDateString() : 'Unknown',
        sourceItemUuid: edit.sourceItemUuid || null,
        isCustom: !edit.sourceItemUuid
      };

      editsList.push(editInfo);
    }

    editsList.sort((a, b) => a.name.localeCompare(b.name));

    return {
      edits: editsList,
      hasEdits: editsList.length > 0
    };
  }

  static async editDefinition(event, button) {
    const dialog = this;
    const key = button.dataset.key;

    const editedDef = AfflictionDefinitionStore.getEditedDefinition(key);
    if (!editedDef) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.DEFINITION_NOT_FOUND'));
      return;
    }

    let afflictionData = editedDef;
    if (editedDef.sourceItemUuid) {
      try {
        const loadedData = await AfflictionEditorService.prepareForEditing(editedDef.sourceItemUuid);
        if (loadedData) {
          afflictionData = AfflictionEditorService.applyEditedDefinition(loadedData, editedDef);
        }
      } catch (error) {
        console.warn('Could not load source item, using stored definition', error);
      }
    }

    new AfflictionEditorDialog(afflictionData).render(true);
  }

  static async applyDefinition(event, button) {
    const key = button.dataset.key;
    const editedDef = AfflictionDefinitionStore.getEditedDefinition(key);
    if (!editedDef) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.DEFINITION_NOT_FOUND'));
      return;
    }

    const token = canvas?.tokens?.controlled?.[0] || null;
    if (!token?.actor) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.EDITED_MANAGER.APPLY_SELECT_TOKEN'));
      return;
    }

    const afflictionData = foundry.utils.deepClone(editedDef);
    delete afflictionData.editedAt;
    delete afflictionData.editedBy;

    const { AfflictionService } = await import('../services/AfflictionService.js');
    await AfflictionService.promptInitialSave(token, afflictionData);

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.APPLIED_TO_TOKEN', {
      name: afflictionData.name || game.i18n.localize('PF2E_AFFLICTIONER.DIALOG.MANUAL_DEFAULT_NAME'),
      tokenName: token.name
    }));
  }

  static async deleteDefinition(event, button) {
    const dialog = this;
    const key = button.dataset.key;
    const name = button.dataset.name;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      title: game.i18n.localize('PF2E_AFFLICTIONER.EDITED_MANAGER.DELETE'),
      content: `<p>${game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.CONFIRM_DELETE', { name })}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    try {
      await AfflictionDefinitionStore.removeEditedDefinition(key);
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.REMOVED_EDIT', { name }));
      await dialog.render({ force: true });
    } catch (error) {
      console.error('EditedAfflictionsManager: Error deleting definition', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.FAILED_DELETE_DEFINITION'));
    }
  }

  static async resetDefinition(event, button) {
    return EditedAfflictionsManager.deleteDefinition.call(this, event, button);
  }

  static async exportAllEdits(event, button) {
    const allEdits = AfflictionDefinitionStore.getAllEditedDefinitions();

    if (Object.keys(allEdits).length === 0) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.EDITED_MANAGER.NO_EXPORTS'));
      return;
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      moduleVersion: game.modules.get('pf2e-afflictioner').version,
      edits: allEdits
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pf2e-afflictioner-edits-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.EXPORTED_COUNT', { count: Object.keys(allEdits).length }));
  }

  static async importEdits(event, button) {
    const dialog = this;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.edits || typeof importData.edits !== 'object') {
          ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.INVALID_IMPORT_FORMAT'));
          return;
        }

        const currentEdits = AfflictionDefinitionStore.getAllEditedDefinitions();
        const analysis = AfflictionConflictDetector.analyzeImport(
          importData.edits,
          currentEdits
        );

        if (analysis.conflicts.length === 0) {
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            title: game.i18n.localize('PF2E_AFFLICTIONER.EDITED_MANAGER.IMPORT_TITLE'),
            content: `<p>${game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.IMPORT_CONTENT', { count: analysis.autoImport.length })}</p>
                      <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.EDITED_MANAGER.IMPORT_NO_CONFLICTS')}</em></p>`,
            yes: () => true,
            no: () => false,
            defaultYes: true
          });

          if (!confirmed) return;

          const mergedEdits = { ...currentEdits };
          for (const item of analysis.autoImport) {
            const definition = foundry.utils.deepClone(item.definition);
            definition.editedAt = Date.now();
            definition.editedBy = game.user.id;
            mergedEdits[item.key] = definition;
          }

          await game.settings.set('pf2e-afflictioner', 'editedAfflictions', mergedEdits);
          ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.IMPORTED_COUNT', { count: analysis.autoImport.length }));
          await dialog.render({ force: true });
        } else {
          new ConflictResolutionDialog(analysis).render(true);
        }

      } catch (error) {
        console.error('EditedAfflictionsManager: Error importing', error);
        ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.FAILED_IMPORT'));
      }
    };

    input.click();
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    const element = this.element;
    if (!element) return;

    if (this._dropHandlersInitialized) return;
    this._dropHandlersInitialized = true;

    element.addEventListener('drop', this._onDrop.bind(this));
    element.addEventListener('dragover', this._onDragOver.bind(this));
    element.addEventListener('dragleave', this._onDragLeave.bind(this));
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const element = this.element;
    if (element && !element.classList.contains('drag-over')) {
      element.classList.add('drag-over');
    }
  }

  _onDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      const element = this.element;
      if (element) {
        element.classList.remove('drag-over');
      }
    }
  }

  async _onDrop(event) {
    event.preventDefault();

    const element = this.element;
    if (element) {
      element.classList.remove('drag-over');
    }

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }

    if (data.type !== 'Item') {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ONLY_ITEMS_ALLOWED'));
      return;
    }

    const item = await fromUuid(data.uuid);
    if (!item) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.COULD_NOT_LOAD_ITEM'));
      return;
    }

    const traits = item.system?.traits?.value || [];
    if (!traits.includes('poison') && !traits.includes('disease')) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ITEM_MUST_HAVE_TRAIT'));
      return;
    }

    const afflictionData = AfflictionParser.parseFromItem(item);
    if (shouldSkipAffliction(afflictionData)) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_SKIPPED'));
      return;
    }
    if (!afflictionData) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.COULD_NOT_PARSE'));
      return;
    }

    const key = AfflictionDefinitionStore.generateDefinitionKey(afflictionData);
    const existingEdit = AfflictionDefinitionStore.getEditedDefinition(key);

    if (existingEdit) {
      const mergedData = AfflictionEditorService.applyEditedDefinition(afflictionData, existingEdit);
      new AfflictionEditorDialog(mergedData).render(true);
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.EDITING_EXISTING', { name: afflictionData.name }));
    } else {
      new AfflictionEditorDialog(afflictionData).render(true);
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.EDITED_MANAGER.CREATING_NEW', { name: afflictionData.name }));
    }
  }
}
