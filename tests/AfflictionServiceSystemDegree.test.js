import { DEGREE_OF_SUCCESS } from '../scripts/constants.js';

jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: {},
}));

import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { SocketService } from '../scripts/services/SocketService.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';

function saveMessage({ outcome, dc = 20, total = 22, die = 12 } = {}) {
  return {
    id: 'roll-1',
    rolls: [{ total, dice: [{ faces: 20, results: [{ result: die }] }] }],
    flags: { pf2e: { context: { type: 'saving-throw', outcome, dc: { value: dc } } } },
  };
}

describe('PF2e save outcome', () => {
  test('reads the adjusted outcome PF2e computed for the save', () => {
    expect(AfflictionService.getSystemSaveDegree(saveMessage({ outcome: 'criticalSuccess' }), 20))
      .toBe(DEGREE_OF_SUCCESS.CRITICAL_SUCCESS);
  });

  test('ignores the outcome when the roll was made against a different DC', () => {
    expect(AfflictionService.getSystemSaveDegree(saveMessage({ outcome: 'success', dc: 18 }), 20)).toBeNull();
  });

  test('ignores missing or unknown outcomes', () => {
    expect(AfflictionService.getSystemSaveDegree(saveMessage({ outcome: undefined }), 20)).toBeNull();
    expect(AfflictionService.getSystemSaveDegree(saveMessage({ outcome: 'bogus' }), 20)).toBeNull();
    expect(AfflictionService.getSystemSaveDegree(null, 20)).toBeNull();
  });

  test('PF2e outcome wins over the raw total (e.g. success upgraded to critical success)', () => {
    const result = AfflictionService.calculateAfflictionDegreeResult(
      22, 20, 12, null, null, DEGREE_OF_SUCCESS.CRITICAL_SUCCESS
    );
    expect(result.degree).toBe(DEGREE_OF_SUCCESS.CRITICAL_SUCCESS);
  });

  test('falls back to the raw total when no PF2e outcome is available', () => {
    expect(AfflictionService.calculateAfflictionDegreeResult(22, 20, 12, null, null, null).degree)
      .toBe(DEGREE_OF_SUCCESS.SUCCESS);
  });

  test('incapacitation still upgrades the PF2e outcome', () => {
    const actor = { system: { details: { level: { value: 10 } } } };
    const affliction = { traits: ['incapacitation'], level: 2 };
    const result = AfflictionService.calculateAfflictionDegreeResult(
      15, 20, 8, actor, affliction, DEGREE_OF_SUCCESS.FAILURE
    );
    expect(result.degree).toBe(DEGREE_OF_SUCCESS.SUCCESS);
    expect(result.incapacitationApplied).toBe(true);
  });
});

describe('SocketService passes the PF2e outcome to save handling', () => {
  const affliction = { id: 'aff-1', name: 'Giant Scorpion Venom', traits: ['poison'] };
  const actor = { id: 'actor-1', name: 'Kholo' };
  const token = { id: 'token-1', name: 'Kholo', actor };

  beforeEach(() => {
    game.user = { isGM: true };
    game.users = [{ id: 'gm-1', isGM: true }];
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({}));
    global.canvas = { tokens: { get: jest.fn(() => token) } };
    game.settings.get = jest.fn(() => false);
    jest.spyOn(AfflictionStore, 'getAffliction').mockReturnValue(affliction);
    jest.spyOn(global, 'setTimeout').mockImplementation(fn => { fn(); return 0; });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
  });

  test('immediate stage save', async () => {
    const message = saveMessage({ outcome: 'criticalSuccess', total: 22 });
    game.messages = { get: jest.fn(() => message) };
    const handleStageSave = jest.spyOn(AfflictionService, 'handleStageSave').mockResolvedValue(undefined);

    await SocketService.gmHandleSave('token-1', 'aff-1', 'roll-1', 20, null);

    expect(handleStageSave).toHaveBeenCalledWith(
      token, affliction, 22, 20, false, 12, actor, DEGREE_OF_SUCCESS.CRITICAL_SUCCESS
    );
  });

  test('immediate initial save', async () => {
    const message = saveMessage({ outcome: 'criticalSuccess', total: 22 });
    game.messages = { get: jest.fn(() => message) };
    const handleInitialSave = jest.spyOn(AfflictionService, 'handleInitialSave').mockResolvedValue(undefined);

    await SocketService.gmHandleInitialSave('token-1', 'aff-1', 'roll-1', 20, null);

    expect(handleInitialSave).toHaveBeenCalledWith(
      token, affliction, 22, 20, 12, actor, DEGREE_OF_SUCCESS.CRITICAL_SUCCESS
    );
  });

  test('confirmed save consequences', async () => {
    const message = saveMessage({ outcome: 'criticalSuccess', total: 22 });
    game.messages = { get: jest.fn(() => message) };
    const handleStageSave = jest.spyOn(AfflictionService, 'handleStageSave').mockResolvedValue(undefined);

    await SocketService.gmApplySaveConsequences('token-1', 'aff-1', 'roll-1', 20, 'stage', null);

    expect(handleStageSave).toHaveBeenCalledWith(
      token, affliction, 22, 20, false, 12, actor, DEGREE_OF_SUCCESS.CRITICAL_SUCCESS
    );
  });
});
