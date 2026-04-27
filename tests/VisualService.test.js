const MODULE_ID = 'pf2e-afflictioner';

function hasProperty(object, path) {
  if (!object || !path) return false;
  if (Object.prototype.hasOwnProperty.call(object, path)) return true;
  if (Object.keys(object).some((key) => key.startsWith(`${path}.`))) return true;

  return path.split('.').reduce((current, part) => current?.[part], object) !== undefined;
}

async function importVisualService() {
  return import('../scripts/services/VisualService.js');
}

describe('VisualService hook registration', () => {
  let hooks;

  beforeEach(() => {
    jest.resetModules();
    hooks = new Map();

    global.Hooks = {
      on: jest.fn((eventName, callback) => {
        hooks.set(eventName, callback);
        return callback;
      }),
    };
    global.canvas = {
      tokens: {
        placeables: [],
      },
    };
    global.foundry = {
      utils: {
        hasProperty,
      },
    };
    global.game.settings.get = jest.fn(() => true);
  });

  test('does not attach indicator refreshes to the per-frame refreshToken hook', async () => {
    await importVisualService();

    expect(hooks.has('refreshToken')).toBe(false);
    expect(hooks.has('canvasReady')).toBe(true);
    expect(hooks.has('createItem')).toBe(true);
    expect(hooks.has('updateItem')).toBe(true);
    expect(hooks.has('deleteItem')).toBe(true);
    expect(hooks.has('updateActor')).toBe(true);
    expect(hooks.has('controlToken')).toBe(true);
  });

  test('item hooks refresh active tokens for the owning actor', async () => {
    const { VisualService } = await importVisualService();
    const refreshSpy = jest.spyOn(VisualService, 'refreshTokenIndicator').mockImplementation(() => {});
    const token = { id: 'token-1' };
    const actor = {
      getActiveTokens: jest.fn(() => [token]),
    };

    hooks.get('createItem')({ actor });

    expect(actor.getActiveTokens).toHaveBeenCalledWith(true, false);
    expect(refreshSpy).toHaveBeenCalledWith(token);
  });

  test('updateActor refreshes only when actor state can affect afflictions', async () => {
    const { VisualService } = await importVisualService();
    const refreshSpy = jest.spyOn(VisualService, 'refreshTokenIndicator').mockImplementation(() => {});
    const token = { id: 'token-1' };
    const actor = {
      getActiveTokens: jest.fn(() => [token]),
    };

    hooks.get('updateActor')(actor, { name: 'New Name' });
    expect(refreshSpy).not.toHaveBeenCalled();

    hooks.get('updateActor')(actor, { system: { attributes: { hp: { value: 5 } } } });
    expect(refreshSpy).toHaveBeenCalledWith(token);

    refreshSpy.mockClear();
    hooks.get('updateActor')(actor, { [`flags.${MODULE_ID}.afflictions`]: { poison: {} } });
    expect(refreshSpy).toHaveBeenCalledWith(token);
  });

  test('controlToken refreshes the controlled token once', async () => {
    const { VisualService } = await importVisualService();
    const refreshSpy = jest.spyOn(VisualService, 'refreshTokenIndicator').mockImplementation(() => {});
    const token = { id: 'token-1' };

    hooks.get('controlToken')(token, false);
    expect(refreshSpy).not.toHaveBeenCalled();

    hooks.get('controlToken')(token, true);
    expect(refreshSpy).toHaveBeenCalledWith(token);
  });
});
