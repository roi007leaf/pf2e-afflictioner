import { VisionerIntegrationService } from '../scripts/services/VisionerIntegrationService.js';

describe('VisionerIntegrationService', () => {
  let storedAfflictions;
  let observer;
  let darkvisionTarget;
  let greaterDarkvisionTarget;
  let brightTarget;
  let visionerApi;

  beforeEach(() => {
    storedAfflictions = {
      'affliction-1': {
        id: 'affliction-1',
        currentStage: 2,
      },
    };

    observer = {
      id: 'observer',
      actor: { id: 'actor-observer' },
      document: {
        actorLink: false,
        getFlag: jest.fn((_moduleId, key) => key === 'afflictions' ? storedAfflictions : null),
        setFlag: jest.fn(async (_moduleId, key, value) => {
          if (key === 'afflictions') storedAfflictions = value;
        }),
      },
    };
    darkvisionTarget = { id: 'darkvision-target', actor: { id: 'actor-darkvision' } };
    greaterDarkvisionTarget = { id: 'greater-darkvision-target', actor: { id: 'actor-greater' } };
    brightTarget = { id: 'bright-target', actor: { id: 'actor-bright' } };

    visionerApi = {
      getVisibility: jest.fn((_observerId, targetId) => targetId === darkvisionTarget.id ? 'observed' : 'concealed'),
      getVisibilityFactors: jest.fn(async (_observerId, targetId) => {
        if (targetId === darkvisionTarget.id) return { state: 'observed', slugs: ['darkvision'] };
        if (targetId === greaterDarkvisionTarget.id) return { state: 'observed', slugs: ['greater-darkvision'] };
        return { state: 'observed', slugs: ['bright-light'] };
      }),
      setVisibility: jest.fn(async () => true),
    };

    game.modules = new Map([
      ['pf2e-visioner', { active: true, api: visionerApi }],
    ]);
    global.canvas = {
      scene: { id: 'scene-1' },
      tokens: {
        placeables: [observer, darkvisionTarget, greaterDarkvisionTarget, brightTarget],
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
    delete game.modules;
  });

  test('sets only darkvision-dependent targets and stores their prior states', async () => {
    const affliction = storedAfflictions['affliction-1'];
    const stage = {
      number: 2,
      visibilityEffects: [{ state: 'concealed', sense: 'darkvision', only: true }],
    };

    await VisionerIntegrationService.applyStageVisibility(observer, affliction, stage);

    expect(visionerApi.setVisibility).toHaveBeenCalledTimes(2);
    expect(visionerApi.setVisibility).toHaveBeenCalledWith(
      observer.id,
      darkvisionTarget.id,
      'concealed',
      { isAutomatic: true, source: 'pf2e-afflictioner:affliction-1' },
    );
    expect(visionerApi.setVisibility).toHaveBeenCalledWith(
      observer.id,
      greaterDarkvisionTarget.id,
      'concealed',
      { isAutomatic: true, source: 'pf2e-afflictioner:affliction-1' },
    );
    expect(storedAfflictions['affliction-1'].visionerVisibility).toEqual({
      sceneId: 'scene-1',
      stage: 2,
      entries: [
        { targetId: darkvisionTarget.id, previousState: 'observed' },
        { targetId: greaterDarkvisionTarget.id, previousState: 'concealed' },
      ],
    });
  });

  test('restores tracked visibility when leaving the stage', async () => {
    const affliction = storedAfflictions['affliction-1'];
    affliction.visionerVisibility = {
      sceneId: 'scene-1',
      stage: 2,
      entries: [
        { targetId: darkvisionTarget.id, previousState: 'observed' },
        { targetId: greaterDarkvisionTarget.id, previousState: 'concealed' },
      ],
    };

    await VisionerIntegrationService.removeStageVisibility(observer, affliction);

    expect(visionerApi.setVisibility).toHaveBeenCalledWith(
      observer.id,
      darkvisionTarget.id,
      'observed',
      { isAutomatic: true, source: 'pf2e-afflictioner:affliction-1' },
    );
    expect(visionerApi.setVisibility).toHaveBeenCalledWith(
      observer.id,
      greaterDarkvisionTarget.id,
      'concealed',
      { isAutomatic: true, source: 'pf2e-afflictioner:affliction-1' },
    );
    expect(storedAfflictions['affliction-1'].visionerVisibility).toBeNull();
    expect(affliction.visionerVisibility).toBeNull();
  });

  test('does nothing when Visioner is unavailable', async () => {
    game.modules = new Map();

    await VisionerIntegrationService.applyStageVisibility(
      observer,
      storedAfflictions['affliction-1'],
      { visibilityEffects: [{ state: 'hidden', sense: 'darkvision', only: true }] },
    );

    expect(visionerApi.setVisibility).not.toHaveBeenCalled();
  });
});
