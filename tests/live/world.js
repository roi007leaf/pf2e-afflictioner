const MODULE = 'pf2e-afflictioner';
const MARKER = 'liveTestRun';

function owned(document, runId) {
  return document?.getFlag?.(MODULE, MARKER) === runId;
}

function assertion(label, value, details) {
  if (!value) throw Error(`${label}${details === undefined ? '' : `: ${JSON.stringify(details)}`}`);
  return { label, status: 'passed' };
}

async function waitFor(predicate, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`Timed out waiting for ${label}`);
}

function stage(number, effects = '') {
  return {
    number,
    effects,
    rawText: effects,
    duration: { value: 1, unit: 'minute' },
    damage: [], conditions: [], weakness: [], autoEffects: [], ruleElements: [], visibilityEffects: [],
  };
}

function affliction(id = foundry.utils.randomID()) {
  return {
    id,
    name: `QA Affliction ${id.slice(0, 4)}`,
    type: 'poison', traits: ['poison'], dc: 20, saveType: 'fortitude', level: 2,
    currentStage: 1, needsInitialSave: false, inOnset: false, onsetRemaining: 0,
    durationElapsed: 0, maxDurationElapsed: 0, treatmentBonus: 0, treatedThisStage: false,
    addedTimestamp: Date.now(), stages: [stage(1, 'enfeebled 1'), stage(2, 'clumsy 1')],
  };
}

async function modules() {
  const [store, coating, service, parser, editor, definitions, treatment, counteract, timer, visual, region, manager, chat, worldTime, effects, recovery, feats, vishkanya, weapon, immunityRules, monitor, stageEditor, storyframe, parserLocales, ruLocale, zhLocale] = await Promise.all([
    import('../../scripts/stores/AfflictionStore.js'),
    import('../../scripts/stores/WeaponCoatingStore.js'),
    import('../../scripts/services/AfflictionService.js'),
    import('../../scripts/services/AfflictionParser.js'),
    import('../../scripts/services/AfflictionEditorService.js'),
    import('../../scripts/stores/AfflictionDefinitionStore.js'),
    import('../../scripts/services/TreatmentService.js'),
    import('../../scripts/services/CounteractService.js'),
    import('../../scripts/services/AfflictionTimerService.js'),
    import('../../scripts/services/VisualService.js'),
    import('../../scripts/regions/AfflictionRegionBehavior.js'),
    import('../../scripts/managers/AfflictionManager.js'),
    import('../../scripts/services/AfflictionChatService.js'),
    import('../../scripts/hooks/worldTime.js'),
    import('../../scripts/services/AfflictionEffectBuilder.js'),
    import('../../scripts/services/RecoveryRestrictionService.js'),
    import('../../scripts/services/FeatsService.js'),
    import('../../scripts/services/VishkanyaService.js'),
    import('../../scripts/services/WeaponCoatingService.js'),
    import('../../scripts/stores/ImmunityBypassRuleStore.js'),
    import('../../scripts/ui/AfflictionMonitorIndicator.js'),
    import('../../scripts/managers/StageEditorDialog.js'),
    import('../../scripts/services/StoryframeIntegrationService.js'),
    import('../../scripts/locales/parser-locales.js'),
    import('../../scripts/locales/parser-locale-ru.js'),
    import('../../scripts/locales/parser-locale-zh.js'),
  ]);
  return { store, coating, service, parser, editor, definitions, treatment, counteract, timer, visual, region, manager, chat, worldTime, effects, recovery, feats, vishkanya, weapon, immunityRules, monitor, stageEditor, storyframe, parserLocales, ruLocale, zhLocale };
}

export function preflight() {
  const module = game.modules.get(MODULE);
  return {
    world: game.world.id,
    user: game.user.id,
    isGM: game.user.isGM,
    scene: canvas.scene?.id ?? null,
    foundry: game.release?.generation,
    system: game.system.id,
    systemVersion: game.system.version,
    moduleActive: module?.active === true,
    moduleVersion: module?.version,
  };
}

export function settingsSnapshot() {
  const values = {};
  for (const key of ['showVisualIndicators', 'allowPlayerWeaponCoatingAccess', 'anonymizeSaveMessages', 'editedAfflictions', 'poisonSuccessStageOne', 'enableAddictionRules']) {
    values[key] = foundry.utils.deepClone(game.settings.get(MODULE, key));
  }
  return values;
}

export async function restoreSettings(values) {
  if (!game.user.isGM) throw Error('GM required to restore settings');
  for (const [key, value] of Object.entries(values ?? {})) await game.settings.set(MODULE, key, value);
}

