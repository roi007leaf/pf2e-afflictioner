describe('AfflictionManager curse drops', () => {
  beforeEach(() => {
    jest.resetModules();
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };
    global.canvas = {
      tokens: {
        get: jest.fn(),
        controlled: [{ id: 'token-1', name: 'Target', actor: { id: 'actor-1' } }],
      },
    };
    game.i18n.localize = jest.fn(key => key);
    ui.notifications.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
    delete global.foundry;
    delete global.fromUuid;
  });

  test('accepts curse items dragged into the manager', async () => {
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const { AfflictionService } = await import('../scripts/services/AfflictionService.js');
    const promptSpy = jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);
    const curseItem = {
      name: 'Linnorm Death Curse',
      uuid: 'Item.linnorm-death-curse',
      system: {
        traits: { value: ['curse'] },
        description: {
          value:
            '<p><strong>Saving Throw</strong> @Check[will|dc:32]</p>' +
            '<p><strong>Stage 1</strong> doomed 1 (1 day)</p>',
        },
      },
    };
    global.fromUuid = jest.fn(async () => curseItem);
    const app = Object.create(AfflictionManager.prototype);
    app.filterTokenId = null;
    app.render = jest.fn();

    await app._applyDraggedItem('Item.linnorm-death-curse');

    expect(ui.notifications.warn).not.toHaveBeenCalledWith('PF2E_AFFLICTIONER.ERRORS.ITEM_MUST_HAVE_TRAIT');
    expect(promptSpy).toHaveBeenCalledWith(
      global.canvas.tokens.controlled[0],
      expect.objectContaining({ name: 'Linnorm Death Curse', type: 'curse' }),
    );
  });

  test('ordinary add dialog still resolves dropped curses through the affliction parser', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    const { AfflictionService } = await import('../scripts/services/AfflictionService.js');
    const promptSpy = jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue();
    global.fromUuid = jest.fn(async () => ({
      name: 'Curse', uuid: 'Item.curse', system: {
        traits: { value: ['curse'] }, description: { value: '<p>Saving Throw @Check[will|dc:32]</p><p><strong>Stage 1</strong> doomed 1 (1 day)</p>' },
      },
    }));
    const app = new AddAfflictionDialog(canvas.tokens.controlled[0]);
    app.close = jest.fn();
    await app._onDrop({ preventDefault: jest.fn(), dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid: 'Item.curse' }) } });
    expect(promptSpy).toHaveBeenCalledWith(canvas.tokens.controlled[0], expect.objectContaining({ name: 'Curse', dc: 32, type: 'curse', saveType: 'will' }));
    expect(app.close).toHaveBeenCalledTimes(1);
  });
});
