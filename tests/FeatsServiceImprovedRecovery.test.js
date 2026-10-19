import { DEGREE_OF_SUCCESS } from '../scripts/constants.js';

jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: {},
}));

import { FeatsService } from '../scripts/services/FeatsService.js';
import { SocketService } from '../scripts/services/SocketService.js';

function actorWith(type, slug, name = slug) {
  return { name: 'Hero', items: [{ type, name, system: { slug } }] };
}

const poison = { name: 'Arsenic', type: 'poison', traits: ['poison', 'ingested'] };
const alchemicalPoison = { name: 'Giant Wasp Venom', type: 'poison', traits: ['alchemical', 'consumable', 'injury', 'poison'] };
const disease = { name: 'Filth Fever', type: 'disease', traits: ['disease'] };
const curse = { name: 'Lycanthropy', type: 'curse', traits: ['curse'] };
const drug = { name: 'Shiver', type: 'poison', traits: ['alchemical', 'drug', 'poison'] };
const addiction = { name: 'Shiver Addiction', type: 'disease', traits: ['disease'], isAddiction: true };

describe('FeatsService improved recovery features', () => {
  test.each([
    ['feat', 'fast-recovery', poison, true],
    ['feat', 'fast-recovery', disease, true],
    ['feat', 'fast-recovery', curse, false],
    ['heritage', 'strong-blooded-dwarf', poison, true],
    ['heritage', 'strong-blooded-dwarf', disease, false],
    ['heritage', 'venom-resistant-vishkanya', poison, true],
    ['heritage', 'venom-resistant-vishkanya', disease, false],
    ['feat', 'wash-out', poison, true],
    ['feat', 'wash-out', disease, false],
    ['feat', 'inoculation-subroutine', disease, true],
    ['feat', 'inoculation-subroutine', poison, false],
    ['feat', 'inured-to-alchemy', alchemicalPoison, true],
    ['feat', 'inured-to-alchemy', drug, true],
    ['feat', 'inured-to-alchemy', addiction, true],
    ['feat', 'inured-to-alchemy', poison, false],
    ['feat', 'inured-to-alchemy', disease, false],
  ])('%s %s vs %o -> %s', (type, slug, affliction, expected) => {
    const feature = FeatsService.getImprovedRecoveryFeature(actorWith(type, slug, `Name ${slug}`), affliction);
    expect(feature ? feature.name : null).toBe(expected ? `Name ${slug}` : null);
  });

  test('heritage-named feat type is not matched as a heritage', () => {
    expect(FeatsService.getImprovedRecoveryFeature(actorWith('feat', 'strong-blooded-dwarf'), poison)).toBeNull();
  });

  test('no actor or affliction yields null', () => {
    expect(FeatsService.getImprovedRecoveryFeature(null, poison)).toBeNull();
    expect(FeatsService.getImprovedRecoveryFeature(actorWith('feat', 'fast-recovery'), null)).toBeNull();
  });
});

describe('AfflictionService stage save with improved recovery', () => {
  let AfflictionService;

  beforeAll(async () => {
    ({ AfflictionService } = await import('../scripts/services/AfflictionService.js'));
  });

  afterEach(() => jest.restoreAllMocks());

  test('Strong-Blooded Dwarf success reduces a poison by 2 stages', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const actor = actorWith('heritage', 'strong-blooded-dwarf', 'Strong-Blooded Dwarf');
    const affliction = { ...poison, currentStage: 3, isVirulent: false, stages: [{}, {}, {}, {}] };

    await AfflictionService.handleStageSave(null, affliction, 25, 20, false, 12, actor);

    expect(apply).toHaveBeenCalledWith(null, affliction, 1, expect.objectContaining({
      fastRecoveryApplied: 'Strong-Blooded Dwarf',
    }));
  });

  test('Strong-Blooded Dwarf does not speed disease recovery', async () => {
    const apply = jest.spyOn(AfflictionService, '_applyStageChange').mockResolvedValue(undefined);
    const actor = actorWith('heritage', 'strong-blooded-dwarf', 'Strong-Blooded Dwarf');
    const affliction = { ...disease, currentStage: 3, isVirulent: false, stages: [{}, {}, {}, {}] };

    await AfflictionService.handleStageSave(null, affliction, 25, 20, false, 12, actor);

    expect(apply).toHaveBeenCalledWith(null, affliction, 2, expect.objectContaining({
      fastRecoveryApplied: false,
    }));
  });
});

describe('Improved recovery notice names the feature', () => {
  beforeEach(() => {
    game.users = [{ id: 'gm-1', isGM: true }];
    game.i18n.format = jest.fn((key, data = {}) => `${key}|${data.feature}`);
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({}));
  });

  afterEach(() => jest.restoreAllMocks());

  test('Strong-Blooded Dwarf stage save notice', async () => {
    const actor = actorWith('heritage', 'strong-blooded-dwarf', 'Strong-Blooded Dwarf');
    await SocketService.postImmediateSaveModifierNotice(null, actor, { ...poison, isVirulent: false }, {
      degree: DEGREE_OF_SUCCESS.SUCCESS,
      rawDegree: DEGREE_OF_SUCCESS.SUCCESS,
      incapacitationApplied: false,
    }, 'stage');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('PF2E_AFFLICTIONER.FEATS.FAST_RECOVERY_STAGE_CHANGE|Strong-Blooded Dwarf'),
    }));
  });

  test('no notice when the feature does not cover the affliction type', async () => {
    const actor = actorWith('heritage', 'strong-blooded-dwarf', 'Strong-Blooded Dwarf');
    await SocketService.postImmediateSaveModifierNotice(null, actor, disease, {
      degree: DEGREE_OF_SUCCESS.SUCCESS,
      rawDegree: DEGREE_OF_SUCCESS.SUCCESS,
      incapacitationApplied: false,
    }, 'stage');

    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});
