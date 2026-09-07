import { AfflictionChatService } from '../scripts/services/AfflictionChatService.js';
import { RecoveryRestrictionService } from '../scripts/services/RecoveryRestrictionService.js';

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
});
