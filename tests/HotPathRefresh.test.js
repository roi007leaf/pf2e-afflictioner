const MODULE_ID = 'pf2e-afflictioner';

function hasProperty(object, path) {
  if (!object || !path) return false;
  if (Object.prototype.hasOwnProperty.call(object, path)) return true;
  if (Object.keys(object).some((key) => key.startsWith(`${path}.`))) return true;
  return path.split('.').reduce((current, part) => current?.[part], object) !== undefined;
}

function captureHooks() {
  const handlers = new Map();
  return {
    handlers,
    on: jest.fn((name, fn) => {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
      return fn;
    }),
    fire(name, ...args) {
      for (const fn of handlers.get(name) ?? []) fn(...args);
    },
  };
}

function plainToken(id, { afflictions = {}, hasAffliction, tint = '#ffffff' } = {}) {
  const flags = { afflictions, hasAffliction };
  const document = {
    id,
    actorLink: false,
    texture: { tint },
    _source: { texture: { tint } },
    getFlag: jest.fn((_scope, key) => flags[key]),
    setFlag: jest.fn(async () => {}),
    unsetFlag: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
  };
  return { id, document, actor: null };
}

describe('scene-wide indicator refresh avoids redundant work', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Hooks = captureHooks();
    global.foundry = { utils: { hasProperty } };
    global.game.user = { isGM: true };
  });

  test('canvasReady reads the indicator setting once and writes nothing for tokens already in the right state', async () => {
    const quiet = Array.from({ length: 600 }, (_, index) => plainToken(`t${index}`));
    const afflicted = plainToken('sick', {
      afflictions: { flyleaf: { id: 'flyleaf' } },
      hasAffliction: true,
      tint: '#ffdfdf',
    });
    global.canvas = { tokens: { placeables: [...quiet, afflicted] } };
    global.game.settings.get = jest.fn(() => true);
    const { VisualService } = await import('../scripts/services/VisualService.js');

    await VisualService.refreshAllIndicators();

    expect(game.settings.get).toHaveBeenCalledTimes(1);
    for (const token of [...quiet, afflicted]) {
      expect(token.document.setFlag).not.toHaveBeenCalled();
      expect(token.document.unsetFlag).not.toHaveBeenCalled();
      expect(token.document.update).not.toHaveBeenCalled();
    }
  });

  test('an affliction still gets flagged and a cleared token still gets unflagged', async () => {
    const newlySick = plainToken('new', { afflictions: { flyleaf: { id: 'flyleaf' } } });
    const recovered = plainToken('old', { hasAffliction: true, tint: '#ffdfdf' });
    global.canvas = { tokens: { placeables: [newlySick, recovered] } };
    global.game.settings.get = jest.fn(() => true);
    const { VisualService } = await import('../scripts/services/VisualService.js');

    await VisualService.refreshAllIndicators();

    expect(newlySick.document.setFlag).toHaveBeenCalledWith(MODULE_ID, 'hasAffliction', true);
    expect(recovered.document.unsetFlag).toHaveBeenCalledWith(MODULE_ID, 'hasAffliction');
  });
});

describe('affliction monitor hooks', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.Hooks = captureHooks();
    global.foundry = { utils: { hasProperty } };
  });

  afterEach(() => jest.useRealTimers());

  test('token moves and unrelated actor updates do not rescan the monitor; affliction changes do once', async () => {
    const { registerAfflictionMonitorHooks } = await import('../scripts/ui/AfflictionMonitorIndicator.js');
    const indicator = { refresh: jest.fn() };
    registerAfflictionMonitorHooks(indicator);

    for (let index = 0; index < 50; index += 1) {
      Hooks.fire('updateToken', { id: `t${index}` }, { x: index, y: index });
      Hooks.fire('updateActor', { id: `a${index}` }, { system: { attributes: { hp: { value: index } } } });
    }
    jest.runAllTimers();
    expect(indicator.refresh).not.toHaveBeenCalled();

    Hooks.fire('updateToken', { id: 't1' }, { flags: { [MODULE_ID]: { afflictions: {} } } });
    Hooks.fire('updateActor', { id: 'a1' }, { [`flags.${MODULE_ID}.afflictions`]: {} });
    jest.runAllTimers();
    expect(indicator.refresh).toHaveBeenCalledTimes(1);
  });

  test('a burst of token selections refreshes the monitor once', async () => {
    const { registerAfflictionMonitorHooks } = await import('../scripts/ui/AfflictionMonitorIndicator.js');
    const indicator = { refresh: jest.fn() };
    registerAfflictionMonitorHooks(indicator);

    for (let index = 0; index < 100; index += 1) Hooks.fire('controlToken', { id: `t${index}` }, index % 2 === 0);
    jest.runAllTimers();
    expect(indicator.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('token tools scene-control refresh', () => {
  beforeEach(() => {
    jest.resetModules();
    global.foundry = { utils: { hasProperty } };
    global.canvas = { tokens: { controlled: [] } };
    global.ui.controls = { render: jest.fn() };
    global.game.settings.get = jest.fn(() => true);
  });

  test('a burst of selections reads the setting and re-renders scene controls once', async () => {
    const { onControlToken } = await import('../scripts/hooks/tokenTools.js');
    for (let index = 0; index < 100; index += 1) onControlToken({ id: `t${index}` }, true);
    await Promise.resolve();
    expect(game.settings.get).toHaveBeenCalledTimes(1);
    expect(ui.controls.render).toHaveBeenCalledTimes(1);
  });

  test('token updates without afflictioner flags never read settings', async () => {
    const { onUpdateToken } = await import('../scripts/hooks/tokenTools.js');
    for (let index = 0; index < 20; index += 1) onUpdateToken({ id: `t${index}` }, { x: index });
    expect(game.settings.get).not.toHaveBeenCalled();
  });
});
