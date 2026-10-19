import { DURATION_MULTIPLIERS } from '../constants.js';
import { FeatsService } from './FeatsService.js';

const K = 'PF2E_AFFLICTIONER.FEATS';
const UNITS_LARGEST_FIRST = ['week', 'day', 'hour', 'minute', 'round'];

function traitsOf(affliction) {
  return [affliction?.type, ...(Array.isArray(affliction?.traits) ? affliction.traits : [])];
}

function hasTrait(affliction, trait) {
  return traitsOf(affliction).includes(trait);
}

function hasHeritage(actor, slug) {
  return !!actor?.items?.some?.(item => item.type === 'heritage' && item.system?.slug === slug);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Feats and features that change an affliction when a creature is exposed to it,
 * plus the special save actions some features grant.
 */
export class FeatModifierService {
  static getClassDC(actor) {
    const value = Number(actor?.classDC?.dc?.value ?? actor?.system?.attributes?.classDC?.value);
    return Number.isFinite(value) ? value : null;
  }

  /** Raises a DC by up to `amount`, but never above the class DC and never lowering it. */
  static raiseDC(dc, amount, classDC) {
    if (!Number.isFinite(dc) || classDC === null) return dc;
    return Math.max(dc, Math.min(dc + amount, classDC));
  }

  static isOffGuard(actor) {
    if (actor?.hasCondition?.('off-guard')) return true;
    return !!actor?.itemTypes?.condition?.some?.(c => c.slug === 'off-guard' || c.system?.slug === 'off-guard');
  }

  /**
   * Applies the source's crafting and Strike feats and the target's heritage to a
   * fresh exposure. Returns a new object; already-processed data is returned as is.
   */
  static applyExposureFeats(afflictionData, { sourceActor = null, targetActor = null } = {}) {
    if (!afflictionData || afflictionData.exposureFeatsApplied) return afflictionData;

    const data = clone(afflictionData);
    data.exposureFeatsApplied = true;

    const isPoison = hasTrait(data, 'poison');
    const isAlchemicalPoison = isPoison && hasTrait(data, 'alchemical');
    const classDC = this.getClassDC(sourceActor);

    if (isAlchemicalPoison && FeatsService.hasFeat(sourceActor, 'potent-poisoner')) {
      data.dc = this.raiseDC(data.dc, 4, classDC);
    }

    if (isAlchemicalPoison && FeatsService.hasFeat(sourceActor, 'tenacious-toxins')) {
      data.maxDuration = this.extendMaxDuration(data.maxDuration, data.stages?.[0]?.duration);
    }

    if (isAlchemicalPoison && FeatsService.hasFeat(sourceActor, 'combustible-poison')) {
      data.combustiblePoison = true;
    }

    if (data.deliveredByStrike && isPoison) {
      if (hasTrait(data, 'injury') && FeatsService.hasFeat(sourceActor, 'deadly-poison-weapon')) {
        data.dc = this.raiseDC(data.dc, 2, classDC);
      }

      if (FeatsService.hasFeat(sourceActor, 'pinpoint-poisoner') && this.isOffGuard(targetActor)) {
        data.saveModifiers = [
          ...(data.saveModifiers || []),
          { label: game.i18n.localize(`${K}.PINPOINT_POISONER`), value: -2, type: 'circumstance' },
        ];
      }

      const hasGreaterFieldDiscovery = FeatsService.hasFeat(sourceActor, 'greater-field-discovery-toxicologist')
        || FeatsService.hasFeat(sourceActor, 'chemical-contagion');
      if (hasGreaterFieldDiscovery && hasTrait(data, 'infused') && hasTrait(data, 'injury')) {
        data.sprayOnFailedInitialSave = true;
      }
    }

    if (hasHeritage(targetActor, 'stronggut-shisk') && (isPoison || hasTrait(data, 'disease'))) {
      if (data.onset) data.onset = this.scaleDuration(data.onset, 1.5);
      data.stages = (data.stages || []).map(stage => (
        stage.duration ? { ...stage, duration: this.scaleDuration(stage.duration, 1.5) } : stage
      ));
    }

    return data;
  }

  static durationToSeconds(duration) {
    return (duration?.value ?? 0) * (DURATION_MULTIPLIERS[duration?.unit] ?? DURATION_MULTIPLIERS.round);
  }

  /** Largest unit that expresses the seconds as a whole number. */
  static secondsToDuration(seconds) {
    const unit = UNITS_LARGEST_FIRST.find(u => seconds % DURATION_MULTIPLIERS[u] === 0) ?? 'round';
    return { value: Math.round(seconds / DURATION_MULTIPLIERS[unit]), unit, isDice: false };
  }

  /**
   * Multiplies a fixed duration, moving to smaller units when the result isn't whole.
   * Instant, 1-round and dice durations are left unchanged.
   */
  static scaleDuration(duration, factor) {
    if (!duration || duration.isDice || !(duration.value > 0) || !DURATION_MULTIPLIERS[duration.unit]) return duration;
    if (duration.unit === 'round' && duration.value === 1) return duration;

    const scaled = duration.value * factor;
    if (Number.isInteger(scaled)) return { ...duration, value: scaled };
    if (duration.unit === 'round') return { ...duration, value: Math.round(scaled) };

    return this.secondsToDuration(Math.round(this.durationToSeconds(duration) * factor / 6) * 6);
  }

  /** Tenacious Toxins: max duration + stage 1 interval, up to twice the max duration. */
  static extendMaxDuration(maxDuration, stageOneDuration) {
    if (!maxDuration || maxDuration.isDice || !stageOneDuration || stageOneDuration.isDice) return maxDuration;
    const maxSeconds = this.durationToSeconds(maxDuration);
    const extended = Math.min(maxSeconds + this.durationToSeconds(stageOneDuration), maxSeconds * 2);
    if (extended <= maxSeconds) return maxDuration;

    const sameUnit = extended % DURATION_MULTIPLIERS[maxDuration.unit] === 0;
    return sameUnit
      ? { ...maxDuration, value: extended / DURATION_MULTIPLIERS[maxDuration.unit] }
      : this.secondsToDuration(extended);
  }

  /** Removes `dice` dice from the first dice term; null when no dice remain. */
  static reduceDamageDice(formula, dice) {
    const match = String(formula).match(/^(\s*)(\d+)d(\d+)(.*)$/);
    if (!match) return formula;
    const remaining = Number(match[2]) - dice;
    if (remaining < 1) return null;
    return `${match[1]}${remaining}d${match[3]}${match[4]}`;
  }

  /**
   * Special save actions available for this affliction.
   * @param {Actor} patient
   * @param {object} affliction
   * @param {{virulentStrikeAvailable?: boolean}} context
   * @returns {{kind: string, label: string}[]}
   */
  static getSpecialSaveOptions(patient, affliction, { virulentStrikeAvailable = false } = {}) {
    if (!affliction || affliction.needsInitialSave || affliction.isAddiction || !(affliction.currentStage > 0)) return [];

    const isPoison = hasTrait(affliction, 'poison');
    const isDisease = hasTrait(affliction, 'disease');
    const options = [];
    const add = (kind, key) => options.push({ kind, label: game.i18n.localize(`${K}.${key}`) });

    if (isPoison && FeatsService.hasFeat(patient, 'coral-detoxification')) add('coral-detoxification', 'CORAL_DETOXIFICATION');
    if ((isPoison || isDisease) && FeatsService.hasFeat(patient, 'resilient-physiology')) add('resilient-physiology', 'RESILIENT_PHYSIOLOGY');
    if (isPoison && FeatsService.hasFeat(patient, 'purge-system')) {
      add('purge-system', 'PURGE_SYSTEM');
      add('purge-system-enhanced', 'PURGE_SYSTEM_ENHANCED');
    }
    if ((isPoison || isDisease) && virulentStrikeAvailable) {
      add('virulent-strike', 'VIRULENT_STRIKE');
      add('virulent-strike-crit', 'VIRULENT_STRIKE_CRIT');
    }
    return options;
  }

  /**
   * What a special save changes: modifiers on the roll, limits on the stage change,
   * or a direct stage reduction (Purge System).
   */
  static getSpecialSaveEffect(kind) {
    const label = game.i18n.localize(`${K}.${kind.replace(/-/g, '_').toUpperCase()}`);
    switch (kind) {
      case 'coral-detoxification':
        return { saveModifiers: [{ label, value: 2, type: 'circumstance' }] };
      case 'resilient-physiology':
        return { pendingSaveRule: { label, noIncrease: true } };
      case 'virulent-strike':
        return { pendingSaveRule: { label, noDecrease: true } };
      case 'virulent-strike-crit':
        return {
          saveModifiers: [{ label, value: -4, type: 'circumstance' }],
          pendingSaveRule: { label, noDecrease: true },
        };
      case 'purge-system':
        return { stageReduction: 1 };
      case 'purge-system-enhanced':
        return { stageReduction: 2 };
      default:
        return null;
    }
  }

  /** Clamps a stage-save stage change by a special save's rule. */
  static applySaveRule(stageChange, rule) {
    if (rule?.noDecrease) stageChange = Math.max(0, stageChange);
    if (rule?.noIncrease) stageChange = Math.min(0, stageChange);
    return stageChange;
  }
}
