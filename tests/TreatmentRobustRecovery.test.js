
jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: {},
}));

import { TreatmentService } from '../scripts/services/TreatmentService.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { SocketService } from '../scripts/services/SocketService.js';
import { registerTreatmentButtonHandlers } from '../scripts/handlers/treatmentButtons.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';

const robust = [{ type: 'feat', name: 'Robust Recovery', system: { slug: 'robust-recovery' } }];

function patient(items = []) {
  return { id: 'patient', name: 'Patient', items, createEmbeddedDocuments: jest.fn(async () => [{ uuid: 'Item.effect' }]) };
}

function poison(extra = {}) {
  return { id: 'aff-1', name: 'Arsenic', type: 'poison', traits: ['poison'], dc: 20, ...extra };
}

describe('Robust Recovery treatment', () => {
  let update;

  beforeEach(() => {
    update = jest.spyOn(AfflictionStore, 'updateAfflictionForActor').mockResolvedValue(undefined);
    ui.notifications.info = jest.fn();
    ui.notifications.warn = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  test('normal success grants +2 and no save upgrade', async () => {
    await TreatmentService.handleTreatmentResult(null, poison(), 22, 20, patient());
    expect(update).toHaveBeenCalledWith(expect.anything(), 'aff-1', expect.objectContaining({
      treatmentBonus: 2,
      treatmentRobustRecovery: false,
    }));
  });

  test('treater with Robust Recovery: success grants +4 and upgrades the next save', async () => {
    await TreatmentService.handleTreatmentResult(null, poison(), 22, 20, patient(), { items: robust });
    expect(update).toHaveBeenCalledWith(expect.anything(), 'aff-1', expect.objectContaining({
      treatmentBonus: 4,
      treatmentRobustRecovery: true,
    }));
  });

  test('patient with Robust Recovery counts too', async () => {
    await TreatmentService.handleTreatmentResult(null, poison(), 22, 20, patient(robust));
    expect(update).toHaveBeenCalledWith(expect.anything(), 'aff-1', expect.objectContaining({
      treatmentBonus: 4,
      treatmentRobustRecovery: true,
    }));
  });

  test('failed treatment does not grant the upgrade', async () => {
    await TreatmentService.handleTreatmentResult(null, poison(), 15, 20, patient(robust));
    expect(update).toHaveBeenCalledWith(expect.anything(), 'aff-1', expect.objectContaining({
      treatmentBonus: 0,
      treatmentRobustRecovery: false,
    }));
  });
});

describe('Robust Recovery save upgrade', () => {
  afterEach(() => jest.restoreAllMocks());

  test('successful stage save becomes a critical success', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const affliction = poison({ currentStage: 3, isVirulent: false, stages: [{}, {}, {}], treatmentRobustRecovery: true });

    await AfflictionService.handleStageSave(null, affliction, 22, 20, false, 12, patient());

    expect(apply).toHaveBeenCalledWith(null, affliction, 1, expect.anything());
  });

  test('without the treatment flag a success reduces by one', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const affliction = poison({ currentStage: 3, isVirulent: false, stages: [{}, {}, {}] });

    await AfflictionService.handleStageSave(null, affliction, 22, 20, false, 12, patient());

    expect(apply).toHaveBeenCalledWith(null, affliction, 2, expect.anything());
  });
});

describe('Treatment Medicine roll', () => {
  let clickHandler;
  const medicineRoll = jest.fn(async () => ({ total: 22 }));

  beforeEach(() => {
    const patientActor = patient();
    const healer = { id: 'healer', skills: { medicine: { roll: medicineRoll } } };
    global.canvas = { tokens: { get: jest.fn(() => null), controlled: [{ actor: healer }] } };
    game.actors = { get: jest.fn(() => patientActor) };
    jest.spyOn(AfflictionStore, 'findTokenForActor').mockReturnValue(null);
    jest.spyOn(AfflictionStore, 'getAfflictionForActor').mockReturnValue(poison());
    jest.spyOn(SocketService, 'requestHandleTreatment').mockResolvedValue(true);

    const button = {
      dataset: { actorId: 'patient', afflictionId: 'aff-1', dc: '20' },
      addEventListener: jest.fn((_type, fn) => { clickHandler = fn; }),
    };
    registerTreatmentButtonHandlers({ querySelectorAll: () => [button] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
  });

  test('passes the Treat Poison action roll option and the healer to treatment handling', async () => {
    const button = { dataset: { actorId: 'patient', afflictionId: 'aff-1', dc: '20' } };
    await clickHandler({ currentTarget: button });

    expect(medicineRoll).toHaveBeenCalledWith(expect.objectContaining({
      dc: { value: 20 },
      extraRollOptions: expect.arrayContaining(['action:treat-poison']),
    }));
    expect(SocketService.requestHandleTreatment).toHaveBeenCalledWith(undefined, 'aff-1', 22, 20, 'patient', 'healer');
  });
});

describe('SocketService passes the healer through', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.canvas;
  });

  test('gmHandleTreatment resolves the treater actor', async () => {
    const patientActor = patient();
    const healer = { id: 'healer', items: robust };
    game.user = { isGM: true };
    global.canvas = { tokens: { get: jest.fn(() => null) } };
    game.actors = { get: jest.fn(id => (id === 'healer' ? healer : patientActor)) };
    jest.spyOn(AfflictionStore, 'findTokenForActor').mockReturnValue(null);
    jest.spyOn(AfflictionStore, 'getAfflictionForActor').mockReturnValue(poison());
    const handle = jest.spyOn(TreatmentService, 'handleTreatmentResult').mockResolvedValue(undefined);

    await SocketService.gmHandleTreatment(null, 'aff-1', 22, 20, 'patient', 'healer');

    expect(handle).toHaveBeenCalledWith(null, expect.objectContaining({ id: 'aff-1' }), 22, 20, patientActor, healer);
  });
});

