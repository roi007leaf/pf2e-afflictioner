import { MODULE_ID } from '../constants.js';
import {
  AFFLICTION_REGION_BEHAVIOR_TYPE,
  AfflictionRegionBehavior
} from './AfflictionRegionBehavior.js';
import { registerAfflictionRegionConfigDrop } from './AfflictionRegionConfigDrop.js';

function registerAfflictionRegionBehavior() {
  if (typeof CONFIG === 'undefined' || !CONFIG.RegionBehavior) return;

  CONFIG.RegionBehavior.dataModels[AFFLICTION_REGION_BEHAVIOR_TYPE] = AfflictionRegionBehavior;
  CONFIG.RegionBehavior.typeLabels[AFFLICTION_REGION_BEHAVIOR_TYPE] =
    'PF2E_AFFLICTIONER.REGION_BEHAVIOR.TYPES.AFFLICTION.label';
  CONFIG.RegionBehavior.typeIcons[AFFLICTION_REGION_BEHAVIOR_TYPE] = 'fa-solid fa-biohazard';
}

if (typeof Hooks !== 'undefined' && Hooks.once) {
  Hooks.once('ready', () => {
    registerAfflictionRegionBehavior();
    registerAfflictionRegionConfigDrop();
  });
} else {
  registerAfflictionRegionBehavior();
  registerAfflictionRegionConfigDrop();
}

export { registerAfflictionRegionBehavior };
