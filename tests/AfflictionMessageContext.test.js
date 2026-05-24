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

  test('does not replace affliction DC with attack roll target AC', () => {
    const afflictionData = { dc: 25, saveType: 'fortitude' };
    const message = {
      content: '<div class="message-content">Giant Fly attacks the target.</div>',
      flags: {
        pf2e: {
          context: {
            type: 'attack-roll',
            dc: {
              scope: 'attack',
              slug: 'armor',
              value: 22,
            },
          },
        },
      },
    };

    applyMessageAfflictionContext(afflictionData, message);

    expect(afflictionData.dc).toBe(25);
    expect(afflictionData.saveType).toBe('fortitude');
  });

  test('prefers inline save DC over attack roll target AC', () => {
    const afflictionData = { dc: 25, saveType: 'fortitude' };
    const message = {
      content: '<a class="inline-check" data-pf2-check="will" data-pf2-dc="29">DC 29 Will</a>',
      flags: {
        pf2e: {
          context: {
            type: 'attack-roll',
            dc: {
              scope: 'attack',
              slug: 'armor',
              value: 22,
            },
          },
        },
      },
    };

    applyMessageAfflictionContext(afflictionData, message);

    expect(afflictionData.dc).toBe(29);
    expect(afflictionData.saveType).toBe('will');
  });

  test('uses non-attack flag DC when no inline save DC exists', () => {
    const afflictionData = { dc: 15, saveType: 'fortitude' };
    const message = {
      content: '',
      flags: {
        pf2e: {
          context: {
            dc: {
              scope: 'spell',
              slug: 'poison',
              value: 31,
            },
          },
        },
      },
    };

    applyMessageAfflictionContext(afflictionData, message);

    expect(afflictionData.dc).toBe(31);
  });
});
