import * as AfflictionStore from './stores/AfflictionStore.js';
import { AfflictionService } from './services/AfflictionService.js';
import { TreatmentService } from './services/TreatmentService.js';
import { AfflictionParser } from './services/AfflictionParser.js';
import { AfflictionManager } from './managers/AfflictionManager.js';
import { VisualService } from './services/VisualService.js';

export class Pf2eAfflictionerApi {
  static async openManager(options = {}) {
    if (AfflictionManager.currentInstance) {
      AfflictionManager.currentInstance.close();
    }

    new AfflictionManager(options).render(true);
  }

  static getAfflictions(token) {
    return AfflictionStore.getAfflictions(token);
  }

  static getAffliction(token, afflictionId) {
    return AfflictionStore.getAffliction(token, afflictionId);
  }

  static async addAffliction(token, afflictionData) {
    await AfflictionStore.addAffliction(token, afflictionData);
    await VisualService.addAfflictionIndicator(token);
  }

  static async removeAffliction(token, afflictionId) {
    const affliction = AfflictionStore.getAffliction(token, afflictionId);
    const oldStageData = affliction?.stages?.[affliction.currentStage - 1];
    await AfflictionStore.removeAffliction(token, afflictionId);
    await AfflictionService.removeStageEffects(token, affliction, oldStageData, null);
    await VisualService.removeAfflictionIndicator(token);
  }

  static async updateAffliction(token, afflictionId, updates) {
    await AfflictionStore.updateAffliction(token, afflictionId, updates);
  }

  static parseAffliction(item) {
    return AfflictionParser.parseFromItem(item);
  }

  static async promptInitialSave(token, afflictionData) {
    await AfflictionService.promptInitialSave(token, afflictionData);
  }

  static async promptSave(token, affliction) {
    await AfflictionService.promptSave(token, affliction);
  }

  static async promptTreatment(token, affliction) {
    await TreatmentService.promptTreatment(token, affliction);
  }

  static getTokensWithAfflictions() {
    return AfflictionStore.getTokensWithAfflictions();
  }

  static refreshAllIndicators() {
    VisualService.refreshAllIndicators();
  }
}

export const api = Pf2eAfflictionerApi;
