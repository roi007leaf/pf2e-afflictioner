describe('custom affliction icons', () => {
  const customIcon = 'icons/commodities/materials/powder-red.webp';

  beforeEach(() => {
    jest.resetModules();
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
      utils: {
        deepClone: value => JSON.parse(JSON.stringify(value)),
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete global.fromUuid;
  });

  test('editor data preserves a custom icon path', async () => {
    const { AfflictionEditorService } = await import('../scripts/services/AfflictionEditorService.js');

    const prepared = AfflictionEditorService.prepareEditStructure({
      name: 'Radiation Sickness',
      type: 'disease',
      dc: 22,
      img: customIcon,
    });
    const merged = AfflictionEditorService.applyEditedDefinition(
      { name: 'Radiation Sickness', type: 'disease', dc: 20 },
      { img: customIcon },
    );

    expect(prepared.img).toBe(customIcon);
    expect(merged.img).toBe(customIcon);
  });

  test('saved custom affliction list uses stored icon', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');

    game.settings.get = jest.fn(() => ({
      'custom-radiation-sickness-disease': {
        name: 'Radiation Sickness',
        type: 'disease',
        dc: 22,
        stages: [{ number: 1 }],
        img: customIcon,
      },
    }));

    const dialog = Object.create(AddAfflictionDialog.prototype);
    const [saved] = dialog.getSavedCustomAfflictions();

    expect(saved.img).toBe(customIcon);
  });

  test('applied custom affliction effect uses stored icon', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    jest.spyOn(AfflictionEffectBuilder, '_buildRulesFromStage').mockResolvedValue([]);
    jest.spyOn(AfflictionEffectBuilder, '_buildStageDescription').mockReturnValue('<p>Stage 1</p>');
    jest.spyOn(AfflictionEffectBuilder, 'shouldBeUnidentified').mockReturnValue(false);
    jest.spyOn(AfflictionEffectBuilder, '_buildBadgeConfig').mockReturnValue({ type: 'counter', value: 1 });
    jest.spyOn(AfflictionEffectBuilder, '_buildDurationConfig').mockReturnValue({ value: 1, unit: 'hour' });

    const actor = {
      createEmbeddedDocuments: jest.fn(async (_type, docs) => [{ uuid: 'Actor.actor-1.Item.effect-1', docs }]),
    };

    await AfflictionEffectBuilder.createEffect(
      { id: 'token-1' },
      actor,
      {
        id: 'affliction-1',
        name: 'Radiation Sickness',
        currentStage: 1,
        img: customIcon,
      },
      { number: 1, effects: 'Sickened 1' },
      [],
    );

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        type: 'effect',
        name: 'Radiation Sickness',
        img: customIcon,
      }),
    ]);
  });

  test('updated custom affliction effect uses stored icon', async () => {
    const { AfflictionEffectBuilder } = await import('../scripts/services/AfflictionEffectBuilder.js');

    jest.spyOn(AfflictionEffectBuilder, '_buildRulesFromStage').mockResolvedValue([]);
    jest.spyOn(AfflictionEffectBuilder, '_buildStageDescription').mockReturnValue('<p>Stage 1</p>');
    jest.spyOn(AfflictionEffectBuilder, 'shouldBeUnidentified').mockReturnValue(false);
    jest.spyOn(AfflictionEffectBuilder, '_buildBadgeConfig').mockReturnValue({ type: 'counter', value: 1 });
    jest.spyOn(AfflictionEffectBuilder, '_buildDurationConfig').mockReturnValue({ value: 1, unit: 'hour' });

    const effect = { update: jest.fn() };
    global.fromUuid = jest.fn(async () => effect);

    await AfflictionEffectBuilder.updateEffect(
      { id: 'token-1' },
      {},
      {
        id: 'affliction-1',
        name: 'Radiation Sickness',
        currentStage: 1,
        img: customIcon,
        appliedEffectUuid: 'Actor.actor-1.Item.effect-1',
      },
      { number: 1, effects: 'Sickened 1' },
      [],
    );

    expect(effect.update).toHaveBeenCalledWith(expect.objectContaining({
      img: customIcon,
    }));
  });
});
