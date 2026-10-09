import { AddictionService as Addiction } from '../scripts/services/AddictionService.js';
import { AfflictionService } from '../scripts/services/AfflictionService.js';
import { AfflictionEffectBuilder as Effects } from '../scripts/services/AfflictionEffectBuilder.js';
import { AfflictionChatService as Chat } from '../scripts/services/AfflictionChatService.js';
import { VisualService } from '../scripts/services/VisualService.js';
import * as Store from '../scripts/stores/AfflictionStore.js';
import { onWorldTimeUpdate } from '../scripts/hooks/worldTime.js';
import { AfflictionTimerService } from '../scripts/services/AfflictionTimerService.js';
import { onDeleteItem } from '../scripts/hooks/items.js';
import { DEFAULT_SETTINGS } from '../scripts/constants.js';

jest.mock('../scripts/services/VisualService.js', () => ({ VisualService: {
  addAfflictionIndicator: jest.fn(), removeAfflictionIndicator: jest.fn(),
} }));

const DAY = 86400;
const WEEK = 7 * DAY;

class TestApplication {
  constructor(options = {}) { this.options = options; }
  render() { return this; }
  close() {}
  _onRender() {}
}

function drugItem(overrides = {}) {
  return {
    name: 'Pesh', type: 'consumable', uuid: 'Compendium.pf2e.equipment.Item.pesh', img: 'pesh.webp',
    system: { traits: { value: ['drug', 'poison'] }, level: { value: 1 }, description: { value: '<p>Saving Throw @Check[fortitude|dc:20]</p>' } },
    ...overrides,
  };
}

function document() {
  const flags = {};
  return {
    getFlag: jest.fn((_module, key) => flags[key]),
    setFlag: jest.fn(async (_module, key, value) => { flags[key] = JSON.parse(JSON.stringify(value)); }),
    unsetFlag: jest.fn(async (_module, key) => { const [root, id] = key.split('.'); delete flags[root]?.[id]; }),
  };
}

