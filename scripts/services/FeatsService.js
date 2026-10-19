import { DEGREE_OF_SUCCESS } from '../constants.js';

function afflictionTraits(affliction) {
  return [affliction?.type, ...(Array.isArray(affliction?.traits) ? affliction.traits : [])];
}

const isPoison = affliction => afflictionTraits(affliction).includes('poison');
const isDisease = affliction => afflictionTraits(affliction).includes('disease');

// Features with the Fast Recovery stage-reduction pattern, and what they cover.
const IMPROVED_RECOVERY_FEATURES = [
  { slug: 'fast-recovery', type: 'feat', applies: a => isPoison(a) || isDisease(a) || !!a.isAddiction },
  { slug: 'strong-blooded-dwarf', type: 'heritage', applies: isPoison },
  { slug: 'venom-resistant-vishkanya', type: 'heritage', applies: isPoison },
  { slug: 'wash-out', type: 'feat', applies: isPoison },
  { slug: 'inoculation-subroutine', type: 'feat', applies: isDisease },
  {
    slug: 'inured-to-alchemy',
    type: 'feat',
    applies: a => {
      const traits = afflictionTraits(a);
      return !!a.isAddiction || traits.includes('drug') || (isPoison(a) && traits.includes('alchemical'));
    },
  },
];

export class FeatsService {
  /**
   * Returns true if the actor has a feat with the given slug.
   * @param {Actor|null} actor
   * @param {string} slug
   * @returns {boolean}
   */
  static hasFeat(actor, slug) {
    if (!actor?.items) return false;
    return actor.items.some(item => item.type === 'feat' && item.system?.slug === slug);
  }

  /**
   * Returns the actor's feat or heritage that speeds recovery from this affliction
   * (successful saves reduce the stage by 2, critical successes by 3), or null.
   * @param {Actor|null} actor
   * @param {object|null} affliction
   * @returns {{slug: string, name: string}|null}
   */
  static getImprovedRecoveryFeature(actor, affliction) {
    if (!actor?.items || !affliction) return null;

    for (const feature of IMPROVED_RECOVERY_FEATURES) {
      if (!feature.applies(affliction)) continue;
      const item = actor.items.find(i => i.type === feature.type && i.system?.slug === feature.slug);
      if (item) return { slug: feature.slug, name: item.name || feature.slug };
    }
    return null;
  }

  /** Robust Recovery — skill feat; better Treat Disease/Poison results */
  static hasRobustRecovery(actor) {
    return this.hasFeat(actor, 'robust-recovery');
  }

  /** Blowgun Poisoner — Alchemist class feat */
  static hasBlowgunPoisoner(actor) {
    return this.hasFeat(actor, 'blowgun-poisoner');
  }

  /** Pernicious Poison — Alchemist class feat */
  static hasPerniciousPoison(actor) {
    return this.hasFeat(actor, 'pernicious-poison');
  }

  /** Sticky Poison — Alchemist class feat */
  static hasStickyPoison(actor) {
    return this.hasFeat(actor, 'sticky-poison');
  }

  /** Double Poison — Alchemist class feat */
  static hasDoublePoison(actor) {
    return this.hasFeat(actor, 'double-poison');
  }

  /**
   * Returns the stage change for a degree of success when Fast Recovery applies.
   * Returns null for FAILURE and CRITICAL_FAILURE (unchanged from normal rules).
   *
   * Fast Recovery (PF2e CRB):
   *   Success → -2 stages (or -1 against virulent)
   *   Critical Success → -3 stages (or -2 against virulent)
   *   Failure / Critical Failure → unchanged
   *
   * @param {string} degree - DEGREE_OF_SUCCESS constant
   * @param {boolean} isVirulent
   * @returns {number|null} stage change, or null if Fast Recovery does not modify this degree
   */
  static getFastRecoveryStageChange(degree, isVirulent) {
    switch (degree) {
      case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
        return isVirulent ? -2 : -3;
      case DEGREE_OF_SUCCESS.SUCCESS:
        return isVirulent ? -1 : -2;
      default:
        return null;
    }
  }

  /**
   * Degrades a degree of success by one step (Blowgun Poisoner misfortune effect).
   *   Critical Success → Success
   *   Success         → Failure
   *   Failure         → Critical Failure
   *   Critical Failure → Critical Failure (cannot go lower)
   *
   * @param {string} degree - DEGREE_OF_SUCCESS constant
   * @returns {string} degraded degree
   */
  static degradeDegree(degree) {
    switch (degree) {
      case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
        return DEGREE_OF_SUCCESS.SUCCESS;
      case DEGREE_OF_SUCCESS.SUCCESS:
        return DEGREE_OF_SUCCESS.FAILURE;
      case DEGREE_OF_SUCCESS.FAILURE:
        return DEGREE_OF_SUCCESS.CRITICAL_FAILURE;
      default:
        return degree;
    }
  }
}
