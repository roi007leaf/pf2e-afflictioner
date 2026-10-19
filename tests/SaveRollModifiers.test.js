import { buildSaveRollModifiers } from '../scripts/handlers/saveButtons.js';

describe('buildSaveRollModifiers', () => {
  afterEach(() => {
    delete game.pf2e;
  });

  test('turns stored feat modifiers into PF2e modifiers', () => {
    game.pf2e = { Modifier: class { constructor(data) { Object.assign(this, data); } } };
    const [modifier] = buildSaveRollModifiers({ saveModifiers: [{ label: 'Pinpoint Poisoner', value: -2, type: 'circumstance' }] });
    expect(modifier).toEqual(expect.objectContaining({ label: 'Pinpoint Poisoner', modifier: -2, type: 'circumstance' }));
  });

  test('returns nothing without stored modifiers or the PF2e API', () => {
    game.pf2e = { Modifier: class {} };
    expect(buildSaveRollModifiers({})).toEqual([]);
    delete game.pf2e;
    expect(buildSaveRollModifiers({ saveModifiers: [{ label: 'x', value: 2 }] })).toEqual([]);
  });
});