describe('legacy addiction lifecycle', () => {
  let actor;
  let token;
  let id;
  beforeEach(() => {
    id = 0;
    global.foundry = {
      utils: { randomID: () => `addiction-${++id}` },
      applications: { api: { ApplicationV2: TestApplication, HandlebarsApplicationMixin: Base => Base } },
    };
    game.user.isGM = true;
    game.time = { worldTime: 100 };
    game.combat = null;
    jest.spyOn(game.settings, 'get').mockImplementation((_module, key) => key === 'editedAfflictions' ? {} : key === 'enableAddictionRules');
    actor = { ...document(), id: 'actor', name: 'Actor', items: [], type: 'character' };
    token = { actor, id: 'token', name: 'Token', document: { ...document(), actorLink: true } };
    game.actors = [actor];
    global.canvas = { tokens: { placeables: [token] } };
    actor.createEmbeddedDocuments = jest.fn(async (_type, sources) => sources.map(source => {
      const item = { ...source, uuid: `Actor.actor.Item.effect-${++id}` };
      item.update = jest.fn(async updates => { item.lastUpdates = updates; });
      item.delete = jest.fn(async () => { actor.items = actor.items.filter(other => other !== item); });
      actor.items.push(item);
      return item;
    }));
    global.fromUuid = jest.fn(async uuid => actor.items.find(item => item.uuid === uuid));
    jest.spyOn(Effects, 'getConditionUuid').mockImplementation(async slug => `Condition.${slug}`);
    jest.spyOn(Chat, 'promptInitialSave').mockResolvedValue();
    jest.spyOn(Chat, 'promptStageSave').mockResolvedValue();
    jest.spyOn(Chat, 'postStageChange').mockResolvedValue();
    jest.spyOn(VisualService, 'addAfflictionIndicator').mockResolvedValue();
    jest.spyOn(VisualService, 'removeAfflictionIndicator').mockResolvedValue();
  });
  afterEach(() => { jest.restoreAllMocks(); game.user.isGM = true; });

  function saved(value, target = token) { return Addiction.get(target, actor, value.id); }
  async function use(drug = 'Pesh', total = 19, target = token) {
    await AfflictionService.promptInitialSave(target, Addiction.createDefinition(drug, 20), actor);
    const values = target ? Store.getAfflictions(target) : Store.getAfflictionsForActor(actor);
    const value = Object.values(values).find(a => a.drugName === drug);
    await AfflictionService.handleInitialSave(target, value, total, 20, null, actor);
    return saved(value, target);
  }
  async function advance(seconds) {
    game.time.worldTime += seconds;
    await onWorldTimeUpdate(game.time.worldTime, seconds);
  }

  test('definition has standard onset, weekly stages, and exact legacy conditions', () => {
    const value = Addiction.createDefinition(' Pesh ', 20);
    expect(value).toMatchObject({ isAddiction: true, drugName: 'Pesh', drugKey: 'pesh', type: 'disease', saveType: 'fortitude', onset: { value: 1, unit: 'day' } });
    expect(value.stages[3].conditions).toEqual([{ name: 'fatigued', value: null }, { name: 'drained', value: 2 }, { name: 'sickened', value: 2 }, { name: 'stupefied', value: 2 }]);
    expect(value.stages.every(stage => stage.duration.unit === 'week')).toBe(true);
    expect(() => Addiction.createDefinition('', 20)).toThrow();
    expect(() => Addiction.createDefinition('Pesh', 0)).toThrow();
  });

  test('addiction rules are an opt-in GM world setting', () => {
    expect(DEFAULT_SETTINGS.enableAddictionRules).toMatchObject({ scope: 'world', type: Boolean, default: false, config: true, restricted: true });
    game.settings.get.mockReturnValue(undefined);
    expect(Addiction.isEnabled()).toBe(false);
  });

  test('disabled rules reject new doses through the service and public API', async () => {
    game.settings.get.mockImplementation((_module, key) => key === 'editedAfflictions' ? {} : false);
    const { api } = await import('../scripts/api.js');
    await api.takeDrug(token, 'Pesh', 20);
    await api.takeDrug(null, 'Pesh', 20, actor);
    await Addiction.promptDrugUse(token, Addiction.createDefinition('Pesh', 20), actor);
    expect(Store.getAfflictions(token)).toEqual({});
    expect(Chat.promptInitialSave).not.toHaveBeenCalled();
  });

  test('turning rules off pauses existing saves and timers but still allows removal', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    const before = saved(value);
    game.settings.get.mockImplementation((_module, key) => key === 'editedAfflictions' ? {} : false);
    await advance(WEEK);
    await AfflictionService.promptSave(token, before);
    await AfflictionService.handleInitialSave(token, { ...before, drugSavePending: true }, 9, 20);
    await AfflictionService.handleStageSave(token, before, 30, 20);
    await Addiction.changeStage(token, actor, before, 4);
    expect(saved(value)).toEqual(before);
    expect(Chat.promptStageSave).not.toHaveBeenCalled();
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
    const removed = actor.items[0];
    removed.parent = actor;
    await removed.delete();
    await onDeleteItem(removed);
    expect(actor.items).toHaveLength(0);
    await Addiction.remove(token, actor, before);
    expect(saved(value)).toBeNull();
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
  });

  test.each([[19, 1], [9, 2]])('failed drug save %s starts stage %s after one day', async (total, stage) => {
    const value = await use('Pesh', total);
    expect(value).toMatchObject({ currentStage: 0, inOnset: true, stageAdvancement: stage, onsetRemaining: DAY });
    await advance(DAY);
    expect(saved(value)).toMatchObject({ currentStage: stage, inOnset: false, nextSaveTimestamp: 100 + DAY + WEEK });
    expect(actor.items).toHaveLength(1);
    expect(actor.items[0].system.rules.length).toBe(stage === 1 ? 1 : 2);
  });

  test.each([20, 30])('successful first drug save %s avoids disease', async total => {
    expect(await use('Pesh', total)).toBeNull();
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(0);
    expect(actor.items).toHaveLength(0);
  });

  test.each([19, 9])('weekly failure %s cannot worsen current stage and resets weekly timer', async total => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    await AfflictionService.handleStageSave(token, saved(value), total, 20);
    expect(saved(value)).toMatchObject({ currentStage: 2, nextSaveTimestamp: game.time.worldTime + WEEK });
  });

  test('recovery improves current stage without reducing maximum; relapse uses maximum', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    await AfflictionService.handleStageSave(token, saved(value), 20, 20);
    expect(saved(value)).toMatchObject({ currentStage: 1, addictionMaximumStage: 2 });
    await use();
    expect(saved(value)).toMatchObject({ currentStage: 3, addictionMaximumStage: 3 });
    expect(Object.keys(Store.getAfflictions(token))).toHaveLength(1);
  });

  test.each([20, 30])('successful drug save %s leaves active stage unchanged and suppresses symptoms', async total => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    const timer = saved(value).nextSaveTimestamp;
    await use('Pesh', total);
    expect(saved(value)).toMatchObject({ currentStage: 2, suppressedUntil: game.time.worldTime + DAY, nextSaveTimestamp: timer });
    expect(actor.items[0].lastUpdates['system.rules']).toEqual([]);
    await advance(DAY - 1);
    expect(saved(value).suppressedUntil).not.toBeNull();
    await advance(1);
    expect(saved(value).suppressedUntil).toBeNull();
    expect(actor.items[0].lastUpdates['system.rules']).toHaveLength(2);
  });

  test('cure removes disease and symptoms but keeps permanent per-drug history', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    await AfflictionService.handleStageSave(token, saved(value), 30, 20);
    expect(saved(value)).toBeNull();
    expect(actor.items).toHaveLength(0);
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
    const relapse = await use();
    expect(relapse.stageAdvancement).toBe(3);
    const other = await use('Flayleaf');
    expect(other.stageAdvancement).toBe(1);
  });

  test('critical relapse caps at stage four', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    await use('Pesh', 9);
    expect(saved(value).currentStage).toBe(4);
    await use('Pesh', 9);
    expect(saved(value).currentStage).toBe(4);
  });

  test('pending save reopening neither duplicates disease nor extends suppression', async () => {
    const definition = Addiction.createDefinition('Pesh', 20);
    const value = await Addiction.promptDrugUse(token, definition, actor);
    game.time.worldTime++;
    await Addiction.promptDrugUse(token, definition, actor);
    expect(Object.values(Store.getAfflictions(token))).toHaveLength(1);
    expect(saved(value).suppressedUntil).toBe(100 + DAY);
  });

  test('off-scene actors receive effects, suppression, and recovery cleanup', async () => {
    canvas.tokens.placeables = [];
    const value = await use('Pesh', 9, null);
    await advance(DAY);
    expect(saved(value, null).currentStage).toBe(2);
    expect(actor.items).toHaveLength(1);
    await use('Pesh', 20, null);
    expect(actor.items[0].lastUpdates['system.rules']).toEqual([]);
    await AfflictionService.handleStageSave(null, saved(value, null), 30, 20, false, null, actor);
    expect(actor.items).toHaveLength(0);
    expect(Store.getAddictionMaximum(null, actor, 'pesh')).toBe(2);
  });

  test('unlinked token history stays independent of base actor', async () => {
    token.document.actorLink = false;
    await use('Pesh', 9);
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
    expect(Store.getAddictionMaximum(null, actor, 'pesh')).toBe(0);
  });

  test('suppression expires during combat; normal combat onset processing skips addiction', async () => {
    const value = await use();
    game.combat = { started: true, round: 1 };
    await AfflictionTimerService.updateOnsetTimers(token, game.combat, AfflictionService);
    expect(saved(value).onsetRemaining).toBe(DAY);
    await advance(DAY);
    expect(saved(value).currentStage).toBe(1);
    expect(actor.items[0].system.rules).toHaveLength(1);
  });

  test('weekly prompt fires once per due save even across large time advances', async () => {
    await use();
    await advance(DAY + WEEK);
    await advance(1);
    expect(Chat.promptStageSave).toHaveBeenCalledTimes(1);
  });

  test('Fast Recovery improves weekly saves without improving drug-use saves', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    actor.items.push({ type: 'feat', system: { slug: 'fast-recovery' } });
    await use('Pesh', 20);
    expect(saved(value).currentStage).toBe(2);
    await AfflictionService.handleStageSave(token, saved(value), 20, 20);
    expect(saved(value)).toBeNull();
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
  });

  test('direct removal preserves the maximum and pending initial requests can be retried', async () => {
    const value = await use('Pesh', 9);
    await Store.removeAffliction(token, value.id);
    expect(Store.getAddictionMaximum(token, actor, 'pesh')).toBe(2);
    const pending = await Addiction.promptDrugUse(token, Addiction.createDefinition('Pesh', 20), actor);
    await AfflictionService.promptSave(token, pending);
    expect(Chat.promptInitialSave).toHaveBeenLastCalledWith(token, pending, pending, pending.id, actor);
  });

  test('actor-filtered manager adds addiction to that actor despite an unrelated selected token', async () => {
    foundry.applications = { api: {
      ApplicationV2: TestApplication, HandlebarsApplicationMixin: Base => Base,
      DialogV2: { prompt: jest.fn() },
    } };
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    const rendered = jest.spyOn(AddAfflictionDialog.prototype, 'render');
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    canvas.tokens.placeables = [];
    canvas.tokens.controlled = [{ actor: { id: 'unrelated' } }];
    game.actors.get = id => id === actor.id ? actor : null;
    const app = { filterActorId: actor.id, playerCoatingOnly: false, render: jest.fn() };
    await AfflictionManager.addAddiction.call(app);
    const dialog = rendered.mock.instances[0];
    expect(dialog).toMatchObject({ actor, token: null, addictionMode: true });
    fromUuid.mockResolvedValue(drugItem());
    await dialog._onDrop({ preventDefault: jest.fn(), dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid: drugItem().uuid }) } });
    expect(Object.values(Store.getAfflictionsForActor(actor))).toHaveLength(1);
    expect(Chat.promptInitialSave.mock.calls.at(-1)[4]).toBe(actor);
    expect(Chat.promptInitialSave.mock.calls.at(-1)[0]).toBeNull();
    game.user.isGM = false;
    await AfflictionManager.addAddiction.call(app);
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(foundry.applications.api.DialogV2.prompt).not.toHaveBeenCalled();
  });

  test('drug definition uses item DC rather than owner spell DC and preserves source data', () => {
    const item = drugItem({ parent: { system: { attributes: { classDC: { value: 42 } } } } });
    expect(Addiction.createDefinitionFromItem(item)).toMatchObject({
      drugName: 'Pesh', drugKey: 'pesh', dc: 20, img: item.img, sourceItemUuid: item.uuid, level: 1,
    });
    expect(Addiction.isDrugItem({ type: 'consumable', system: { traits: { value: ['poison'] } } })).toBe(false);
  });

  test('edited drug poison cannot overwrite the addiction definition', async () => {
    const item = drugItem();
    game.settings.get.mockImplementation((_module, key) => key === 'editedAfflictions' ? {
      [item.uuid]: { name: 'Edited Pesh Poison', dc: 42, type: 'poison', stages: [] },
    } : key === 'enableAddictionRules');
    await AfflictionService.promptInitialSave(token, Addiction.createDefinitionFromItem(item));
    expect(Object.values(Store.getAfflictions(token))[0]).toMatchObject({ name: 'PF2E_AFFLICTIONER.ADDICTION.NAME (Pesh)', isAddiction: true, dc: 20, type: 'disease' });
  });

  test('rendered dialog binds one drop handler, reads the drug, and records a dose', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    const dialog = new AddAfflictionDialog(token, { addictionMode: true });
    dialog.element = global.document.createElement('form');
    let complete;
    const dropped = new Promise(resolve => { complete = resolve; });
    const original = dialog._onDrop.bind(dialog);
    jest.spyOn(dialog, '_onDrop').mockImplementation(async event => { await original(event); complete(); });
    fromUuid.mockResolvedValue(drugItem());
    dialog._onRender({}, {});
    dialog._onRender({}, {});
    const event = new Event('drop', { cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { getData: () => JSON.stringify({ type: 'Item', uuid: drugItem().uuid }) } });
    dialog.element.dispatchEvent(event);
    await dropped;
    expect(dialog._onDrop).toHaveBeenCalledTimes(1);
    expect(Chat.promptInitialSave).toHaveBeenCalledTimes(1);
    expect(Object.values(Store.getAfflictions(token))[0]).toMatchObject({ drugName: 'Pesh', dc: 20, img: 'pesh.webp' });
  });

  test('drug picker filters actor and compendium items including off-scene actors', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    actor.items.push(drugItem(), { name: 'Venom', type: 'affliction' });
    const pack = { metadata: { type: 'Item', system: 'pf2e', label: 'Equipment' }, getIndex: jest.fn(async () => actor.items) };
    game.packs = [pack];
    const dialog = new AddAfflictionDialog(null, { actor, addictionMode: true });
    const context = await dialog._prepareContext({});
    expect(context).toMatchObject({ addictionMode: true, token: { name: actor.name }, savedCustomAfflictions: [] });
    expect(context.actorItems.map(i => i.name)).toEqual(['Pesh']);
    expect(context.compendiumItems.map(i => i.name)).toEqual(['Pesh']);
    expect(pack.getIndex).toHaveBeenCalledWith({ fields: ['system.traits.value'] });
  });

  test('item selection with missing DC asks only for DC and preserves the dragged name', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    const item = drugItem({ name: 'Custom Drug', system: { traits: { value: ['drug'] }, description: { value: '' } } });
    foundry.applications.api.DialogV2 = { prompt: jest.fn(async () => ({ dc: 23 })) };
    fromUuid.mockResolvedValue(item);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dialog = new AddAfflictionDialog(token, { addictionMode: true });
    await AddAfflictionDialog.addFromItem.call(dialog, null, { dataset: { itemUuid: item.uuid } });
    expect(foundry.applications.api.DialogV2.prompt.mock.calls[0][0].content).not.toContain('name="drugName"');
    expect(Object.values(Store.getAfflictions(token))[0]).toMatchObject({ drugName: 'Custom Drug', dc: 23 });
  });

  test('invalid drops, canceled DC prompts, disabled rules, and non-GM cannot add drugs', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    const dialog = new AddAfflictionDialog(token, { addictionMode: true });
    const drop = () => dialog._onDrop({ preventDefault: jest.fn(), dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid: 'Item.drug' }) } });
    fromUuid.mockResolvedValue({ name: 'Venom', type: 'affliction' });
    await drop();
    fromUuid.mockResolvedValue(drugItem({ system: { traits: { value: ['drug'] } } }));
    foundry.applications.api.DialogV2 = { prompt: jest.fn(async () => null) };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await drop();
    expect(foundry.applications.api.DialogV2.prompt).toHaveBeenCalledTimes(1);
    fromUuid.mockResolvedValue(drugItem());
    game.settings.get.mockReturnValue(false);
    await drop();
    game.settings.get.mockReturnValue(true);
    game.user.isGM = false;
    await drop();
    expect(Store.getAfflictions(token)).toEqual({});
    expect(Chat.promptInitialSave).not.toHaveBeenCalled();
  });

  test('manual drug entry remains optional and records standard addiction', async () => {
    const { AddAfflictionDialog } = await import('../scripts/managers/AddAfflictionDialog.js');
    foundry.applications.api.DialogV2 = { prompt: jest.fn(async () => ({ drugName: 'Custom Drug', dc: 24 })) };
    const dialog = new AddAfflictionDialog(token, { addictionMode: true });
    await AddAfflictionDialog.addManual.call(dialog);
    expect(Object.values(Store.getAfflictions(token))[0]).toMatchObject({ drugName: 'Custom Drug', dc: 24, isAddiction: true });
  });

  test('manager hides drug controls and rejects stale actions while rules are off', async () => {
    const value = await use('Pesh', 9);
    foundry.applications = { api: {
      ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base,
      DialogV2: { prompt: jest.fn() },
    } };
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const app = Object.create(AfflictionManager.prototype);
    const enabled = app._enrichAfflictions(Store.getAfflictions(token))[0];
    expect(enabled.canTakeDrug).toBe(true);
    game.settings.get.mockImplementation((_module, key) => key === 'editedAfflictions' ? {} : false);
    const disabled = app._enrichAfflictions(Store.getAfflictions(token))[0];
    expect(disabled).toMatchObject({ canTakeDrug: false, canRollSave: false, canProgressStage: false, canRegressStage: false });
    await AfflictionManager.addAddiction.call(app);
    await AfflictionManager.takeDrug.call(app, null, { dataset: { afflictionId: value.id } });
    expect(foundry.applications.api.DialogV2.prompt).not.toHaveBeenCalled();
    expect(Chat.promptInitialSave).toHaveBeenCalledTimes(1);
    AfflictionManager.currentInstance = { render: jest.fn() };
    await DEFAULT_SETTINGS.enableAddictionRules.onChange();
    expect(AfflictionManager.currentInstance.render).toHaveBeenCalledWith({ force: true });
    AfflictionManager.currentInstance = null;
  });

  test('addiction conditions use locked grants and never standalone persistent conditions', async () => {
    const value = Addiction.createDefinition('Pesh', 20);
    const rules = await Effects._buildRulesFromStage(value, value.stages[3], []);
    expect(rules).toHaveLength(4);
    expect(rules.every(rule => rule.inMemoryOnly && rule.onDeleteActions.grantee === 'restrict')).toBe(true);
    await Effects.applyPersistentConditions(actor, value, value.stages[3]);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test('deleting the effect cannot remove symptoms while disease remains, but recovery can', async () => {
    const value = await use('Pesh', 9);
    await advance(DAY);
    const removed = actor.items[0];
    removed.parent = actor;
    await removed.delete();
    await onDeleteItem(removed);
    expect(actor.items).toHaveLength(1);
    expect(actor.items[0].system.rules).toHaveLength(2);
    const recovered = actor.items[0];
    recovered.parent = actor;
    await Addiction.remove(token, actor, saved(value));
    await onDeleteItem(recovered);
    expect(actor.items).toHaveLength(0);
  });

  test('non-GM cannot start, resolve, remove, or advance addiction', async () => {
    const value = await use();
    game.user.isGM = false;
    await Addiction.promptDrugUse(token, value, actor);
    await Addiction.changeStage(token, actor, value, 4);
    await Addiction.remove(token, actor, value);
    await Addiction.handleDrugSave(token, value, 'criticalFailure', actor);
    expect(saved(value).currentStage).toBe(0);
  });
});
