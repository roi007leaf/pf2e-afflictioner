import { DEGREE_OF_SUCCESS } from '../constants.js';

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

  /** Fast Recovery — Constitution +2 general feat */
  static hasFastRecovery(actor) {
    return this.hasFeat(actor, 'fast-recovery');
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

  /** Toxicologist — Alchemist research field that allows poison → acid damage swap */
  static hasToxicologistFieldVenom(actor) {
    if (!actor?.items) return false;
    return actor.items.some(item =>
      item.type === 'feat' && item.system?.slug?.includes('toxicologist')
    );
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
