import { onWorldTimeUpdate } from '../scripts/hooks/worldTime.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionTimerService } from '../scripts/services/AfflictionTimerService.js';
import { AfflictionParser } from '../scripts/services/AfflictionParser.js';
import { CounteractService } from '../scripts/services/CounteractService.js';
import { onCreateChatMessage } from '../scripts/hooks/chat.js';
import { AfflictionItemResolver } from '../scripts/services/AfflictionItemResolver.js';
import { VisualService } from '../scripts/services/VisualService.js';
import { AfflictionMonitorIndicator } from '../scripts/ui/AfflictionMonitorIndicator.js';
import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';
import * as WeaponCoatingStore from '../scripts/stores/WeaponCoatingStore.js';

jest.mock('../scripts/services/VisualService.js', () => ({
  VisualService: { addAfflictionIndicator: jest.fn() },
}));

describe('dice stage timing (issue 32)', () => {
  let affliction;
  let token;
  let actor;

  beforeEach(() => {
    document.body.innerHTML = '';
    game.combat = null;
    game.time = { worldTime: 100 };
    affliction = {
      id: 'plague', name: 'Putrid Plague', currentStage: 1, durationElapsed: 0,
      nextSaveTimestamp: 7300, currentStageResolvedDuration: { value: 2, unit: 'hour' },
      stages: [{ duration: { formula: '1d4', value: null, unit: 'hour', isDice: true } }],
    };
    actor = { id: 'actor', name: 'Target' };
    token = { id: 'token', name: 'Target', actor, document: { actorLink: true } };
    game.actors = [actor];
    global.canvas = { tokens: { placeables: [token], controlled: [] } };
    jest.spyOn(AfflictionStore, 'getAfflictions').mockReturnValue({ plague: affliction });
    jest.spyOn(AfflictionStore, 'getAffliction').mockImplementation(() => affliction);
    jest.spyOn(AfflictionStore, 'getAfflictionsForActor').mockReturnValue({ plague: affliction });
    jest.spyOn(AfflictionStore, 'updateAffliction').mockImplementation(async (_token, _id, updates) => Object.assign(affliction, updates));
    jest.spyOn(AfflictionStore, 'updateAfflictionForActor').mockImplementation(async (_actor, _id, updates) => Object.assign(affliction, updates));
    jest.spyOn(AfflictionStore, 'findTokenForActor').mockReturnValue(null);
    jest.spyOn(WeaponCoatingStore, 'getAllCoatingsOnCanvas').mockReturnValue([]);
    jest.spyOn(AfflictionService, 'promptSave').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fromUuid;
    delete global.foundry;
  });

  test.each([false, true])('one-second ticks wait for rolled duration, off-scene=%s', async (offScene) => {
    if (offScene) canvas.tokens.placeables = [];
    for (let i = 0; i < 5; i++) {
      game.time.worldTime++;
      await onWorldTimeUpdate(game.time.worldTime, 1);
    }
    expect(AfflictionService.promptSave).not.toHaveBeenCalled();
    game.time.worldTime = 7300;
    await onWorldTimeUpdate(7300, 7195);
    expect(AfflictionService.promptSave).toHaveBeenCalledTimes(1);
    await onWorldTimeUpdate(7301, 1);
    expect(AfflictionService.promptSave).toHaveBeenCalledTimes(1);
  });

  test('monitor renders remaining time until rolled interval expires', () => {
    jest.spyOn(game.i18n, 'format').mockImplementation((key, data) => `${key} ${data.duration ?? ''}`);
    const indicator = new AfflictionMonitorIndicator();
    indicator.refresh();
    const monitor = document.querySelector('.pf2e-afflictioner-monitor');
    monitor.click();
    expect(monitor.classList.contains('needs-attention')).toBe(false);
    expect(document.querySelector('.affliction-time').textContent).toContain('TIME_UNTIL_SAVE');
    expect(document.querySelector('.affliction-time').textContent).toContain('2h');
    affliction.durationElapsed = 7200;
    game.time.worldTime = 7300;
    indicator.refresh();
    expect(monitor.classList.contains('needs-attention')).toBe(true);
    expect(document.querySelector('.affliction-time').textContent).toContain('SAVE_DUE');
    indicator.hide();
  });

  test('stage effects expire after rolled duration', () => {
    expect(AfflictionTimerService.buildExpirationData(affliction, affliction.stages[0], token).timestamp).toBe(7300);
    game.combat = { round: 10, combatants: [{ tokenId: token.id, initiative: 20 }] };
    expect(AfflictionTimerService.buildExpirationData(affliction, affliction.stages[0], token).round).toBe(1210);
  });

  test.each([false, true])('onset completion stores a fresh roll, off-scene=%s', async (offScene) => {
    if (offScene) canvas.tokens.placeables = [];
    affliction.inOnset = true;
    affliction.onsetRemaining = 1;
    affliction.currentStage = 0;
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    await onWorldTimeUpdate(100, 1);
    expect(affliction.currentStageResolvedDuration).toEqual({ value: 4, unit: 'hour' });
    expect(affliction.nextSaveTimestamp).toBe(14500);
    expect(affliction.stages[0].duration.value).toBeNull();
    await onWorldTimeUpdate(101, 1);
    expect(AfflictionService.promptSave).not.toHaveBeenCalled();
  });

  test('combat onset preserves its roll after leaving combat', async () => {
    affliction.inOnset = true;
    affliction.onsetRemaining = 6;
    affliction.currentStage = 0;
    game.combat = { round: 10, combatants: [{ tokenId: token.id, initiative: 20 }] };
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    await AfflictionTimerService.updateOnsetTimers(token, game.combat, AfflictionService);
    expect(affliction.nextSaveRound).toBe(2410);
    expect(affliction.currentStageResolvedDuration).toEqual({ value: 4, unit: 'hour' });
    game.combat = null;
    await onWorldTimeUpdate(101, 1);
    expect(AfflictionService.promptSave).not.toHaveBeenCalled();
  });

  test('new stage visit rerolls without changing source; durationless stage clears previous roll', async () => {
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue();
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    affliction.durationElapsed = 7100;
    await AfflictionService._applyStageChange(token, affliction, 1);
    expect(affliction.currentStageResolvedDuration).toEqual({ value: 4, unit: 'hour' });
    expect(affliction.durationElapsed).toBe(0);
    expect(affliction.stages[0].duration.value).toBeNull();
    affliction.stages.push({ duration: null });
    await AfflictionService._applyStageChange(token, affliction, 2);
    expect(affliction.currentStageResolvedDuration).toBeNull();
    expect(AfflictionParser.getStageDuration(affliction)).toBeNull();
  });

  test('counteract reduction replaces previous roll and resets elapsed', async () => {
    jest.spyOn(AfflictionService, 'removeStageEffects').mockResolvedValue();
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    affliction.stages.push({ duration: { value: 1, unit: 'day' } });
    affliction.currentStage = 2;
    affliction.durationElapsed = 8000;
    await CounteractService.reduceAfflictionStage(token, affliction);
    expect(affliction.currentStageResolvedDuration).toEqual({ value: 4, unit: 'hour' });
    expect(affliction.durationElapsed).toBe(0);
    expect(affliction.nextSaveTimestamp).toBe(14500);
    expect(affliction.stages[0].duration.value).toBeNull();
  });

  test('fixed stage ignores stale resolved dice duration', async () => {
    affliction.stages[0].duration = { value: 1, unit: 'day' };
    await onWorldTimeUpdate(7300, 7200);
    expect(AfflictionService.promptSave).not.toHaveBeenCalled();
    expect(AfflictionParser.durationToSeconds(AfflictionParser.getStageDuration(affliction))).toBe(86400);
  });

  test('auto-detected failed saves roll independently outside combat', async () => {
    actor.uuid = 'Actor.target';
    const source = { name: 'Putrid Plague', type: 'disease', stages: affliction.stages };
    global.foundry = { utils: { randomID: () => 'new-affliction' } };
    global.fromUuid = jest.fn(async (uuid) => uuid === actor.uuid ? actor : {});
    jest.spyOn(game.settings, 'get').mockReturnValue(true);
    jest.spyOn(AfflictionItemResolver, 'resolveFromItem').mockResolvedValue(source);
    jest.spyOn(AfflictionService, 'applyStageEffects').mockResolvedValue();
    jest.spyOn(VisualService, 'addAfflictionIndicator').mockResolvedValue();
    const stored = jest.spyOn(AfflictionStore, 'addAffliction').mockResolvedValue();
    const roll = jest.spyOn(Roll.prototype, 'evaluate')
      .mockImplementationOnce(async function () { this.total = 2; return this; })
      .mockImplementationOnce(async function () { this.total = 3; return this; });
    const message = { flags: { pf2e: {
      context: { type: 'saving-throw', outcome: 'failure' },
      origin: { uuid: 'Item.plague' }, actor: { uuid: actor.uuid },
    } } };
    await onCreateChatMessage(message);
    await onCreateChatMessage(message);
    expect(roll).toHaveBeenCalledTimes(2);
    expect(stored.mock.calls[0][1]).toEqual(expect.objectContaining({
      nextSaveTimestamp: 7300, currentStageResolvedDuration: { value: 2, unit: 'hour' },
    }));
    expect(stored.mock.calls[1][1]).toEqual(expect.objectContaining({
      nextSaveTimestamp: 10900, currentStageResolvedDuration: { value: 3, unit: 'hour' },
    }));
    expect(source.stages[0].duration.value).toBeNull();
  });
});