export async function prepare({ runId, playerUserId, name }) {
  if (!game.user.isGM || !runId) throw Error('GM run ID required');
  const flag = { [MODULE]: { [MARKER]: runId, case: name } };
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [playerUserId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
  const [target, source] = await globalThis.Actor.createDocuments([
    { name: `Afflictioner QA Target ${name}`, type: 'npc', ownership, flags: flag,
      prototypeToken: { name: `QA Target ${name}`, actorLink: true, disposition: 1 } },
    { name: `Afflictioner QA Source ${name}`, type: 'npc', flags: flag,
      prototypeToken: { name: `QA Source ${name}`, actorLink: true, disposition: -1 } },
  ]);
  const scene = await globalThis.Scene.create({ name: `Afflictioner QA ${name}`, width: 2000, height: 1400, grid: { size: 100 }, flags: flag });
  const tokens = await scene.createEmbeddedDocuments('Token', [
    { name: target.name, actorId: target.id, actorLink: true, x: 400, y: 500, disposition: 1, flags: flag },
    { name: source.name, actorId: source.id, actorLink: true, x: 800, y: 500, disposition: -1, flags: flag },
  ]);
  await scene.view();
  await new Promise(resolve => {
    if (canvas.ready && canvas.scene?.id === scene.id) return resolve();
    Hooks.once('canvasReady', resolve);
  });
  globalThis.__afflictionerLiveRun = runId;
  if (!globalThis.__afflictionerLiveChatHook) {
    globalThis.__afflictionerLiveChatHook = Hooks.on('createChatMessage', message => {
      const activeRun = globalThis.__afflictionerLiveRun;
      if (activeRun && game.user.isGM && !message.getFlag(MODULE, MARKER)) void message.setFlag(MODULE, MARKER, activeRun);
    });
  }
  return {
    runId,
    scene: scene.id,
    targetActor: target.id,
    sourceActor: source.id,
    target: tokens[0].id,
    source: tokens[1].id,
    messages: game.messages.map(message => message.id),
  };
}

export async function view(fixture) {
  const scene = game.scenes.get(fixture.scene);
  if (!scene || !owned(scene, fixture.runId)) throw Error('Owned QA scene required');
  await scene.view();
  if (!canvas.ready || canvas.scene?.id !== scene.id) await new Promise(resolve => Hooks.once('canvasReady', resolve));
}

function documents(fixture) {
  if (canvas.scene?.id !== fixture.scene || !owned(canvas.scene, fixture.runId)) throw Error('Owned fixture required');
  const target = canvas.tokens.get(fixture.target);
  const source = canvas.tokens.get(fixture.source);
  if (!target || !source || !owned(target.document, fixture.runId) || !owned(target.actor, fixture.runId)) throw Error('Owned tokens required');
  return { target, source, actor: target.actor, sourceActor: source.actor };
}

async function storeAffliction(store, target, value = affliction()) {
  await store.addAffliction(target, value);
  return store.getAffliction(target, value.id);
}

// Character actor + token carrying real feat/heritage items (NPCs can't hold feats).
async function featCharacter(fixture, { feats = [], heritage = null, name = 'Feat Holder', x = 1200 } = {}) {
  const flag = { [MODULE]: { [MARKER]: fixture.runId } };
  const [character] = await globalThis.Actor.createDocuments([{ name: `Afflictioner QA ${name}`, type: 'character', flags: flag,
    prototypeToken: { actorLink: true } }]);
  const items = feats.map(slug => ({ name: slug, type: 'feat', system: { slug, category: 'skill', level: { value: 1 } }, flags: flag }));
  if (heritage) items.push({ name: heritage, type: 'heritage', system: { slug: heritage }, flags: flag });
  if (items.length) await character.createEmbeddedDocuments('Item', items);
  const [tokenDoc] = await canvas.scene.createEmbeddedDocuments('Token', [{ name: character.name, actorId: character.id, actorLink: true, x, y: 500, flags: flag }]);
  await waitFor(() => canvas.tokens.get(tokenDoc.id), 'feat character token');
  return canvas.tokens.get(tokenDoc.id);
}

function featStage(number, formula) {
  return { ...stage(number), duration: { value: 1, unit: 'round' }, damage: [{ formula, type: 'poison' }] };
}

async function rollSave(actor, dc, extra = {}) {
  const before = new Set(game.messages.map(message => message.id));
  await actor.saves.fortitude.roll({ dc: { value: dc }, skipDialog: true, ...extra });
  await waitFor(() => game.messages.some(message => !before.has(message.id) && message.flags?.pf2e?.context?.type === 'saving-throw'), 'save roll message');
  return game.messages.contents.findLast(message => !before.has(message.id) && message.flags?.pf2e?.context?.type === 'saving-throw');
}

async function runWorkflow(name, fixture) {
  const m = await modules();
  const { target, actor } = documents(fixture);
  const checks = [];

  if (name === 'runtime-api-crud') {
    const api = game.modules.get(MODULE).api;
    const value = affliction();
    await api.addAffliction(target, value);
    checks.push(assertion('API adds affliction', api.getAffliction(target, value.id)?.name === value.name));
    await api.updateAffliction(target, value.id, { treatmentBonus: 2 });
    checks.push(assertion('API updates affliction', api.getAffliction(target, value.id)?.treatmentBonus === 2));
    await api.removeAffliction(target, value.id);
    checks.push(assertion('API removes affliction', !api.getAffliction(target, value.id)));
  } else if (name === 'parser-native-item') {
    const [item] = await actor.createEmbeddedDocuments('Item', [{
      name: 'QA Parsed Venom', type: 'consumable', flags: { [MODULE]: { [MARKER]: fixture.runId } },
      system: { save: { dc: 21, statistic: 'fortitude' }, traits: { value: ['alchemical', 'consumable', 'poison'] }, description: { value: '<p><strong>Saving Throw</strong> DC 21 Fortitude</p><p><strong>Stage 1</strong> 1d6 poison damage and enfeebled 1 (1 round)</p><p><strong>Stage 2</strong> 2d6 poison damage (1 round)</p>' } },
    }]);
    const parsed = m.parser.AfflictionParser.parseFromItem(item);
    checks.push(assertion('native PF2e Item parses as poison', parsed?.type === 'poison', parsed));
    checks.push(assertion('save DC and stages parse', parsed?.dc === 21 && parsed?.stages?.length === 2, parsed));
    checks.push(assertion('damage and condition parse', parsed.stages[0].damage.length > 0 && parsed.stages[0].conditions.length > 0));
  } else if (name === 'parser-advanced-syntax') {
    const duration = m.parser.AfflictionParser.parseDuration('1d4 + 1 rounds');
    const damage = m.parser.AfflictionParser.extractDamage('2d6 fire or cold damage');
    const exposure = m.parser.AfflictionParser.extractMultipleExposure('<p>Each additional exposure while at stage 2 increases the stage by 1.</p>');
    const restriction = m.parser.AfflictionParser.extractRecoveryRestriction('<p>This affliction can\u2019t be reduced below stage 1, nor can the damage from it be healed, until it\u2019s successfully treated with remove curse.</p>');
    const reference = m.parser.AfflictionParser.extractReferencedAfflictions('The target is exposed to Darkening Poison (poison).');
    checks.push(assertion('dice duration and damage choices parse', duration?.isDice === true && damage.some(entry => entry.isChoice && entry.alternativeType === 'cold'), { duration, damage }));
    checks.push(assertion('multiple exposure qualifier parses', exposure?.stageIncrease === 1 && exposure?.minStage === 2, exposure));
    checks.push(assertion('recovery restriction parses completely', restriction?.minimumStage === 1 && restriction?.unhealableDamage && restriction?.requiresCounteract, restriction));
    checks.push(assertion('referenced affliction and death semantics parse', reference[0] === 'Darkening Poison' && m.parser.AfflictionParser.detectDeath('the target dies')));
  } else if (name === 'parser-locales') {
    const ru = m.parserLocales.withLocale(m.ruLocale.RU_PARSER_LOCALE, () => m.parser.AfflictionParser.extractStages('<p><strong>\u0421\u0442\u0430\u0434\u0438\u044f 1:</strong> @Damage[1d4[poison]] (1 \u0440\u0430\u0443\u043d\u0434)</p>'));
    const zh = m.parserLocales.withLocale(m.zhLocale.ZH_PARSER_LOCALE, () => m.parser.AfflictionParser.extractStages('<p><strong>\u9636\u6bb51</strong> @Damage[1d4[poison]]\uff081\u8f6e\uff09</p>'));
    checks.push(assertion('Russian stage syntax parses live', ru.length === 1 && ru[0].duration?.unit === 'round', ru));
    checks.push(assertion('Chinese stage syntax parses live', zh.length === 1 && zh[0].duration?.unit === 'round', zh));
    checks.push(assertion('unknown session locale has English fallback', m.parserLocales.getEnParserLocale().id === 'en'));
  } else if (name === 'parser-structured-and-effect-only') {
    const structured = m.parser.AfflictionParser.parseFromItem({
      name: 'QA Structured Disease', uuid: 'Item.qa-structured', img: 'icons/svg/biohazard.svg',
      system: { stage: { 1: { duration: '1 round', effects: [{ type: 'damage', formula: '1d6', damageType: 'poison' }, { name: 'clumsy', value: 1 }] } }, save: { dc: 22 }, traits: { value: ['disease'] }, description: { value: 'Fortitude' }, level: { value: 3 } },
    });
    const effectOnly = m.parser.AfflictionParser.parseFromItem({
      name: 'QA Effect Curse', uuid: 'Item.qa-effect', img: 'icons/svg/daze.svg',
      system: { traits: { value: ['curse'] }, description: { value: '<p><strong>Saving Throw</strong> DC 20 Will</p><p><strong>Effect</strong> frightened 2</p>' }, level: { value: 2 } },
    });
    checks.push(assertion('structured affliction data parses', structured?.stages?.[0]?.damage?.length === 1 && structured.type === 'disease', structured));
    checks.push(assertion('effect-only curse parses without fake stages', effectOnly?.isEffectOnly === true && effectOnly?.stages === null && effectOnly.effectConditions.length > 0, effectOnly));
  } else if (name === 'initial-save-failure') {
    const value = { ...affliction(), currentStage: -1, needsInitialSave: true };
    await storeAffliction(m.store, target, value);
    await m.service.AfflictionService.handleInitialSave(target, value, 10, 20, 8);
    const saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('failed initial save starts stage one', saved?.currentStage === 1 && saved.needsInitialSave === false, saved));
    checks.push(assertion('stage effect created on PF2e actor', actor.items.some(item => item.flags?.[MODULE]?.afflictionId === value.id)));
  } else if (name === 'initial-save-resisted') {
    const value = { ...affliction(), currentStage: -1, needsInitialSave: true };
    await storeAffliction(m.store, target, value);
    await m.service.AfflictionService.handleInitialSave(target, value, 30, 20, 15);
    checks.push(assertion('successful initial save removes affliction', !m.store.getAffliction(target, value.id)));
  } else if (name === 'legacy-addiction') {
    const { AddictionService: addiction } = await import('../../scripts/services/AddictionService.js');
    const api = game.modules.get(MODULE).api;
    checks.push(assertion('addiction world setting defaults off', game.settings.settings.get(`${MODULE}.enableAddictionRules`)?.default === false));
    await game.settings.set(MODULE, 'enableAddictionRules', false);
    await api.takeDrug(target, 'QA Pesh', 20);
    checks.push(assertion('disabled setting prevents new addiction', !Object.values(m.store.getAfflictions(target)).some(a => a.isAddiction)));
    await game.settings.set(MODULE, 'enableAddictionRules', true);
    const { AddAfflictionDialog } = await import('../../scripts/managers/AddAfflictionDialog.js');
    const [drug] = await actor.createEmbeddedDocuments('Item', [{
      name: 'QA Pesh', type: 'consumable', img: 'icons/svg/biohazard.svg',
      system: { traits: { value: ['drug', 'poison', 'alchemical', 'consumable'] }, description: { value: '<p>Saving Throw @Check[fortitude|dc:20]</p>' } },
    }]);
    const picker = new AddAfflictionDialog(target, { addictionMode: true });
    const completed = new Promise((resolve, reject) => {
      const onDrop = picker._onDrop.bind(picker);
      picker._onDrop = async event => { try { await onDrop(event); resolve(); } catch (error) { reject(error); } };
    });
    picker.render(true);
    await waitFor(() => !!picker.element?.querySelector('.drop-zone'), 'drug drop dialog', 20000);
    checks.push(assertion('addiction dialog shows drug picker and manual fallback', !!picker.element.querySelector(`[data-item-uuid="${drug.uuid}"]`) && !!picker.element.querySelector('[data-action="addManual"]')));
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => JSON.stringify({ type: 'Item', uuid: drug.uuid }) } });
    picker.element.querySelector('.drop-zone').dispatchEvent(drop);
    await completed;
    await picker.close();
    const value = Object.values(m.store.getAfflictions(target)).find(a => a.isAddiction);
    checks.push(assertion('drug drop reads name DC and icon', value?.drugName === drug.name && value.dc === 20 && value.img === drug.img));
    await m.service.AfflictionService.handleInitialSave(target, value, 9, 20, 10);
    let saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('critical failure starts stage two after onset', saved?.stageAdvancement === 2 && saved.inOnset));
    // Move only disposable affliction timestamps; never advance campaign time.
    await m.store.updateAffliction(target, value.id, { onsetEndsAt: game.time.worldTime, suppressedUntil: game.time.worldTime });
    await addiction.processTime(target, actor, m.store.getAffliction(target, value.id));
    saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('onset applies fatigued and sickened natively', actor.hasCondition('fatigued') && actor.hasCondition('sickened')));
    await m.service.AfflictionService.handleStageSave(target, saved, 9, 20, false, 10);
    checks.push(assertion('failed weekly save cannot worsen stage', m.store.getAffliction(target, value.id)?.currentStage === 2));
    await m.service.AfflictionService.handleStageSave(target, m.store.getAffliction(target, value.id), 20, 20, false, 10);
    checks.push(assertion('successful recovery preserves highest stage', m.store.getAffliction(target, value.id)?.currentStage === 1 && api.getAddictionMaximum(target, 'QA Pesh') === 2));
    await api.takeDrug(target, 'QA Pesh', 20);
    checks.push(assertion('drug use immediately suppresses native conditions', !actor.hasCondition('fatigued') && !actor.hasCondition('sickened')));
    await m.service.AfflictionService.handleInitialSave(target, m.store.getAffliction(target, value.id), 19, 20, 10);
    checks.push(assertion('relapse advances from maximum instead of current stage', m.store.getAffliction(target, value.id)?.currentStage === 3));
    await m.store.updateAffliction(target, value.id, { suppressedUntil: game.time.worldTime });
    await addiction.processTime(target, actor, m.store.getAffliction(target, value.id));
    checks.push(assertion('suppression expiry restores fatigued sickened and drained', actor.hasCondition('fatigued') && actor.hasCondition('sickened') && actor.hasCondition('drained')));
    const app = new m.manager.AfflictionManager({ filterTokenId: target.id });
    app.render(true);
    await waitFor(() => !!app.element?.querySelector('[data-action="takeDrug"]'), 'addiction controls');
    checks.push(assertion('manager renders add and take-drug controls', !!app.element.querySelector('[data-action="addAddiction"]') && app.element.textContent.includes('Highest stage: 3')));
    await app.close();
    await api.removeAffliction(target, value.id);
    checks.push(assertion('removal preserves history and clears addiction symptoms', api.getAddictionMaximum(target, 'QA Pesh') === 3 && !actor.hasCondition('fatigued') && !actor.hasCondition('drained')));
    await api.takeDrug(target, 'QA Pesh', 20);
    const relapse = Object.values(m.store.getAfflictions(target)).find(a => a.isAddiction);
    await m.service.AfflictionService.handleInitialSave(target, relapse, 9, 20, 10);
    checks.push(assertion('relapse after removal caps at stage four', m.store.getAffliction(target, relapse.id)?.stageAdvancement === 4));
    await api.takeDrug(null, 'QA Flayleaf', 20, actor);
    const other = Object.values(m.store.getAfflictionsForActor(actor)).find(a => a.drugName === 'QA Flayleaf');
    await m.service.AfflictionService.handleInitialSave(null, other, 19, 20, 10, actor);
    checks.push(assertion('other drug history starts independently through actor API', m.store.getAfflictionForActor(actor, other.id)?.stageAdvancement === 1));
  } else if (name === 'poison-success-house-rule') {
    const original = game.settings.get(MODULE, 'poisonSuccessStageOne');
    try {
      await game.settings.set(MODULE, 'poisonSuccessStageOne', true);
      const value = { ...affliction(), currentStage: -1, needsInitialSave: true };
      await storeAffliction(m.store, target, value);
      await m.service.AfflictionService.handleInitialSave(target, value, 20, 20, 10);
      let saved = m.store.getAffliction(target, value.id);
      checks.push(assertion('initial success applies capped stage one', saved?.currentStage === 1 && saved.successStageLimit === 1, saved));
      checks.push(assertion('stage-one PF2e effect exists', actor.items.some(item => item.flags?.[MODULE]?.afflictionId === value.id)));
      await m.service.AfflictionService.handleStageSave(target, saved, 5, 20, false, 5);
      saved = m.store.getAffliction(target, value.id);
      checks.push(assertion('critical failure during recovery respects cap', saved?.currentStage === 1 && saved.successStageLimit === 1, saved));
      const exposure = { ...affliction(), name: value.name, _isReExposure: true, _existingAfflictionId: value.id, needsInitialSave: true, currentStage: -1 };
      await storeAffliction(m.store, target, exposure);
      await m.service.AfflictionService.handleInitialSave(target, exposure, 20, 20, 10);
      checks.push(assertion('successful re-exposure preserves cap', m.store.getAffliction(target, value.id)?.successStageLimit === 1 && !m.store.getAffliction(target, exposure.id)));
      await storeAffliction(m.store, target, exposure);
      await m.service.AfflictionService.handleInitialSave(target, exposure, 19, 20, 10);
      saved = m.store.getAffliction(target, value.id);
      checks.push(assertion('failed re-exposure removes cap and advances', saved?.currentStage === 2 && saved.successStageLimit === null, saved));
      await m.service.AfflictionService.handleStageSave(target, saved, 30, 20, false, 15);
      checks.push(assertion('normal recovery removes poison', !m.store.getAffliction(target, value.id)));
      const resisted = { ...affliction(), currentStage: -1, needsInitialSave: true };
      await storeAffliction(m.store, target, resisted);
      await m.service.AfflictionService.handleInitialSave(target, resisted, 30, 20, 15);
      checks.push(assertion('critical success still avoids poison', !m.store.getAffliction(target, resisted.id)));
    } finally {
      await game.settings.set(MODULE, 'poisonSuccessStageOne', original);
    }
  } else if (name === 'stage-advance-and-recovery') {
    const value = await storeAffliction(m.store, target);
    await m.service.AfflictionService.handleStageSave(target, value, 10, 20, false, 8);
    const advanced = m.store.getAffliction(target, value.id);
    checks.push(assertion('failed save advances stage', advanced?.currentStage === 2, advanced));
    await m.service.AfflictionService.handleStageSave(target, advanced, 40, 20, false, 20);
    checks.push(assertion('critical success recovers from stage two', !m.store.getAffliction(target, value.id)));
  } else if (name === 'manual-stage-and-incapacitation') {
    const value = await storeAffliction(m.store, target);
    await m.service.AfflictionService.adjustStageManually(target, value, 1, actor);
    checks.push(assertion('manual progress advances exactly one stage', m.store.getAffliction(target, value.id)?.currentStage === 2));
    await m.service.AfflictionService.adjustStageManually(target, m.store.getAffliction(target, value.id), -1, actor);
    checks.push(assertion('manual regress decreases exactly one stage', m.store.getAffliction(target, value.id)?.currentStage === 1));
    const result = m.service.AfflictionService.calculateAfflictionDegreeResult(10, 20, 10, { system: { details: { level: { value: 10 } } } }, { traits: ['incapacitation'], level: 2 });
    checks.push(assertion('incapacitation upgrades a higher-level target result', result.rawDegree === 'failure' && result.degree === 'success' && result.incapacitationApplied, result));
  } else if (name === 'multiple-exposure-and-virulent') {
    const value = { ...affliction(), isVirulent: true, virulentConsecutiveSuccesses: 0 };
    await storeAffliction(m.store, target, value);
    await m.service.AfflictionService.handleStageSave(target, value, 25, 20, false, 10, actor);
    const first = m.store.getAffliction(target, value.id);
    checks.push(assertion('first virulent success records progress without stage loss', first.currentStage === 1 && first.virulentConsecutiveSuccesses === 1, first));
    await m.service.AfflictionService.handleStageSave(target, first, 25, 20, false, 10, actor);
    checks.push(assertion('second virulent success recovers', !m.store.getAffliction(target, value.id)));
    const exposure = await storeAffliction(m.store, target, { ...affliction(), multipleExposure: { enabled: true, stageIncrease: 1, minStage: 1 } });
    await m.service.AfflictionService.handleMultipleExposure(target, exposure, exposure, actor);
    checks.push(assertion('multiple exposure advances and resets timing', m.store.getAffliction(target, exposure.id)?.currentStage === 2));
  } else if (name === 'onset-world-time') {
    const value = { ...affliction(), currentStage: 0, inOnset: true, onset: { value: 1, unit: 'round' }, onsetRemaining: 6, stageAdvancement: 1 };
    await storeAffliction(m.store, target, value);
    await m.worldTime.onWorldTimeUpdate(game.time.worldTime + 6, 6);
    const saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('world time completes onset', saved?.inOnset === false && saved.currentStage === 1, saved));
  } else if (name === 'maximum-duration') {
    const value = { ...affliction(), maxDuration: { value: 1, unit: 'round' }, maxDurationElapsed: 0 };
    await storeAffliction(m.store, target, value);
    await m.timer.AfflictionTimerService.checkWorldTimeMaxDuration(target, value, 6);
    const saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('maximum duration is tracked and marked expired', saved?.maxDurationElapsed === 6 && saved.maxDurationExpired === true, saved));
  } else if (name === 'stage-effect-rules') {
    const value = await storeAffliction(m.store, target);
    const effectStage = { ...stage(1, 'enfeebled 2'), conditions: [{ name: 'enfeebled', value: 2 }], ruleElements: [{ key: 'FlatModifier', selector: 'fortitude', value: -1 }] };
    await m.service.AfflictionService.applyStageEffects(target, value, effectStage);
    const effect = actor.items.find(item => item.flags?.[MODULE]?.afflictionId === value.id);
    checks.push(assertion('stage creates native PF2e effect', !!effect));
    checks.push(assertion('configured rule element reaches effect', effect?.system?.rules?.some(rule => rule.key === 'FlatModifier')));
    await m.service.AfflictionService.removeStageEffects(target, value, effectStage, null);
    checks.push(assertion('stage-bound effect is removed', !actor.items.some(item => item.flags?.[MODULE]?.afflictionId === value.id)));
  } else if (name === 'persistent-condition-lifetime') {
    const value = await storeAffliction(m.store, target);
    const effectStage = { ...stage(1, 'frightened 1'), conditions: [{ name: 'frightened', value: 1 }] };
    await m.service.AfflictionService.applyStageEffects(target, value, effectStage);
    const condition = actor.items.find(item => item.type === 'condition' && item.slug === 'frightened');
    checks.push(assertion('persistent condition applies natively', !!condition));
    await m.service.AfflictionService.removeStageEffects(target, value, effectStage, null);
    checks.push(assertion('PF2e-removal condition outlives stage', actor.items.some(item => item.id === condition?.id)));
  } else if (name === 'advanced-stage-effects') {
    const value = await storeAffliction(m.store, target);
    const effectStage = {
      ...stage(1, 'weakness to fire 5; clumsy 1 for 1 round'),
      weakness: [{ type: 'fire', value: 5 }],
      conditions: [{ name: 'clumsy', value: 1, duration: { value: 1, unit: 'round' } }],
      ruleElements: [{ key: 'FlatModifier', selector: 'fortitude', type: 'status', value: -2 }],
    };
    await m.service.AfflictionService.applyStageEffects(target, value, effectStage);
    const effect = actor.items.find(item => item.flags?.[MODULE]?.afflictionId === value.id && item.type === 'effect');
    const timed = actor.items.find(item => item.flags?.[MODULE]?.afflictionId === value.id && item.flags?.[MODULE]?.timedCondition === true);
    checks.push(assertion('weakness and editor rule elements reach native effect', effect?.system?.rules?.some(rule => rule.key === 'Weakness' && (rule.type === 'fire' || rule.type?.includes?.('fire'))) && effect.system.rules.some(rule => rule.key === 'FlatModifier'), effect?.system?.rules));
    checks.push(assertion('inline-duration condition becomes expiring native effect', timed?.type === 'effect' && timed?.system?.duration?.value === 1 && timed?.system?.duration?.unit === 'rounds' && timed.system.rules.some(rule => rule.key === 'GrantItem'), timed?.toObject()));
    const immutable = m.recovery.RecoveryRestrictionService.buildDamageLink('1d6', 'poison', value);
    checks.push(assertion('affliction damage is immutable against recipient bonuses', immutable.includes('|immutable')));
  } else if (name === 'actor-immunity') {
    await actor.createEmbeddedDocuments('Item', [{
      name: 'QA Poison Immunity',
      type: 'effect',
      system: { duration: { value: -1, unit: 'unlimited' }, rules: [{ key: 'Immunity', type: 'poison' }] },
      flags: { [MODULE]: { [MARKER]: fixture.runId } },
    }]);
    await waitFor(() => actor.system.attributes.immunities.some(immunity => immunity.type === 'poison'), 'PF2e immunity preparation');
    const value = affliction();
    checks.push(assertion('production immunity detector sees poison', m.service.AfflictionService.isActorImmuneToAffliction(actor, value)));
    await m.service.AfflictionService.promptInitialSave(target, value);
    checks.push(assertion('immune actor receives no affliction', Object.keys(m.store.getAfflictions(target)).length === 0));
  } else if (name === 'source-immunity-bypass') {
    const sourceActor = documents(fixture).sourceActor;
    await actor.createEmbeddedDocuments('Item', [{ name: 'QA Poison Immunity', type: 'effect', system: { duration: { value: -1, unit: 'unlimited' }, rules: [{ key: 'Immunity', type: 'poison' }] } }]);
    await waitFor(() => actor.system.attributes.immunities.some(entry => entry.type === 'poison'), 'poison immunity');
    await m.immunityRules.saveRule(sourceActor, { enabled: true, traits: ['poison'], afflictionKeys: [] });
    const value = { ...affliction(), originActorId: sourceActor.id, originActorUuid: sourceActor.uuid };
    const result = await m.service.AfflictionService.getActorAfflictionImmunityResult(actor, value);
    checks.push(assertion('source bypass rule persists on actor', m.immunityRules.getRule(sourceActor).enabled === true));
    checks.push(assertion('matching source rule bypasses poison immunity', result.remaining.length === 0 && result.bypassed.includes('poison'), result));
  } else if (name === 'edited-definition') {
    const value = affliction();
    const key = m.definitions.generateDefinitionKey(value);
    await m.definitions.saveEditedDefinition(key, { dc: 27, stages: value.stages });
    const edited = m.editor.AfflictionEditorService.applyEditedDefinition(value, m.definitions.getEditedDefinition(key));
    checks.push(assertion('edited definition persists', m.definitions.getEditedDefinition(key)?.dc === 27));
    checks.push(assertion('edited definition applies', edited.dc === 27));
    await m.definitions.removeEditedDefinition(key);
  } else if (name === 'custom-icon-and-stage-editor') {
    const value = { ...affliction(), img: 'icons/svg/biohazard.svg' };
    await storeAffliction(m.store, target, value);
    await m.service.AfflictionService.applyStageEffects(target, value, value.stages[0]);
    const effect = actor.items.find(item => item.flags?.[MODULE]?.afflictionId === value.id && item.type === 'effect');
    const entries = m.stageEditor.StageEditorDialog.collectIndexedFormEntries({ conditions: { 0: { name: 'clumsy', value: 1 }, 1: { name: 'enfeebled', value: 2 } } }, 'conditions', ['name', 'value']);
    checks.push(assertion('custom icon reaches applied effect', effect?.img === value.img, effect?.img));
    checks.push(assertion('stage editor retains indexed conditions', entries.length === 2 && entries[1].name === 'enfeebled', entries));
    checks.push(assertion('rule labels use affliction and stage', m.stageEditor.StageEditorDialog.buildRuleElementLabel('QA Venom', 2) === 'QA Venom - Stage 2'));
  } else if (name === 'treatment-result') {
    const value = await storeAffliction(m.store, target);
    await m.treatment.TreatmentService.handleTreatmentResult(target, value, 30, 20);
    const saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('critical treatment grants +4', saved?.treatmentBonus === 4 && saved.treatedThisStage === true, saved));
    checks.push(assertion('treatment creates native modifier effect', actor.items.some(item => item.flags?.[MODULE]?.isTreatmentBonus)));
  } else if (name === 'counteract-result') {
    const value = await storeAffliction(m.store, target);
    const result = await m.counteract.CounteractService.handleCounteractResult(target, value, 2, 1, 'success');
    checks.push(assertion('eligible counteract succeeds', result === true));
    checks.push(assertion('successful counteract removes affliction', !m.store.getAffliction(target, value.id)));
  } else if (name === 'recovery-restrictions') {
    const value = { ...affliction(), currentStage: 2, recoveryRestriction: { minimumStage: 1, unhealableDamage: true, requiresCounteract: true } };
    await storeAffliction(m.store, target, value);
    await m.service.AfflictionService.applyStageEffects(target, value, value.stages[1]);
    const effect = actor.items.find(item => item.flags?.[MODULE]?.afflictionId === value.id && item.type === 'effect');
    checks.push(assertion('restricted effect tracks unhealable damage', effect?.flags?.[MODULE]?.tracksUnhealableDamage === true));
    await m.service.AfflictionService.adjustStageManually(target, value, -5, actor);
    const clamped = m.store.getAffliction(target, value.id);
    checks.push(assertion('recovery cannot cross configured stage floor', clamped?.currentStage === 1, clamped));
    const failed = await m.counteract.CounteractService.handleCounteractResult(target, clamped, 0, 4, 'failure', actor);
    checks.push(assertion('insufficient counteract leaves restriction active', failed === false && m.recovery.RecoveryRestrictionService.isActive(m.store.getAffliction(target, value.id))));
    const cleared = await m.counteract.CounteractService.handleCounteractResult(target, m.store.getAffliction(target, value.id), 4, 1, 'success', actor);
    checks.push(assertion('successful remove-curse style counteract unlocks recovery without curing', cleared === true && m.store.getAffliction(target, value.id)?.recoveryRestrictionResolved === true));
  } else if (name === 'feat-adjustments') {
    const featActor = { items: ['fast-recovery', 'blowgun-poisoner', 'pernicious-poison', 'sticky-poison', 'double-poison'].map(slug => ({ type: 'feat', system: { slug } })) };
    checks.push(assertion('all supported poison/recovery feats are detected', ['fast-recovery', 'blowgun-poisoner', 'pernicious-poison', 'sticky-poison', 'double-poison'].every(slug => m.feats.FeatsService.hasFeat(featActor, slug))));
    checks.push(assertion('Fast Recovery and Blowgun Poisoner modify degrees correctly', m.feats.FeatsService.getFastRecoveryStageChange('success', false) === -2 && m.feats.FeatsService.degradeDegree('success') === 'failure'));
  } else if (name === 'vishkanya-venom') {
    const vishActor = { classDC: { dc: { value: 27 } }, items: [{ type: 'feat', system: { slug: 'moderate-enhance-venom' } }, { type: 'feat', system: { slug: 'vicious-venom' } }, { type: 'feat', system: { slug: 'debilitating-venom' } }] };
    const venom = m.vishkanya.VishkanyaService.buildVenomAfflictionData(vishActor);
    const stumbling = m.vishkanya.VishkanyaService.applyDebilitation(venom, 'stumbling');
    checks.push(assertion('Vishkanya tier, DC, and virulent trait derive from actor', venom.name === 'Moderate Vishkanyan Venom' && venom.dc === 27 && venom.isVirulent === true, venom));
    checks.push(assertion('Debilitating Venom adds off-guard at later stages', stumbling.stages[1].conditions.some(condition => condition.name === 'off-guard')));
  } else if (name === 'toxicologist-infused-poison') {
    const alchemist = await featCharacter(fixture, { feats: ['toxicologist'], name: 'Toxicologist' });
    await actor.createEmbeddedDocuments('Item', [{ name: 'QA Poison Immunity', type: 'effect', system: { duration: { value: -1, unit: 'unlimited' }, rules: [{ key: 'Immunity', type: 'poison' }] }, flags: { [MODULE]: { [MARKER]: fixture.runId } } }]);
    await waitFor(() => actor.system.attributes.immunities.some(entry => entry.type === 'poison'), 'poison immunity');
    const infused = { ...affliction(), name: 'QA Infused Venom', traits: ['alchemical', 'infused', 'injury', 'poison'], stages: [featStage(1, '2d6'), featStage(2, '3d6')], originActorId: alchemist.actor.id, originActorUuid: alchemist.actor.uuid };
    delete infused.id; delete infused.currentStage;
    await m.service.AfflictionService.promptInitialSave(target, { ...infused });
    const stored = Object.values(m.store.getAfflictions(target)).find(entry => entry.name === 'QA Infused Venom');
    checks.push(assertion('infused poison from a real Toxicologist bypasses PF2e poison immunity', !!stored, Object.values(m.store.getAfflictions(target)).map(entry => entry.name)));
    checks.push(assertion('poison-immune target takes acid instead', stored?.toxicologistDamage === 'acid' && m.recovery.RecoveryRestrictionService.buildDamageLink('2d6', 'poison', stored).includes('[acid]'), stored?.toxicologistDamage));
    const plain = { ...infused, name: 'QA Plain Venom', traits: ['alchemical', 'injury', 'poison'] };
    await m.service.AfflictionService.promptInitialSave(target, plain);
    checks.push(assertion('non-infused poison still respects immunity', !Object.values(m.store.getAfflictions(target)).some(entry => entry.name === 'QA Plain Venom')));
  } else if (name === 'pf2e-save-outcome') {
    await actor.createEmbeddedDocuments('Item', [{
      name: 'QA Poison Hardiness', type: 'effect', flags: { [MODULE]: { [MARKER]: fixture.runId } },
      system: { duration: { value: -1, unit: 'unlimited' }, rules: [{ key: 'AdjustDegreeOfSuccess', selector: 'saving-throw', predicate: ['item:trait:poison'], adjustment: { success: 'one-degree-better', failure: 'one-degree-better', criticalFailure: 'one-degree-better' } }] },
    }]);
    const value = affliction();
    const dc = 15;
    const message = await rollSave(actor, dc, { extraRollOptions: ['poison', 'item:trait:poison'] });
    const roll = message.rolls[0];
    const raw = m.service.AfflictionService.calculateDegreeOfSuccess(roll.total, dc, m.service.AfflictionService.getDieValue(message));
    const systemDegree = m.service.AfflictionService.getSystemSaveDegree(message, dc);
    const expected = raw === 'criticalSuccess' ? 'criticalSuccess' : m.service.AfflictionService.upgradeDegree(raw);
    checks.push(assertion('PF2e applied the poison save adjustment through our roll options', systemDegree === expected, { total: roll.total, raw, systemDegree }));
    checks.push(assertion('affliction save handling uses the PF2e outcome', m.service.AfflictionService.calculateAfflictionDegreeResult(roll.total, dc, null, actor, value, systemDegree).degree === systemDegree));
    checks.push(assertion('outcome for a different DC is ignored', m.service.AfflictionService.getSystemSaveDegree(message, dc + 1) === null));
  } else if (name === 'improved-recovery-heritage') {
    const dwarf = await featCharacter(fixture, { heritage: 'strong-blooded-dwarf', name: 'Dwarf' });
    const value = { ...affliction(), currentStage: 3, stages: [stage(1), stage(2), stage(3)] };
    await storeAffliction(m.store, dwarf, value);
    checks.push(assertion('real heritage item is detected for poisons only', m.feats.FeatsService.getImprovedRecoveryFeature(dwarf.actor, value)?.slug === 'strong-blooded-dwarf' && !m.feats.FeatsService.getImprovedRecoveryFeature(dwarf.actor, { ...value, type: 'disease', traits: ['disease'] })));
    await m.service.AfflictionService.handleStageSave(dwarf, m.store.getAffliction(dwarf, value.id), 25, 20, false, 10, dwarf.actor);
    checks.push(assertion('successful save drops a poison by two stages', m.store.getAffliction(dwarf, value.id)?.currentStage === 1, m.store.getAffliction(dwarf, value.id)?.currentStage));
  } else if (name === 'robust-recovery-treatment') {
    const healer = await featCharacter(fixture, { feats: ['robust-recovery'], name: 'Healer' });
    const value = await storeAffliction(m.store, target, { ...affliction(), currentStage: 2 });
    await m.treatment.TreatmentService.handleTreatmentResult(target, value, 22, 20, actor, healer.actor);
    const saved = m.store.getAffliction(target, value.id);
    checks.push(assertion('Robust Recovery healer turns a successful treatment into +4', saved?.treatmentBonus === 4 && saved.treatmentRobustRecovery === true, saved));
    checks.push(assertion('next successful save becomes a critical success', m.service.AfflictionService.calculateAfflictionDegreeResult(22, 20, 10, actor, saved).degree === 'criticalSuccess'));
    const effect = actor.items.find(item => item.flags?.[MODULE]?.isTreatmentBonus);
    checks.push(assertion('treatment effect carries the +4 circumstance bonus', effect?.system?.rules?.[0]?.value === 4, effect?.system?.rules));
  } else if (name === 'feat-exposure-modifiers') {
    const { FeatModifierService } = await import('../../scripts/services/FeatModifierService.js');
    await actor.increaseCondition('off-guard');
    await waitFor(() => actor.hasCondition('off-guard'), 'off-guard condition');
    const poisoner = { classDC: { dc: { value: 30 } }, items: ['potent-poisoner', 'deadly-poison-weapon', 'pinpoint-poisoner', 'tenacious-toxins'].map(slug => ({ type: 'feat', system: { slug } })) };
    const base = { ...affliction(), traits: ['alchemical', 'injury', 'poison'], dc: 20, maxDuration: { value: 6, unit: 'round' }, stages: [featStage(1, '2d6'), featStage(2, '3d6')], deliveredByStrike: true };
    const result = FeatModifierService.applyExposureFeats(base, { sourceActor: poisoner, targetActor: actor });
    checks.push(assertion('Potent Poisoner and Deadly Poison Weapon raise DC up to class DC', result.dc === 26, result.dc));
    checks.push(assertion('Pinpoint Poisoner reads the real PF2e off-guard condition', result.saveModifiers?.some(entry => entry.value === -2)));
    checks.push(assertion('Tenacious Toxins extends maximum duration', result.maxDuration.value === 7, result.maxDuration));
    const shisk = await featCharacter(fixture, { heritage: 'stronggut-shisk', name: 'Shisk' });
    const slowed = FeatModifierService.applyExposureFeats({ ...base, onset: { value: 1, unit: 'minute' }, stages: [{ ...featStage(1, '1d6'), duration: { value: 2, unit: 'hour' } }] }, { targetActor: shisk.actor });
    checks.push(assertion('Stronggut Shisk heritage lengthens onset and stages', slowed.onset.value === 15 && slowed.onset.unit === 'round' && slowed.stages[0].duration.value === 3, { onset: slowed.onset, duration: slowed.stages[0].duration }));
    const { buildSaveRollModifiers } = await import('../../scripts/handlers/saveButtons.js');
    const message = await rollSave(actor, 20, { modifiers: buildSaveRollModifiers(result) });
    const modifiers = message.flags?.pf2e?.modifiers ?? [];
    checks.push(assertion('stored save modifier reaches a real PF2e save roll', modifiers.some(entry => entry.modifier === -2 && entry.type === 'circumstance' && entry.enabled !== false), modifiers.map(entry => [entry.label, entry.modifier])));
  } else if (name === 'feat-save-notes') {
    const drinker = await featCharacter(fixture, { feats: ['poison-drinker'], name: 'Drinker' });
    const spray = { ...affliction(), needsInitialSave: true, currentStage: -1, sprayOnFailedInitialSave: true, combustiblePoison: true, traits: ['alchemical', 'infused', 'injury', 'poison'] };
    await storeAffliction(m.store, target, spray);
    await m.service.AfflictionService.handleInitialSave(target, m.store.getAffliction(target, spray.id), 5, 20, 5, actor);
    await waitFor(() => document.querySelector('#chat .affliction-spray-exposure, #chat-log .affliction-spray-exposure'), 'spray button render', 8000);
    const contents = game.messages.contents.slice(-6).map(message => message.content).join('\n');
    checks.push(assertion('combustible note offers persistent fire', contents.includes('1d4[persistent,fire]')));
    const sourceToken = canvas.tokens.get(fixture.source);
    sourceToken.setTarget(true, { releaseOthers: true });
    const button = [...document.querySelectorAll('.affliction-spray-exposure')].at(-1);
    button.click();
    await waitFor(() => Object.keys(m.store.getAfflictions(sourceToken)).length > 0, 'spray exposure', 8000);
    checks.push(assertion('clicking the spray button exposes the targeted creature', Object.values(m.store.getAfflictions(sourceToken))[0]?.needsInitialSave === true));
    sourceToken.setTarget(false);
    const drink = { ...affliction(), needsInitialSave: true, currentStage: -1, level: 5 };
    await storeAffliction(m.store, drinker, drink);
    await m.service.AfflictionService.handleInitialSave(drinker, m.store.getAffliction(drinker, drink.id), 40, 20, 15, drinker.actor);
    checks.push(assertion('Poison Drinker posts a healing link on a critical success', game.messages.contents.slice(-3).some(message => message.content.includes('5[healing]'))));
  } else if (name === 'special-feat-saves') {
    const holder = await featCharacter(fixture, { feats: ['coral-detoxification', 'purge-system'], name: 'Athamaru' });
    const value = await storeAffliction(m.store, holder, { ...affliction(), currentStage: 2 });
    await game.modules.get(MODULE).api.openManager({ filterTokenId: holder.id });
    await waitFor(() => document.querySelector('#pf2e-afflictioner-manager [data-action="specialSave"]'), 'feat actions button');
    checks.push(assertion('manager shows the feat actions button for a qualifying actor', !!document.querySelector('#pf2e-afflictioner-manager [data-action="specialSave"]')));
    await m.manager.AfflictionManager.currentInstance?.close();
    await m.service.AfflictionService.startSpecialSave(holder, m.store.getAffliction(holder, value.id), 'coral-detoxification', holder.actor);
    checks.push(assertion('Coral Detoxification stores +2 for the next save', m.store.getAffliction(holder, value.id)?.saveModifiers?.[0]?.value === 2));
    await m.service.AfflictionService.startSpecialSave(holder, m.store.getAffliction(holder, value.id), 'virulent-strike', holder.actor);
    await m.service.AfflictionService.handleStageSave(holder, m.store.getAffliction(holder, value.id), 25, 20, false, 10, holder.actor);
    const afterStrike = m.store.getAffliction(holder, value.id);
    checks.push(assertion('Virulent Strike save success keeps the stage and clears the rule', afterStrike?.currentStage === 2 && !afterStrike.pendingSaveRule && afterStrike.saveModifiers?.length === 0, afterStrike));
    await m.service.AfflictionService.startSpecialSave(holder, afterStrike, 'purge-system', holder.actor);
    checks.push(assertion('Purge System lowers the stage by one', m.store.getAffliction(holder, value.id)?.currentStage === 1));
  } else if (name === 'stronger-debilitating-venom') {
    const vishActor = { classDC: { dc: { value: 27 } }, items: [{ type: 'feat', system: { slug: 'greater-enhance-venom' } }, { type: 'feat', system: { slug: 'debilitating-venom' } }, { type: 'feat', system: { slug: 'stronger-debilitating-venom' } }] };
    checks.push(assertion('Stronger Debilitating Venom is detected', m.vishkanya.VishkanyaService.hasStrongerDebilitatingVenom(vishActor)));
    const venom = m.vishkanya.VishkanyaService.buildVenomAfflictionData(vishActor);
    const devitalized = m.vishkanya.VishkanyaService.applyDebilitation(venom, 'devitalizing');
    checks.push(assertion('Devitalizing removes 3 dice and adds drained', devitalized.stages[2].damage[0]?.formula === '8d6' && devitalized.stages[2].conditions.some(c => c.name === 'drained' && c.value === 2), devitalized.stages[2]));
    const pending = m.weapon.WeaponCoatingService._promptDebilitation({ stronger: true });
    await waitFor(() => document.querySelectorAll('.dv-grid .dv-card').length > 0, 'debilitation dialog');
    checks.push(assertion('debilitation dialog shows all seven options', document.querySelectorAll('.dv-grid .dv-card').length === 7));
    document.querySelector('.dv-card[data-value="weakening"]').click();
    checks.push(assertion('picking a stronger option returns it', await pending === 'weakening'));
  } else if (name === 'weapon-coating-lifecycle') {
    const [weapon] = await actor.createEmbeddedDocuments('Item', [{ name: 'QA Blade', type: 'weapon', system: { category: 'martial', group: 'sword', baseItem: 'longsword', damage: { dice: 1, die: 'd8', damageType: 'slashing' }, traits: { value: [] } } }]);
    await m.coating.addCoating(target, weapon.id, { poisonName: 'QA Venom', weaponName: weapon.name, expirationMode: '1-minute', appliedTimestamp: game.time.worldTime });
    checks.push(assertion('coating stored on linked actor', m.coating.getCoating(actor, weapon.id)?.poisonName === 'QA Venom'));
    await m.coating.updateCoating(target, weapon.id, { uses: 1 });
    checks.push(assertion('coating update persists', m.coating.getCoating(target, weapon.id)?.uses === 1));
    await m.coating.removeCoating(target, weapon.id);
    checks.push(assertion('coating removal clears flag', !m.coating.getCoating(actor, weapon.id)));
  } else if (name === 'weapon-injection-lifecycle') {
    const weaponId = foundry.utils.randomID();
    await m.coating.addInjection(target, weaponId, { poisonName: 'QA Injected Venom', weaponName: 'QA Injection Weapon' });
    checks.push(assertion('injection stored', m.coating.getInjection(actor, weaponId)?.poisonName === 'QA Injected Venom'));
    await m.coating.updateInjection(target, weaponId, { uses: 2 });
    checks.push(assertion('injection update persists', m.coating.getInjection(target, weaponId)?.uses === 2));
    await m.coating.removeInjection(target, weaponId);
    checks.push(assertion('injection removal clears flag', !m.coating.getInjection(actor, weaponId)));
  } else if (name === 'double-poison-and-weapon-rules') {
    const first = { ...affliction('poison-one'), name: 'First Poison', dc: 24, isVirulent: true, level: 1 };
    const second = { ...affliction('poison-two'), name: 'Second Poison', dc: 20, isVirulent: false, level: 2, saveType: 'reflex' };
    const merged = m.weapon.WeaponCoatingService._buildDoublePoisonAffliction(first, second, 'fortitude');
    const fakeActor = { system: { details: { level: { value: 5 } } }, items: [{ type: 'feat', system: { slug: 'double-poison' } }] };
    checks.push(assertion('Double Poison uses lower DC/stage count and both-virulent rule', merged.doublePoison && merged.dc === 20 && merged.stages.length === 2 && merged.isVirulent === false, merged));
    checks.push(assertion('Double Poison level gate is enforced', m.weapon.WeaponCoatingService._shouldOfferDoublePoison(fakeActor, { afflictionData: first }, second) === true));
    checks.push(assertion('injection trait Sets and NPC damage rolls normalize', m.weapon.WeaponCoatingService._isInjectionWeapon({ traits: new Set(['injection']) }) && m.weapon.WeaponCoatingService._getWeaponDamageType({ system: { damageRolls: { one: { damageType: 'piercing' } } } }) === 'piercing'));
  } else if (name === 'unlinked-token-storage') {
    const [unlinkedDoc] = await canvas.scene.createEmbeddedDocuments('Token', [{ name: 'QA Unlinked', actorId: actor.id, actorLink: false, x: 1200, y: 500, flags: { [MODULE]: { [MARKER]: fixture.runId } } }]);
    const unlinked = canvas.tokens.get(unlinkedDoc.id);
    const weaponId = foundry.utils.randomID();
    await m.coating.addCoating(unlinked, weaponId, { poisonName: 'Synthetic Venom' });
    await m.coating.addInjection(unlinked, weaponId, { poisonName: 'Synthetic Injection' });
    checks.push(assertion('unlinked coating stores on token document', unlinked.document.getFlag(MODULE, 'weaponCoatings')?.[weaponId]?.poisonName === 'Synthetic Venom'));
    checks.push(assertion('unlinked injection stores separately on token document', unlinked.document.getFlag(MODULE, 'weaponInjections')?.[weaponId]?.poisonName === 'Synthetic Injection'));
    checks.push(assertion('unlinked storage does not mutate base actor', !m.coating.getCoating(actor, weaponId) && !m.coating.getInjection(actor, weaponId)));
  } else if (name === 'combat-scheduled-save') {
    const value = { ...affliction(), nextSaveRound: 1, nextSaveInitiative: 10 };
    await storeAffliction(m.store, target, value);
    const combat = await globalThis.Combat.create({ scene: fixture.scene, active: false, flags: { [MODULE]: { [MARKER]: fixture.runId } }, combatants: [{ tokenId: target.id, sceneId: fixture.scene, initiative: 10 }] });
    await combat.update({ round: 1, turn: 0 });
    const before = game.messages.size;
    await m.service.AfflictionService.checkForScheduledSaves(target, combat, combat.combatant);
    checks.push(assertion('scheduled save produces live chat prompt', game.messages.size > before));
    await combat.delete();
  } else if (name === 'off-scene-actor-storage') {
    const value = affliction();
    await m.store.addAfflictionForActor(actor, value);
    checks.push(assertion('actor storage works without token lookup', m.store.getAfflictionForActor(actor, value.id)?.name === value.name));
    checks.push(assertion('linked token reads actor storage', m.store.getAffliction(target, value.id)?.name === value.name));
    await m.store.removeAfflictionForActor(actor, value.id);
  } else if (name === 'chat-message-privacy') {
    const value = affliction();
    await m.chat.AfflictionChatService.promptInitialSave(target, value, value, value.id);
    const message = game.messages.contents.findLast(candidate => candidate.content.includes(`data-affliction-id="${value.id}"`));
    const playerOwners = game.users.filter(user => !user.isGM && actor.testUserPermission(user, 'OWNER')).map(user => user.id);
    checks.push(assertion('save prompt is whispered', message?.whisper?.length > 0));
    checks.push(assertion('save prompt targets owning player', playerOwners.every(id => message.whisper.includes(id)), { whisper: message?.whisper, playerOwners }));
  } else if (name === 'manager-gm-ui') {
    await game.modules.get(MODULE).api.openManager({ filterTokenId: target.id });
    await waitFor(() => document.querySelector('#pf2e-afflictioner-manager'), 'manager render');
    const app = m.manager.AfflictionManager.currentInstance;
    checks.push(assertion('GM manager instance opens', !!app));
    checks.push(assertion('GM manager renders native ApplicationV2 window', !!document.querySelector('#pf2e-afflictioner-manager')));
    await app?.close();
  } else if (name === 'token-indicator') {
    const value = await storeAffliction(m.store, target);
    await m.visual.VisualService.addAfflictionIndicator(target);
    await waitFor(() => target.document.getFlag(MODULE, 'hasAffliction') === true, 'indicator flag');
    checks.push(assertion('indicator flag reaches token document', target.document.getFlag(MODULE, 'hasAffliction') === true));
    checks.push(assertion('indicator tint persists', target.document._source.texture.tint === '#ffdfdf', {
      tint: target.document.texture.tint,
      sourceTint: target.document._source.texture.tint,
    }));
    await m.store.removeAffliction(target, value.id);
    await m.visual.VisualService.removeAfflictionIndicator(target);
    await waitFor(() => !target.document.getFlag(MODULE, 'hasAffliction'), 'indicator removal');
    checks.push(assertion('indicator flag clears', !target.document.getFlag(MODULE, 'hasAffliction')));
    checks.push(assertion('indicator tint clears', target.document._source.texture.tint !== '#ffdfdf', {
      sourceTint: target.document._source.texture.tint,
    }));
  } else if (name === 'monitor-ui') {
    await storeAffliction(m.store, target);
    const monitor = m.monitor.AfflictionMonitorIndicator.getInstance();
    monitor.refresh();
    const indicator = document.querySelector('.pf2e-afflictioner-monitor');
    checks.push(assertion('monitor renders live afflicted count', indicator?.classList.contains('pf2e-afflictioner-monitor--visible') && indicator.querySelector('.indicator-badge')?.textContent === '1'));
    indicator.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await waitFor(() => document.querySelector('.pf2e-afflictioner-popover'), 'monitor popover');
    checks.push(assertion('monitor click opens interactive affliction popover', document.querySelector('.pf2e-afflictioner-popover')?.textContent.includes('QA Affliction')));
    document.querySelector('.pf2e-afflictioner-popover .popover-close')?.click();
    checks.push(assertion('monitor close control dismisses popover', !document.querySelector('.pf2e-afflictioner-popover')));
  } else if (name === 'region-behavior-registration') {
    const type = m.region.AFFLICTION_REGION_BEHAVIOR_TYPE;
    const model = CONFIG.RegionBehavior.dataModels[type];
    checks.push(assertion('region behavior registered at init', model === m.region.AfflictionRegionBehavior));
    const parsed = m.region.parseAfflictionUuids('Item.one, Item.two\nItem.one');
    checks.push(assertion('region UUID list is normalized and deduplicated', parsed.length === 2 && parsed[0] === 'Item.one'));
    checks.push(assertion('terrain consumer contract exists', typeof model.prototype._getTerrainEffects === 'function'));
  } else if (name === 'region-runtime-application') {
    const [item] = await actor.createEmbeddedDocuments('Item', [{
      name: 'QA Region Venom', type: 'consumable',
      system: { save: { dc: 21, statistic: 'fortitude' }, traits: { value: ['poison'] }, description: { value: '<p><strong>Stage 1</strong> 1d6 poison damage (1 round)</p>' } },
    }]);
    const proto = m.region.AfflictionRegionBehavior.prototype;
    const behavior = { afflictionUuids: item.uuid, skipExistingAfflictionUuids: '', _parseAfflictionItem: proto._parseAfflictionItem, _tokenHasAffliction: proto._tokenHasAffliction };
    await proto._applyConfiguredAfflictions.call(behavior, target);
    checks.push(assertion('region entry applies configured native affliction item', m.service.AfflictionService.findExistingAffliction(target, item.name)?.needsInitialSave === true));
    behavior.skipExistingAfflictionUuids = item.uuid;
    const count = Object.keys(m.store.getAfflictions(target)).length;
    await proto._applyConfiguredAfflictions.call(behavior, target);
    checks.push(assertion('region skip-existing prevents duplicate exposure', Object.keys(m.store.getAfflictions(target)).length === count));
  } else if (name === 'settings-persistence') {
    const original = game.settings.get(MODULE, 'anonymizeSaveMessages');
    await game.settings.set(MODULE, 'anonymizeSaveMessages', !original);
    checks.push(assertion('world setting persists through Foundry storage', game.settings.get(MODULE, 'anonymizeSaveMessages') === !original));
    await game.settings.set(MODULE, 'anonymizeSaveMessages', original);
    checks.push(assertion('world setting restores', game.settings.get(MODULE, 'anonymizeSaveMessages') === original));
  } else if (name === 'visioner-stage-integration') {
    const visioner = game.modules.get('pf2e-visioner');
    checks.push(assertion('Visioner is active in shared QA config', visioner?.active === true));
    const integration = await import('../../scripts/services/VisionerIntegrationService.js');
    checks.push(assertion('Afflictioner binds Visioner public API', integration.VisionerIntegrationService.getApi() === visioner.api));
    const value = await storeAffliction(m.store, target);
    await integration.VisionerIntegrationService.applyStageVisibility(target, value, { number: 1, visibilityEffects: [{ sense: 'darkvision', only: true, state: 'concealed' }] });
    checks.push(assertion('stage integration persists safe tracking state', Object.hasOwn(m.store.getAffliction(target, value.id), 'visionerVisibility')));
    await integration.VisionerIntegrationService.removeStageVisibility(target, m.store.getAffliction(target, value.id));
  } else if (name === 'optional-integration-contracts') {
    const available = m.storyframe.StoryframeIntegrationService.isAvailable();
    const sent = await m.storyframe.StoryframeIntegrationService.sendSaveRequest(target, affliction(), 'initial');
    checks.push(assertion('Storyframe integration reports actual availability', available === (game.settings.get(MODULE, 'integrateWithStoryframe') && game.modules.get('storyframe')?.active === true && !!game.storyframe?.socketManager)));
    checks.push(assertion('unavailable Storyframe integration fails closed', available || sent === false));
    checks.push(assertion('socketlib authority API initialized', !!game.modules.get('socketlib')?.active && !!globalThis.socketlib));
  } else if (name === 'foundry14-pf2e-compatibility') {
    checks.push(assertion('Foundry generation 14 is live', game.release.generation === 14, game.release));
    checks.push(assertion('PF2e system is live', game.system.id === 'pf2e', game.system));
    checks.push(assertion('required modules are active', ['lib-wrapper', 'socketlib'].every(id => game.modules.get(id)?.active)));
    checks.push(assertion('Afflictioner metadata matches runtime', game.modules.get(MODULE)?.version && game.modules.get(MODULE).active));
  } else {
    throw Error(`Unknown live workflow: ${name}`);
  }
  return checks;
}

