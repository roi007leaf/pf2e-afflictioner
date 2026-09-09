import { MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';

const VISIONER_MODULE_ID = 'pf2e-visioner';
const DARKVISION_SLUGS = new Set(['darkvision', 'greater-darkvision']);
const VISIBILITY_STATES = new Set(['observed', 'concealed', 'hidden', 'undetected']);

export class VisionerIntegrationService {
  static getApi() {
    const visioner = globalThis.game?.modules?.get?.(VISIONER_MODULE_ID);
    if (!visioner?.active) return null;

    const api = visioner.api;
    return typeof api?.getVisibilityFactors === 'function' && typeof api?.setVisibility === 'function'
      ? api
      : null;
  }

  static async applyStageVisibility(token, affliction, stage) {
    const api = this.getApi();
    const effect = stage?.visibilityEffects?.find(candidate =>
      candidate?.sense === 'darkvision' &&
      candidate?.only === true &&
      VISIBILITY_STATES.has(candidate?.state),
    );
    if (!api || !token?.id || !affliction?.id || !effect) return;

    const targets = (globalThis.canvas?.tokens?.placeables ?? [])
      .filter(target => target?.id && target.id !== token.id && target.actor);
    const entries = [];
    const options = this._getVisibilityOptions(affliction.id);

    for (const target of targets) {
      try {
        const factors = await api.getVisibilityFactors(token.id, target.id);
        if (!this._isVisibleOnlyWithDarkvision(factors)) continue;

        const currentState = api.getVisibility?.(token.id, target.id);
        const previousState = VISIBILITY_STATES.has(currentState)
          ? currentState
          : (VISIBILITY_STATES.has(factors?.state) ? factors.state : 'observed');
        const applied = await api.setVisibility(token.id, target.id, effect.state, options);
        if (applied === false) continue;

        entries.push({ targetId: target.id, previousState });
      } catch (error) {
        console.warn(`PF2e Afflictioner | Could not apply Visioner visibility to ${target.name || target.id}:`, error);
      }
    }

    const tracking = entries.length > 0
      ? {
        sceneId: globalThis.canvas?.scene?.id ?? null,
        stage: stage.number ?? affliction.currentStage ?? null,
        entries,
      }
      : null;
    affliction.visionerVisibility = tracking;
    await AfflictionStore.updateAffliction(token, affliction.id, { visionerVisibility: tracking });
  }

  static async removeStageVisibility(token, affliction) {
    const tracking = affliction?.visionerVisibility;
    if (!tracking?.entries?.length || !token?.id || !affliction?.id) return;

    const api = this.getApi();
    if (!api) return;

    const currentSceneId = globalThis.canvas?.scene?.id ?? null;
    if (tracking.sceneId && currentSceneId && tracking.sceneId !== currentSceneId) return;

    const tokens = globalThis.canvas?.tokens?.placeables ?? [];
    const options = this._getVisibilityOptions(affliction.id);

    for (const entry of tracking.entries) {
      if (!VISIBILITY_STATES.has(entry?.previousState)) continue;
      const target = tokens.find(candidate => candidate?.id === entry.targetId);
      if (!target) continue;

      try {
        await api.setVisibility(token.id, target.id, entry.previousState, options);
      } catch (error) {
        console.warn(`PF2e Afflictioner | Could not restore Visioner visibility for ${target.name || target.id}:`, error);
      }
    }

    affliction.visionerVisibility = null;
    await AfflictionStore.updateAffliction(token, affliction.id, { visionerVisibility: null });
  }

  static _isVisibleOnlyWithDarkvision(factors) {
    return factors?.state === 'observed' &&
      Array.isArray(factors.slugs) &&
      factors.slugs.some(slug => DARKVISION_SLUGS.has(slug));
  }

  static _getVisibilityOptions(afflictionId) {
    return {
      isAutomatic: true,
      source: `${MODULE_ID}:${afflictionId}`,
    };
  }
}
