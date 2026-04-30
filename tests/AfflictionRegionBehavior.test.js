import { AfflictionService } from '../scripts/services/AfflictionService.js';
import {
  AfflictionRegionBehavior,
  parseAfflictionUuids,
  resolveTokenFromRegionEvent
} from '../scripts/regions/AfflictionRegionBehavior.js';

describe('AfflictionRegionBehavior', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    game.user.isGM = true;
    global.CONST = {
      REGION_EVENTS: {
        BEHAVIOR_ACTIVATED: 'behaviorActivated',
        TOKEN_ENTER: 'tokenEnter',
        TOKEN_EXIT: 'tokenExit'
      }
    };
    global.fromUuid = jest.fn();
  });

  test('parses unique affliction UUIDs from multiline or comma-separated text', () => {
    expect(parseAfflictionUuids('Item.a\n Item.b,Item.a;Compendium.pf2e.afflictions.Item.c ')).toEqual([
      'Item.a',
      'Item.b',
      'Compendium.pf2e.afflictions.Item.c'
    ]);
  });

  test('resolves token from common region event shapes', () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    global.canvas = {
      tokens: {
        get: jest.fn(() => token)
      }
    };

    expect(resolveTokenFromRegionEvent({ token })).toBe(token);
    expect(resolveTokenFromRegionEvent({ data: { token: 'token-1' } })).toBe(token);
    expect(resolveTokenFromRegionEvent({ tokenId: 'token-1' })).toBe(token);
  });

  test('prompts initial saves for configured afflictions when a token enters', async () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    const itemA = { id: 'item-a', name: 'Black Adder Venom' };
    const itemB = { id: 'item-b', name: 'Blightburn Sickness' };
    const afflictionA = { name: 'Black Adder Venom', type: 'poison', stages: [{}] };
    const afflictionB = { name: 'Blightburn Sickness', type: 'disease', stages: [{}] };

    global.fromUuid
      .mockResolvedValueOnce(itemA)
      .mockResolvedValueOnce(itemB);
    jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);

    const behavior = new AfflictionRegionBehavior();
    behavior.afflictionUuids = 'Item.a\nItem.b';
    behavior._parseAfflictionItem = jest.fn()
      .mockReturnValueOnce(afflictionA)
      .mockReturnValueOnce(afflictionB);

    await behavior._handleRegionEvent({ name: CONST.REGION_EVENTS.TOKEN_ENTER, token });

    expect(global.fromUuid).toHaveBeenCalledWith('Item.a');
    expect(global.fromUuid).toHaveBeenCalledWith('Item.b');
    expect(AfflictionService.promptInitialSave).toHaveBeenCalledWith(token, afflictionA);
    expect(AfflictionService.promptInitialSave).toHaveBeenCalledWith(token, afflictionB);
  });

  test('non-GM users do not apply region afflictions', async () => {
    game.user.isGM = false;
    const behavior = new AfflictionRegionBehavior();
    behavior.afflictionUuids = 'Item.a';
    jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);

    await behavior._handleRegionEvent({
      name: CONST.REGION_EVENTS.TOKEN_ENTER,
      token: { id: 'token-1', actor: { id: 'actor-1' } }
    });

    expect(global.fromUuid).not.toHaveBeenCalled();
    expect(AfflictionService.promptInitialSave).not.toHaveBeenCalled();
  });

  test('skips only afflictions marked to skip existing exposure', async () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    const itemA = { id: 'item-a', name: 'Black Adder Venom' };
    const itemB = { id: 'item-b', name: 'Blightburn Sickness' };
    const afflictionA = { name: 'Black Adder Venom', type: 'poison', stages: [{}] };
    const afflictionB = { name: 'Blightburn Sickness', type: 'disease', stages: [{}] };

    global.fromUuid
      .mockResolvedValueOnce(itemA)
      .mockResolvedValueOnce(itemB);
    jest.spyOn(AfflictionService, 'findExistingAffliction').mockReturnValue({
      id: 'existing-affliction',
      name: 'Black Adder Venom'
    });
    jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);

    const behavior = new AfflictionRegionBehavior();
    behavior.afflictionUuids = 'Item.a\nItem.b';
    behavior.skipExistingAfflictionUuids = 'Item.a';
    behavior._parseAfflictionItem = jest.fn()
      .mockReturnValueOnce(afflictionA)
      .mockReturnValueOnce(afflictionB);

    await behavior._handleRegionEvent({ name: CONST.REGION_EVENTS.TOKEN_ENTER, token });

    expect(AfflictionService.findExistingAffliction).toHaveBeenCalledWith(token, 'Black Adder Venom');
    expect(AfflictionService.promptInitialSave).toHaveBeenCalledWith(token, afflictionB);
    expect(AfflictionService.promptInitialSave).not.toHaveBeenCalledWith(token, afflictionA);
  });

  test('applies an existing affliction again when that row allows multiple exposure', async () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    const item = { id: 'item-a', name: 'Black Adder Venom' };
    const affliction = { name: 'Black Adder Venom', type: 'poison', stages: [{}] };

    global.fromUuid.mockResolvedValue(item);
    jest.spyOn(AfflictionService, 'findExistingAffliction').mockReturnValue({
      id: 'existing-affliction',
      name: 'Black Adder Venom'
    });
    jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);

    const behavior = new AfflictionRegionBehavior();
    behavior.afflictionUuids = 'Item.a';
    behavior.skipExistingAfflictionUuids = '';
    behavior._parseAfflictionItem = jest.fn().mockReturnValue(affliction);

    await behavior._handleRegionEvent({ name: CONST.REGION_EVENTS.TOKEN_ENTER, token });

    expect(AfflictionService.promptInitialSave).toHaveBeenCalledWith(token, affliction);
  });

  test('applies afflictions on token exit when Foundry sends a subscribed exit event', async () => {
    const token = { id: 'token-1', actor: { id: 'actor-1' } };
    const item = { id: 'item-a', name: 'Black Adder Venom' };
    const affliction = { name: 'Black Adder Venom', type: 'poison', stages: [{}] };

    global.fromUuid.mockResolvedValue(item);
    jest.spyOn(AfflictionService, 'promptInitialSave').mockResolvedValue(undefined);

    const behavior = new AfflictionRegionBehavior();
    behavior.afflictionUuids = 'Item.a';
    behavior._parseAfflictionItem = jest.fn().mockReturnValue(affliction);

    await behavior._handleRegionEvent({ name: CONST.REGION_EVENTS.TOKEN_EXIT, token });
    expect(AfflictionService.promptInitialSave).toHaveBeenCalledWith(token, affliction);
  });
});
