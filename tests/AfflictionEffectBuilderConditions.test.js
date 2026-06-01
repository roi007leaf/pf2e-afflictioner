describe('AfflictionEffectBuilder condition lookup', () => {
  beforeEach(() => {
    jest.resetModules();
    game.system = { id: 'pf2e' };
    game.packs = { get: jest.fn(() => null) };
    game.pf2e = {
      ConditionManager: {
        getCondition: jest.fn(slug => ({
          slug,
          uuid: `Compendium.pf2e.conditionitems.Item.${slug}`,
        })),
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete game.system;
    delete game.pf2e;
  });

  test('uses PF2e ConditionManager as the source of truth for condition UUIDs', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    await expect(AfflictionEffectBuilder.getConditionUuid('stunned')).resolves.toBe(
      'Compendium.pf2e.conditionitems.Item.stunned',
    );
    expect(game.pf2e.ConditionManager.getCondition).toHaveBeenCalledWith('stunned');
    expect(game.packs.get).not.toHaveBeenCalled();
  });

  test('falls back to condition compendium index when ConditionManager is unavailable', async () => {
    delete game.pf2e;
    const pack = {
      collection: 'pf2e.conditionitems',
      getIndex: jest.fn(async () => [
        { _id: 'persistent-damage-id', name: 'Persistent Damage', system: { slug: 'persistent-damage' } },
      ]),
    };
    game.packs.get = jest.fn(collection => (collection === 'pf2e.conditionitems' ? pack : null));
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    await expect(AfflictionEffectBuilder.getConditionUuid('persistent damage')).resolves.toBe(
      'Compendium.pf2e.conditionitems.Item.persistent-damage-id',
    );
    expect(pack.getIndex).toHaveBeenCalledWith({ fields: ['system.slug'] });
  });

  test('builds stage GrantItem rules from condition manager UUIDs', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    const rules = await AfflictionEffectBuilder._buildRulesFromStage(
      { name: 'Test Affliction' },
      { conditions: [{ name: 'enfeebled', value: 2 }] },
      [],
    );

    expect(rules).toEqual([
      expect.objectContaining({
        key: 'GrantItem',
        uuid: 'Compendium.pf2e.conditionitems.Item.enfeebled',
        alterations: [
          {
            mode: 'override',
            property: 'badge-value',
            value: 2,
          },
        ],
      }),
    ]);
  });

  test('builds GrantItem rules for multiple edited stage conditions', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    const rules = await AfflictionEffectBuilder._buildRulesFromStage(
      { name: 'Rust Creep' },
      { conditions: [{ name: 'enfeebled', value: 1 }, { name: 'stupefied', value: 1 }] },
      [],
    );

    expect(rules).toEqual([
      expect.objectContaining({
        key: 'GrantItem',
        uuid: 'Compendium.pf2e.conditionitems.Item.enfeebled',
      }),
      expect.objectContaining({
        key: 'GrantItem',
        uuid: 'Compendium.pf2e.conditionitems.Item.stupefied',
      }),
    ]);
  });

  test('includes rule elements added through the affliction editor', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    const editorRule = {
      key: 'FlatModifier',
      selector: 'athletics',
      type: 'status',
      value: -1,
      label: 'Rust Creep - Stage 1',
    };

    const rules = await AfflictionEffectBuilder._buildRulesFromStage(
      { name: 'Rust Creep' },
      { effects: 'Athletics Penalty', ruleElements: [editorRule] },
      [],
    );

    expect(rules).toContainEqual(editorRule);
  });

  test('does not duplicate editor rule elements that match parsed flat modifiers', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    const editorRule = {
      key: 'FlatModifier',
      selector: 'athletics',
      type: 'status',
      value: -1,
      label: 'Rust Creep - Stage 1',
    };

    const rules = await AfflictionEffectBuilder._buildRulesFromStage(
      { name: 'Rust Creep' },
      { ruleElements: [editorRule] },
      [{ selector: 'athletics', type: 'status', value: -1 }],
    );

    expect(rules.filter(rule => rule.key === 'FlatModifier' && rule.selector === 'athletics')).toHaveLength(1);
    expect(rules).toContainEqual(editorRule);
  });
});
