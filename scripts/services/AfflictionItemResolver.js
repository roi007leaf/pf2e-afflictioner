import { AfflictionParser } from './AfflictionParser.js';
import { AfflictionService } from './AfflictionService.js';
import { shouldSkipPromptAffliction } from '../utils.js';

export class AfflictionItemResolver {
  static async resolveFromItem(item, options = {}) {
    if (!item) return null;

    const direct = AfflictionParser.parseFromItem(item);
    if (!shouldSkipPromptAffliction(direct)) {
      this._applyOriginMetadata(direct, item, options);
      return direct;
    }

    const referenced = await this.resolveReferencedFromItem(item, options);
    if (referenced) return referenced;

    return direct;
  }

  static async resolveReferencedFromItem(item, options = {}) {
    const description = item.system?.description?.value || '';
    const references = AfflictionParser.extractReferencedAfflictions(description);
    if (references.length === 0) return null;

    const originActor = options.originActor || item.parent || null;
    for (const refName of references) {
      const refItem = await AfflictionService.findReferencedItem(refName, originActor);
      if (!refItem) continue;

      const refData = AfflictionParser.parseFromItem(refItem);
      if (shouldSkipPromptAffliction(refData)) continue;

      this._applyOriginMetadata(refData, item, options);
      refData.referencedFromItemUuid = item.uuid;
      refData.triggerItemUuid = item.uuid;
      refData.triggerItemName = item.name;
      return refData;
    }

    return null;
  }

  static hasDirectOrReferencedAfflictionText(item) {
    if (AfflictionParser.getAfflictionType(item)) return true;
    const description = item.system?.description?.value || '';
    return AfflictionParser.extractReferencedAfflictions(description).length > 0;
  }

  static _applyOriginMetadata(afflictionData, item, options = {}) {
    if (!afflictionData) return;

    const originActor = options.originActor || item.parent || null;
    afflictionData.originActorUuid = originActor?.uuid || afflictionData.originActorUuid || null;
    afflictionData.originActorId = originActor?.id || afflictionData.originActorId || null;
  }
}
