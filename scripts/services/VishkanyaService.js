import { FeatsService } from './FeatsService.js';
import { FeatModifierService } from './FeatModifierService.js';

const VENOM_TIERS = {
  base: {
    name: 'Minor Vishkanyan Venom',
    stages: [
      { number: 1, damage: [{ formula: '1d4', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 2, damage: [{ formula: '1d4', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 3, damage: [{ formula: '1d4', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
    ],
    maxDuration: { value: 6, unit: 'round' },
  },
  lesser: {
    name: 'Lesser Vishkanyan Venom',
    stages: [
      { number: 1, damage: [{ formula: '1d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 2, damage: [{ formula: '1d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 3, damage: [{ formula: '2d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
    ],
    maxDuration: { value: 6, unit: 'round' },
  },
  moderate: {
    name: 'Moderate Vishkanyan Venom',
    stages: [
      { number: 1, damage: [{ formula: '3d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 2, damage: [{ formula: '4d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 3, damage: [{ formula: '5d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
    ],
    maxDuration: { value: 6, unit: 'round' },
  },
  greater: {
    name: 'Greater Vishkanyan Venom',
    stages: [
      { number: 1, damage: [{ formula: '7d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 2, damage: [{ formula: '9d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
      { number: 3, damage: [{ formula: '11d6', type: 'poison' }], duration: { value: 1, unit: 'round' }, effects: '', rawText: '', conditions: [], requiresManualHandling: false, isDead: false },
    ],
    maxDuration: { value: 6, unit: 'round' },
  },
};

// Stronger Debilitating Venom options: damage dice removed and condition value per stage
export const STRONGER_DEBILITATIONS = {
  bungling: { diceReduction: 1, condition: 'clumsy', values: [null, 1, 2] },
  devitalizing: { diceReduction: 3, condition: 'drained', values: [null, 1, 2] },
  nauseating: { diceReduction: 2, condition: 'sickened', values: [null, 1, 2] },
  weakening: { diceReduction: 1, condition: 'enfeebled', values: [1, 1, 2] },
};

export class VishkanyaService {
  /**
   * Returns the highest venom tier the actor qualifies for.
   * @param {Actor} actor
   * @returns {'base'|'lesser'|'moderate'|'greater'}
   */
  /**
   * Returns true if the item is the Envenom action or an Enhance Venom feat action
   * that should trigger the Coat Weapon button.
   * @param {Item} item
   * @returns {boolean}
   */
  static isEnvenomItem(item) {
    const slug = item.system?.slug;
    return (
      slug === 'envenom' ||
      slug === 'lesser-enhance-venom' ||
      slug === 'moderate-enhance-venom' ||
      slug === 'greater-enhance-venom'
    );
  }

  /** Returns true if the actor has the Debilitating Venom feat. */
  static hasDebilitatingVenom(actor) {
    return FeatsService.hasFeat(actor, 'debilitating-venom');
  }

  static getVenomTier(actor) {
    if (FeatsService.hasFeat(actor, 'greater-enhance-venom')) return 'greater';
    if (FeatsService.hasFeat(actor, 'moderate-enhance-venom')) return 'moderate';
    if (FeatsService.hasFeat(actor, 'lesser-enhance-venom')) return 'lesser';
    return 'base';
  }

  /**
   * Builds affliction data for the actor's current vishkanyan venom tier.
   * DC uses the actor's class DC. Marks isVirulent if they have Vicious Venom.
   * @param {Actor} actor
   * @returns {object} afflictionData
   */
  static buildVenomAfflictionData(actor) {
    const tier = this.getVenomTier(actor);
    const tierData = VENOM_TIERS[tier];
    const dc = actor.classDC?.dc.value ?? 14;
    const isVirulent = FeatsService.hasFeat(actor, 'vicious-venom');

    return {
      name: tierData.name,
      type: 'poison',
      dc,
      onset: null,
      stages: tierData.stages.map(s => ({
        ...s,
        damage: s.damage.map(d => ({ ...d })),
        conditions: [...s.conditions],
      })),
      maxDuration: { ...tierData.maxDuration },
      isVirulent,
      multipleExposure: null,
      sourceItemUuid: null,
    };
  }

  /**
   * Applies a Debilitating Venom debilitation to the affliction data's stages.
   * Returns a new afflictionData object with modified stages.
   *
   * Hampering: each stage gets a Speed penalty effect (requiresManualHandling)
   *   Stage 1–2: –5-foot status penalty to Speed
   *   Stage 3:   –10-foot status penalty to Speed
   *
   * Stumbling:
   *   Stage 1: no change
   *   Stage 2: Off-Guard condition
   *   Stage 3: Off-Guard condition + –5-foot status penalty to Speed (requiresManualHandling)
   *
   * @param {object} afflictionData
   * @param {'none'|'hampering'|'stumbling'} choice
   * @returns {object} modified afflictionData
   */
  static applyDebilitation(afflictionData, choice) {
    if (!choice || choice === 'none') return afflictionData;
    if (STRONGER_DEBILITATIONS[choice]) return this._applyStrongerDebilitation(afflictionData, STRONGER_DEBILITATIONS[choice]);

    const stages = afflictionData.stages.map((stage, index) => {
      const stageNum = index + 1;
      const s = { ...stage, conditions: [...(stage.conditions ?? [])] };

      if (choice === 'hampering') {
        s.effects = stageNum < 3
          ? '–5-foot status penalty to Speed'
          : '–10-foot status penalty to Speed';
      } else if (choice === 'stumbling') {
        if (stageNum === 2) {
          if (!s.conditions.some(c => c.name === 'off-guard')) {
            s.conditions.push({ name: 'off-guard' });
          }
          s.effects = s.effects ? `${s.effects}, Off-Guard` : 'Off-Guard';
        } else if (stageNum === 3) {
          if (!s.conditions.some(c => c.name === 'off-guard')) {
            s.conditions.push({ name: 'off-guard' });
          }
          const speedText = '–5-foot status penalty to Speed';
          s.effects = s.effects
            ? `${s.effects}, Off-Guard, ${speedText}`
            : `Off-Guard, ${speedText}`;
        }
      }

      return s;
    });

    return { ...afflictionData, stages };
  }

  /** Returns true if the actor has Stronger Debilitating Venom (adds four more debilitations). */
  static hasStrongerDebilitatingVenom(actor) {
    return FeatsService.hasFeat(actor, 'stronger-debilitating-venom');
  }

  /**
   * Stronger Debilitating Venom: fewer damage dice at every stage, plus a condition per stage.
   * @param {object} afflictionData
   * @param {{ diceReduction: number, condition: string, values: (number|null)[] }} debilitation
   */
  static _applyStrongerDebilitation(afflictionData, { diceReduction, condition, values }) {
    const stages = afflictionData.stages.map((stage, index) => {
      const damage = (stage.damage ?? [])
        .map(d => ({ ...d, formula: FeatModifierService.reduceDamageDice(d.formula, diceReduction) }))
        .filter(d => d.formula);
      const conditions = (stage.conditions ?? []).filter(c => c.name !== condition);
      const value = values[index];
      if (value) conditions.push({ name: condition, value });
      return { ...stage, damage, conditions };
    });

    return { ...afflictionData, stages };
  }
}
