import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';
import { RecoveryRestrictionService } from '../scripts/services/RecoveryRestrictionService.js';
import { AfflictionDamageService } from '../scripts/services/AfflictionDamageService.js';
import { DEFAULT_SETTINGS } from '../scripts/constants.js';

describe('affliction damage excludes recipient damage bonuses', () => {
  const token = { id: 'token-1', actor: { id: 'actor-1', name: 'Jacques' }, document: {} };
  const affliction = {
    id: 'venom', name: 'Cave Scorpion Venom', currentStage: 1,
    stages: [{ number: 1, damage: [{ formula: '1d4', type: 'poison' }], effects: '@Damage[1d4[poison]] damage' }],
  };

  beforeEach(() => {
    game.users = [{ id: 'gm', isGM: true }];
    ChatMessage.create = jest.fn();
    ChatMessage.getSpeaker = jest.fn(() => ({ actor: token.actor.id }));
  });

  test('damage card uses PF2e immutable damage so Courageous Anthem cannot augment it', async () => {
    await AfflictionChatService.promptDamage(token, affliction);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('@Damage[1d4[poison]|immutable]');
  });

  test('stage descriptions lock nested damage links and preserve existing options', () => {
    const text = '@Damage[(max(4,(@item.rank)-1))d6[void]|options:foo] and @Damage[2[poison]|immutable]';
    const result = RecoveryRestrictionService.tagDamageLinks(text, affliction);
    expect(result).toBe('@Damage[(max(4,(@item.rank)-1))d6[void]|options:foo|immutable] and @Damage[2[poison]|immutable]');
    expect(RecoveryRestrictionService.tagDamageLinks(result, affliction)).toBe(result);
  });

  test('Pernicious Poison fixed damage excludes recipient bonuses', async () => {
    await AfflictionChatService.promptPerniciousPoisonDamage(token, { ...affliction, perniciousPoisonLevel: 3 });
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('@Damage[3[poison]|immutable]');
  });

  test.each([['elite', '+ 2'], ['weak', '- 2']])('%s source adjusts venom damage without recipient bonuses', async (adjustment, modifier) => {
    global.fromUuidSync = jest.fn(() => ({ type: 'npc', system: { attributes: { adjustment } } }));
    try {
      await AfflictionChatService.promptDamage(token, { ...affliction, originActorUuid: 'Actor.source' });
      expect(ChatMessage.create.mock.calls[0][0].content).toContain(`@Damage[(1d4 ${modifier})[poison]|immutable|options:pf2e-afflictioner:adjusted-damage]`);
    } finally {
      delete global.fromUuidSync;
    }
  });
});

describe('source damage adjustment setting', () => {
  const affliction = { id: 'venom', originActorUuid: 'Scene.scene.Token.source.Actor.actor' };
  let originalGet;

  beforeEach(() => {
    originalGet = game.settings.get;
    global.fromUuidSync = jest.fn(() => ({ type: 'npc', system: { attributes: { adjustment: 'elite' } } }));
  });

  afterEach(() => {
    game.settings.get = originalGet;
    delete global.fromUuidSync;
  });

  test('GM world toggle defaults on', () => {
    expect(DEFAULT_SETTINGS.adjustAfflictionDamage).toMatchObject({ default: true, scope: 'world', restricted: true, config: true });
  });

  test('disabled toggle preserves base damage', () => {
    game.settings.get = () => false;
    expect(RecoveryRestrictionService.buildDamageLink('1d6', 'poison', affliction)).toBe('@Damage[1d6[poison]|immutable]');
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test('synthetic source UUID resolves directly and raw formula stays untouched', () => {
    expect(AfflictionDamageService.adjustFormula('1d6+4', affliction)).toBe('(1d6+4 + 2)');
    expect(fromUuidSync).toHaveBeenCalledWith(affliction.originActorUuid);
  });

  test.each([null, { type: 'character', system: { attributes: { adjustment: 'elite' } } }, { type: 'npc', system: { attributes: {} } }])('unadjusted or missing source leaves damage unchanged (%j)', actor => {
    fromUuidSync.mockReturnValue(actor);
    expect(AfflictionDamageService.adjustFormula('1d6', affliction)).toBe('1d6');
  });

  test('deleted source and absent source never use recipient adjustment', () => {
    fromUuidSync.mockImplementation(() => { throw new Error('Deleted token'); });
    expect(AfflictionDamageService.adjustFormula('1d6', affliction)).toBe('1d6');
    expect(AfflictionDamageService.adjustFormula('1d6', {})).toBe('1d6');
  });

  test('inline stage links adjust once while preserving recovery options', () => {
    const restricted = { ...affliction, recoveryRestriction: { unhealableDamage: true } };
    const link = RecoveryRestrictionService.tagDamageLinks('@Damage[1d6[poison]|options:foo]', restricted);
    expect(link).toContain('(1d6 + 2)[poison]');
    expect(link).toContain('options:foo,pf2e-afflictioner:unhealable-damage:venom');
    expect(RecoveryRestrictionService.tagDamageLinks(link, restricted)).toBe(link);
    const built = RecoveryRestrictionService.buildDamageLink('1d6', 'poison', restricted);
    expect(RecoveryRestrictionService.tagDamageLinks(built, restricted)).toBe(built);
  });

  test('fixed feat damage can opt out while keeping immutable damage', () => {
    expect(RecoveryRestrictionService.buildDamageLink(3, 'poison', affliction, false)).toBe('@Damage[3[poison]|immutable]');
  });
});
