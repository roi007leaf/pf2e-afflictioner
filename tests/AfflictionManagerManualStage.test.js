describe('AfflictionManager manual stage controls', () => {
  function buildAffliction(currentStage) {
    return {
      id: 'affliction-1',
      name: 'Test Incapacitation Disease',
      type: 'disease',
      level: 5,
      traits: ['disease', 'incapacitation'],
      currentStage,
      needsInitialSave: false,
      isVirulent: false,
      stages: [
        { number: 1, damage: [], conditions: [], weakness: [] },
        { number: 2, damage: [], conditions: [], weakness: [] },
        { number: 3, damage: [], conditions: [], weakness: [] },
      ],
    };
  }

  function buildToken(affliction) {
    const actor = {
      id: 'actor-1',
      name: 'Test Actor',
      type: 'character',
      system: { details: { level: { value: 6 } } },
      itemTypes: { effect: [] },
    };

    return {
      id: 'token-1',
      name: 'Test Token',
      actor,
      document: {
        actorLink: true,
        texture: {},
      },
      _affliction: affliction,
    };
  }

  async function runStageAction(action, affliction) {
    jest.resetModules();
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };

    const token = buildToken(affliction);
    global.canvas = {
      tokens: {
        get: jest.fn(() => token),
        controlled: [],
        placeables: [token],
      },
    };
    game.combat = null;
    game.time = { worldTime: 0 };
    game.user.isGM = true;
    game.i18n.localize = jest.fn(key => key);
    game.i18n.format = jest.fn(key => key);
    ui.notifications.info = jest.fn();
    ui.notifications.warn = jest.fn();
    ui.notifications.error = jest.fn();

    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const { AfflictionService } = await import('../scripts/services/AfflictionService.js');
    const AfflictionStore = await import('../scripts/stores/AfflictionStore.js');
    const { AfflictionChatService } = await import('../scripts/services/AfflictionChatService.js');

    const handleStageSaveSpy = jest.spyOn(AfflictionService, 'handleStageSave');
    jest.spyOn(AfflictionStore, 'getAffliction').mockImplementation(() => token._affliction);
    jest.spyOn(AfflictionStore, 'updateAffliction').mockImplementation(async (_token, _id, updates) => {
      token._affliction = { ...token._affliction, ...updates };
    });
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue(undefined);
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue(undefined);
    jest.spyOn(AfflictionChatService, 'postStageChange').mockResolvedValue(undefined);

    const button = document.createElement('button');
    button.dataset.tokenId = 'token-1';
    button.dataset.afflictionId = 'affliction-1';
    const app = { playerCoatingOnly: false, render: jest.fn() };

    await AfflictionManager[action].call(app, null, button);

    delete global.canvas;
    delete global.foundry;

    return { token, app, handleStageSaveSpy };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
    delete global.foundry;
  });

  test('progress stage increases exactly one stage even when incapacitation would upgrade a real save', async () => {
    const { token, app, handleStageSaveSpy } = await runStageAction('progressStage', buildAffliction(1));

    expect(token._affliction.currentStage).toBe(2);
    expect(handleStageSaveSpy).not.toHaveBeenCalled();
    expect(app.render).toHaveBeenCalledWith({ force: true });
  });

  test('regress stage decreases exactly one stage even when incapacitation would upgrade a real save', async () => {
    const { token, app, handleStageSaveSpy } = await runStageAction('regressStage', buildAffliction(3));

    expect(token._affliction.currentStage).toBe(2);
    expect(handleStageSaveSpy).not.toHaveBeenCalled();
    expect(app.render).toHaveBeenCalledWith({ force: true });
  });
});
