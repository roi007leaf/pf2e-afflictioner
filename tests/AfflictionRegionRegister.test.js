import {
  AFFLICTION_REGION_BEHAVIOR_TYPE,
  AfflictionRegionBehavior
} from '../scripts/regions/AfflictionRegionBehavior.js';
import {
  registerAfflictionRegionBehavior,
  registerAfflictionRegionHooks
} from '../scripts/regions/register.js';

describe('AfflictionRegion registration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.CONFIG = {
      RegionBehavior: {
        dataModels: {},
        typeLabels: {},
        typeIcons: {}
      }
    };
  });

  afterEach(() => {
    delete global.CONFIG;
  });

  test('registers the affliction behavior data model immediately', () => {
    registerAfflictionRegionBehavior();

    expect(CONFIG.RegionBehavior.dataModels[AFFLICTION_REGION_BEHAVIOR_TYPE]).toBe(AfflictionRegionBehavior);
  });

  test('registers data model on init before region documents prepare systems', () => {
    const hooks = { once: jest.fn() };

    registerAfflictionRegionHooks(hooks);

    expect(hooks.once).toHaveBeenCalledWith('init', expect.any(Function));
    expect(hooks.once).toHaveBeenCalledWith('ready', expect.any(Function));
  });
});
