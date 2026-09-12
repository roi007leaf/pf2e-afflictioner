import { MODULE_ID } from '../constants.js';

export class AfflictionDamageService {
  static getAdjustment(affliction) {
    if (game.settings.get(MODULE_ID, 'adjustAfflictionDamage') === false) return 0;
    const reference = affliction?.originActorUuid || affliction?.originActorId;
    if (!reference) return 0;

    let actor = game.actors?.get(reference);
    if (!actor && typeof fromUuidSync === 'function') {
      try {
        actor = fromUuidSync(reference);
      } catch {
        return 0;
      }
    }
    if (actor?.type !== 'npc') return 0;
    const adjustment = actor.system?.attributes?.adjustment;
    return adjustment === 'elite' ? 2 : adjustment === 'weak' ? -2 : 0;
  }

  static adjustFormula(formula, affliction) {
    const adjustment = this.getAdjustment(affliction);
    if (!adjustment) return formula;
    // Keep the modifier inside the first damage instance's type annotation.
    const text = String(formula);
    const typeIndex = text.indexOf('[');
    const base = typeIndex < 0 ? text : text.slice(0, typeIndex);
    const suffix = typeIndex < 0 ? '' : text.slice(typeIndex);
    return `(${base.trim()} ${adjustment > 0 ? '+' : '-'} ${Math.abs(adjustment)})${suffix}`;
  }
}
