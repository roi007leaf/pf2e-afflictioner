describe('AfflictionManager coating tooltips', () => {
  beforeEach(() => {
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };
    game.i18n.format = jest.fn((key, data = {}) => {
      if (key === 'PF2E_AFFLICTIONER.WEAPON_COATING.TOOLTIP_DC') return `DC ${data.dc} Fortitude Save`;
      if (key === 'PF2E_AFFLICTIONER.WEAPON_COATING.TOOLTIP_STAGE') return `Stage ${data.number}: ${data.effects}`;
      if (key === 'PF2E_AFFLICTIONER.WEAPON_COATING.TOOLTIP_DOUBLE_STAGE') return `Stage ${data.number}:`;
      if (key === 'PF2E_AFFLICTIONER.WEAPON_COATING.TOOLTIP_DOUBLE_COMPONENT') return `${data.poisonName}: ${data.effects}`;
      return key;
    });
    game.i18n.localize = jest.fn(key => key);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
  });

  test('formats double poison stage effects as labeled component lines', async () => {
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');

    const tooltip = AfflictionManager._formatCoatingTooltip({
      name: 'Double Poison: Aconite + Belladonna',
      dc: 21,
      doublePoison: true,
      stages: [
        {
          number: 1,
          effects: 'Aconite stage 1<br>Belladonna stage 1',
          componentEffects: [
            { poisonName: 'Aconite', effects: '@Damage[1d6[poison]] damage' },
            { poisonName: 'Belladonna', effects: 'Sickened 1' },
          ],
        },
      ],
    });

    expect(tooltip).toContain('Stage 1:');
    expect(tooltip).toContain('Aconite: 1d6 (poison damage) damage');
    expect(tooltip).toContain('Belladonna: Sickened 1');
    expect(tooltip).not.toContain('Aconite stage 1<br>Belladonna stage 1');
  });
});
