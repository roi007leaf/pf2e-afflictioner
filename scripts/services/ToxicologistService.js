import { FeatsService } from './FeatsService.js';

// Alchemist Toxicologist research field: infused poison items affect poison-immune
// creatures, dealing acid instead of poison when the target is immune or when acid
// would be more detrimental (GM's call).
export const TOXICOLOGIST_ACID = 'acid';
export const TOXICOLOGIST_CHOICE = 'choice';

export class ToxicologistService {
  static isToxicologistInfusedPoison(sourceActor, afflictionData) {
    if (!sourceActor || !FeatsService.hasFeat(sourceActor, 'toxicologist')) return false;
    const traits = Array.isArray(afflictionData?.traits) ? afflictionData.traits : [];
    return traits.includes('infused') && (afflictionData.type === 'poison' || traits.includes('poison'));
  }

  static getBypassedImmunities(sourceActor, afflictionData, matchingImmunities) {
    if (!this.isToxicologistInfusedPoison(sourceActor, afflictionData)) return [];
    return matchingImmunities.filter(type => type === 'poison');
  }

  static isImmuneToPoison(actor) {
    const immunities = actor?.system?.attributes?.immunities;
    return Array.isArray(immunities) && immunities.some(immunity => immunity?.type === 'poison');
  }

  static getDamageMode(targetActor, sourceActor, afflictionData) {
    if (!this.isToxicologistInfusedPoison(sourceActor, afflictionData)) return null;
    return this.isImmuneToPoison(targetActor) ? TOXICOLOGIST_ACID : TOXICOLOGIST_CHOICE;
  }

  static resolveDamageType(type, affliction) {
    return type === 'poison' && affliction?.toxicologistDamage === TOXICOLOGIST_ACID ? 'acid' : type;
  }

  static offersAcidChoice(type, affliction) {
    return type === 'poison' && affliction?.toxicologistDamage === TOXICOLOGIST_CHOICE;
  }
}
