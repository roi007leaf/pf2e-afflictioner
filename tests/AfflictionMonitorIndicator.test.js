import { AfflictionMonitorIndicator } from '../scripts/ui/AfflictionMonitorIndicator.js';

function createToken({ id = 'token-1', name = 'Alon', actorId = 'actor-1', afflictions = {} } = {}) {
  const actor = {
    id: actorId,
    name,
    getFlag: jest.fn((_moduleId, key) => (key === 'afflictions' ? afflictions : undefined)),
  };
  return {
    id,
    name,
    actor,
    document: {
      id,
      actorLink: true,
      getFlag: jest.fn((_moduleId, key) => (key === 'afflictions' ? afflictions : undefined)),
    },
  };
}

function createAffliction({ name = 'Flyleaf', needsInitialSave = true } = {}) {
  return {
    id: name.toLowerCase(),
    name,
    needsInitialSave,
    currentStage: needsInitialSave ? -1 : 1,
    stages: [{ duration: { value: 1, unit: 'round' } }],
  };
}

describe('AfflictionMonitorIndicator popover', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    localStorage.clear();
    jest.clearAllMocks();

    global.canvas = {
      tokens: {
        controlled: [],
        placeables: [],
      },
    };
    global.game.actors = [];
    global.game.combat = null;
    global.game.user = { isGM: true };
  });

  test('hover does not open an affliction summary', () => {
    const token = createToken({ afflictions: { flyleaf: createAffliction() } });
    canvas.tokens.placeables = [token];
    const indicator = new AfflictionMonitorIndicator();

    indicator.refresh();
    document.querySelector('.pf2e-afflictioner-monitor').dispatchEvent(new MouseEvent('mouseenter'));

    expect(document.querySelector('.pf2e-afflictioner-tooltip')).toBeNull();
    expect(document.querySelector('.pf2e-afflictioner-popover')).toBeNull();
  });

  test('click pins an interactive panel that survives monitor mouseleave and closes from its close button', () => {
    const token = createToken({ afflictions: { flyleaf: createAffliction() } });
    canvas.tokens.placeables = [token];
    const indicator = new AfflictionMonitorIndicator();

    indicator.refresh();
    const monitor = document.querySelector('.pf2e-afflictioner-monitor');
    monitor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    monitor.dispatchEvent(new MouseEvent('mouseleave'));

    const popover = document.querySelector('.pf2e-afflictioner-popover');
    expect(popover).not.toBeNull();
    expect(popover.querySelector('.tip-group.clickable')).not.toBeNull();
    expect(popover.querySelector('.tip-footer')).toBeNull();

    popover.querySelector('.popover-close').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.pf2e-afflictioner-popover')).toBeNull();
  });

  test('pinned panel closes on outside click and Escape', () => {
    const token = createToken({ afflictions: { flyleaf: createAffliction() } });
    canvas.tokens.placeables = [token];
    const indicator = new AfflictionMonitorIndicator();

    indicator.refresh();
    const monitor = document.querySelector('.pf2e-afflictioner-monitor');

    monitor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.pf2e-afflictioner-popover')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.pf2e-afflictioner-popover')).toBeNull();

    monitor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.pf2e-afflictioner-popover')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.pf2e-afflictioner-popover')).toBeNull();
  });

  test('clicking an affliction row opens the manager for that token', () => {
    const token = createToken({ afflictions: { flyleaf: createAffliction() } });
    canvas.tokens.placeables = [token];
    const indicator = new AfflictionMonitorIndicator();
    const openManagerSpy = jest.spyOn(indicator, 'openManager').mockResolvedValue();

    indicator.refresh();
    document.querySelector('.pf2e-afflictioner-monitor').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.affliction-item').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(openManagerSpy).toHaveBeenCalledWith('token-1', 'actor-1');
  });
});