export async function runCase({ name, fixture }) {
  if (!game.user.isGM) throw Error('GM workflow required');
  try {
    return await runWorkflow(name, fixture);
  } finally {
    const baseline = new Set(fixture.messages ?? []);
    for (const message of game.messages) {
      if (!baseline.has(message.id) && !owned(message, fixture.runId)) await message.setFlag(MODULE, MARKER, fixture.runId);
    }
  }
}

export async function configurePlayerAccess(value) {
  if (!game.user.isGM || typeof value !== 'boolean') throw Error('GM boolean setting required');
  await game.settings.set(MODULE, 'allowPlayerWeaponCoatingAccess', value);
  return game.settings.get(MODULE, 'allowPlayerWeaponCoatingAccess');
}

export async function runPlayerCase({ name, fixture, allowed }) {
  await view(fixture);
  const { target } = documents(fixture);
  if (name !== 'player-coating-access') throw Error(`Unknown player workflow: ${name}`);
  if (allowed) await waitFor(() => target.actor?.isOwner === true, 'player actor ownership', 15000);
  const { AfflictionManager } = await import('../../scripts/managers/AfflictionManager.js');
  const actual = AfflictionManager.canOpenLimitedCoatingView({ filterTokenId: target.id });
  return [{ label: allowed ? 'owning player is allowed when enabled' : 'player is denied when disabled', status: actual === allowed ? 'passed' : 'failed' }];
}

export async function cleanup(runId) {
  if (!game.user.isGM) throw Error('GM cleanup required');
  globalThis.__afflictionerLiveRun = null;
  const combats = game.combats.filter(document => owned(document, runId));
  const scenes = game.scenes.filter(document => owned(document, runId));
  const actors = game.actors.filter(document => owned(document, runId));
  const messages = game.messages.filter(document => owned(document, runId));
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    if (app.id?.startsWith('pf2e-afflictioner')) await app.close();
  }
  if (combats.length) await globalThis.Combat.deleteDocuments(combats.map(document => document.id));
  if (messages.length) await ChatMessage.deleteDocuments(messages.map(document => document.id));
  if (scenes.length) await globalThis.Scene.deleteDocuments(scenes.map(document => document.id));
  if (actors.length) await globalThis.Actor.deleteDocuments(actors.map(document => document.id));
}

export function leftovers(runId) {
  return {
    combats: game.combats.filter(document => owned(document, runId)).map(document => document.id),
    scenes: game.scenes.filter(document => owned(document, runId)).map(document => document.id),
    actors: game.actors.filter(document => owned(document, runId)).map(document => document.id),
    messages: game.messages.filter(document => owned(document, runId)).map(document => document.id),
  };
}
