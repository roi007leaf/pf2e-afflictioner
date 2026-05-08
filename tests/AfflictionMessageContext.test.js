import { applyMessageAfflictionContext } from '../scripts/utils.js';

describe('message affliction context extraction', () => {
  test('overrides placeholder item DC with spell card DC', () => {
    const afflictionData = { dc: 15, saveType: 'fortitude' };
    const message = {
      content: '<button type="button" data-action="spell-save" data-save="will" data-dc="31"></button>',
      flags: {},
    };

    applyMessageAfflictionContext(afflictionData, message);

    expect(afflictionData.dc).toBe(31);
    expect(afflictionData.saveType).toBe('will');
  });

  test('reads inline PF2e check DC when no spell card button exists', () => {
    const afflictionData = { dc: 15, saveType: 'fortitude' };
    const message = {
      content: '<a class="inline-check" data-pf2-check="will" data-pf2-dc="29">DC 29 Will</a>',
      flags: {},
    };

    applyMessageAfflictionContext(afflictionData, message);

    expect(afflictionData.dc).toBe(29);
    expect(afflictionData.saveType).toBe('will');
  });
});
