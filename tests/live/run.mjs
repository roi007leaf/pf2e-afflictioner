import { chromium } from 'playwright';
import { input, password, confirm } from '@inquirer/prompts';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fullCases, smokeCases } from './cases.mjs';
import { coverageFor, validateCases } from './coverage.mjs';
import { assessRequirements } from './requirements.mjs';
import { sourceFingerprint } from './evidence.mjs';
import { loadLocalDefaults, promptAccount } from './local-defaults.mjs';
import { assertQaWorld, DEFAULT_QA_WORLD } from './world-guard.mjs';

const directory = path.resolve('artifacts/live');
const journalPath = path.join(directory, 'recovery.json');
const lockPath = path.join(directory, 'runner.lock');
const abort = new AbortController();
const expectedWorld = process.env.VISIONER_DISPOSABLE_WORLD ?? DEFAULT_QA_WORLD;
const report = { started: new Date().toISOString(), cases: [], startupErrors: [], cleanup: 'not-needed' };
const credentials = [];
let browser;
let gm;
let player;
let journal;
let evidenceDirectory = directory;
let locked = false;
let localDefaults = {};
process.once('SIGINT', () => abort.abort());
process.once('SIGTERM', () => abort.abort());

async function atomicJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

function safeError(error) {
  let text = String(error?.stack ?? error?.message ?? error);
  for (const secret of credentials.filter(Boolean)) text = text.split(secret).join('[redacted]');
  return text;
}

async function rpc(page, method, data) {
  return page.evaluate(async ({ method, data }) => {
    const api = await import('/modules/pf2e-afflictioner/tests/live/world.js');
    if (typeof api[method] !== 'function') throw Error(`Unknown live RPC: ${method}`);
    return api[method](data);
  }, { method, data });
}

async function account(role) {
  const result = await promptAccount(role, localDefaults, process.env, { input, password, confirm }, { signal: abort.signal });
  credentials.push(result.password);
  if (role === 'gm' && !result.password) throw Error('GM account requires password');
  return result;
}

async function login(context, url, accountValue, isGM) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${url}/join`);
  await page.locator('select[name="userid"], input[name="username"]').first().waitFor();
  assertQaWorld(await page.evaluate(() => globalThis.game?.world?.id), expectedWorld);
  const select = page.locator('select[name="userid"]');
  if (await select.count()) {
    const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({ label: node.textContent.trim(), value: node.value })));
    const match = options.find(option => option.label.toLowerCase() === accountValue.username.trim().toLowerCase());
    if (!match) throw Error(`${isGM ? 'GM' : 'player'} account not found`);
    await select.selectOption(match.value);
  } else {
    await page.locator('input[name="username"]').fill(accountValue.username);
  }
  await page.locator('input[name="password"]').fill(accountValue.password);
  await page.locator('button[name="join"]').click();
  await page.waitForFunction(() => globalThis.game?.ready && globalThis.canvas?.ready, null, { timeout: 90000 });
  const state = await rpc(page, 'preflight');
  assertQaWorld(state.world, expectedWorld);
  if (state.isGM !== isGM) throw Error(`Wrong account role for ${isGM ? 'GM' : 'player'} session`);
  if (!state.moduleActive) throw Error('PF2e Afflictioner is not active');
  return { page, state };
}

async function restore(record) {
  const failures = [];
  try { await rpc(gm.page, 'restoreSettings', record.settings); } catch (error) { failures.push(error); }
  for (const [session, saved] of [[gm, record.gm], [player, record.player]]) {
    if (!session || !saved?.scene) continue;
    try {
      await session.page.evaluate(async sceneId => {
        const scene = game.scenes.get(sceneId);
        if (scene) await scene.view();
      }, saved.scene);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'Could not restore QA state');
}

async function cleanup(record) {
  report.cleanup = 'running';
  const failures = [];
  try { await restore(record); } catch (error) { failures.push(error); }
  try { await rpc(gm.page, 'cleanup', record.runId); } catch (error) { failures.push(error); }
  try {
    const remaining = await rpc(gm.page, 'leftovers', record.runId);
    if (Object.values(remaining).some(ids => ids.length)) throw Error(`Live documents remain: ${JSON.stringify(remaining)}`);
  } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'Live cleanup incomplete');
  await unlink(journalPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  report.cleanup = 'complete';
}

async function saveReport() {
  report.functionalCoverage = assessRequirements(fullCases, report.cases);
  report.coverage = coverageFor(fullCases, report.cases);
  report.shippingReady = report.functionalCoverage.complete && !report.error && !report.startupErrors.length &&
    report.cleanup === 'complete' && !report.sourceChangedDuringRun && !report.coverage.failed.length && !report.coverage.unrun.length;
  if (locked) await atomicJson(path.join(directory, 'report.json'), report);
  if (locked && evidenceDirectory !== directory) await atomicJson(path.join(evidenceDirectory, 'report.json'), report);
}

async function acquireLock() {
  await mkdir(directory, { recursive: true });
  let handle;
  try { handle = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(lockPath, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw Error('Invalid live runner lock; inspect it manually');
    try { process.kill(pid, 0); throw Error(`Live suite already running (PID ${pid})`); }
    catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
    await unlink(lockPath);
    handle = await open(lockPath, 'wx');
  }
  await handle.writeFile(String(process.pid));
  await handle.close();
  locked = true;
}

async function run() {
  validateCases(fullCases);
  if (process.argv.includes('--list')) {
    console.table(fullCases.map(testCase => ({ case: testCase.name, area: testCase.area, smoke: testCase.smoke, mode: 'automated' })));
    return;
  }
  if (process.argv.includes('--coverage')) {
    console.log(JSON.stringify(assessRequirements(fullCases, []), null, 2));
    return;
  }
  const catalog = process.argv.includes('--full') ? fullCases : smokeCases;
  const requested = process.env.AFFLICTIONER_LIVE_CASE?.split(',').map(value => value.trim()).filter(Boolean);
  const unknown = requested?.filter(name => !catalog.some(testCase => testCase.name === name)) ?? [];
  if (unknown.length && !process.argv.includes('--cleanup-only')) throw Error(`Unknown live cases (or --full missing): ${unknown.join(', ')}`);
  const cases = requested ? catalog.filter(testCase => requested.includes(testCase.name)) : catalog;
  if (!cases.length && !process.argv.includes('--cleanup-only')) throw Error('No live cases selected');

  await acquireLock();
  localDefaults = await loadLocalDefaults();
  const url = (process.env.VISIONER_FOUNDRY_URL || await input({ message: 'Foundry URL:', default: localDefaults.url || 'https://localhost:30000' }, { signal: abort.signal })).replace(/\/$/, '');
  const gmAccount = await account('gm');
  const playerAccount = await account('player');
  browser = await chromium.launch({ headless: process.argv.includes('--headless'), channel: process.env.VISIONER_BROWSER_CHANNEL || undefined });
  gm = await login(await browser.newContext({ ignoreHTTPSErrors: true }), url, gmAccount, true);
  player = await login(await browser.newContext({ ignoreHTTPSErrors: true }), url, playerAccount, false);
  if (gm.state.world !== player.state.world) throw Error('GM and player joined different worlds');
  if (gm.state.foundry !== 14 || gm.state.system !== 'pf2e') throw Error(`Requires Foundry 14/PF2e; got ${gm.state.foundry}/${gm.state.system}`);

  const pending = await readFile(journalPath, 'utf8').then(JSON.parse).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (pending) {
    if (pending.url !== url || pending.world !== gm.state.world || pending.gm.user !== gm.state.user || pending.player.user !== player.state.user) {
      throw Error('Recovery journal requires original URL, world, GM, and player');
    }
    journal = pending;
    await cleanup(journal);
    if (process.argv.includes('--cleanup-only')) return;
  } else if (process.argv.includes('--cleanup-only')) {
    report.cleanup = 'complete';
    return;
  }

  report.runId = randomUUID();
  report.world = gm.state.world;
  report.foundry = gm.state.foundry;
  report.system = { id: gm.state.system, version: gm.state.systemVersion };
  report.moduleVersion = gm.state.moduleVersion;
  const manifest = JSON.parse(await readFile('module.json', 'utf8'));
  if (report.moduleVersion !== manifest.version) {
    throw Error(`Foundry loaded Afflictioner ${report.moduleVersion}; checkout manifest is ${manifest.version}. Restart QA world.`);
  }
  report.sourceFingerprint = await sourceFingerprint();
  evidenceDirectory = path.join(directory, report.runId);
  await mkdir(evidenceDirectory, { recursive: true });
  journal = {
    runId: report.runId, url, world: gm.state.world,
    gm: { user: gm.state.user, scene: gm.state.scene },
    player: { user: player.state.user, scene: player.state.scene },
    settings: await rpc(gm.page, 'settingsSnapshot'),
  };
  await atomicJson(journalPath, journal);

  for (const testCase of cases) {
    if (abort.signal.aborted) throw Error('Live suite cancelled');
    const result = { name: testCase.name, area: testCase.area, mode: 'automated', status: 'running', steps: [] };
    report.cases.push(result);
    let fixture;
    const errors = [];
    const onPageError = error => errors.push(safeError(error));
    const onConsole = message => { if (message.type() === 'error') errors.push(safeError(message.text())); };
    for (const session of [gm, player]) {
      session.page.on('pageerror', onPageError);
      session.page.on('console', onConsole);
    }
    try {
      fixture = await rpc(gm.page, 'prepare', { runId: report.runId, playerUserId: player.state.user, name: testCase.name });
      await rpc(player.page, 'view', fixture);
      let assertions;
      if (testCase.name === 'player-coating-access') {
        await rpc(gm.page, 'configurePlayerAccess', false);
        const denied = await rpc(player.page, 'runPlayerCase', { name: testCase.name, fixture, allowed: false });
        await rpc(gm.page, 'configurePlayerAccess', true);
        await player.page.waitForFunction(() => game.settings.get('pf2e-afflictioner', 'allowPlayerWeaponCoatingAccess') === true);
        const allowed = await rpc(player.page, 'runPlayerCase', { name: testCase.name, fixture, allowed: true });
        assertions = [...denied, ...allowed];
      } else {
        assertions = await rpc(gm.page, 'runCase', { name: testCase.name, fixture });
      }
      if (assertions.some(item => item.status !== 'passed')) throw Error(`Assertion failed: ${JSON.stringify(assertions)}`);
      if (errors.length) throw Error(`Browser errors: ${errors.join('\n')}`);
      const screenshot = path.join(evidenceDirectory, `${testCase.name}.png`);
      await gm.page.screenshot({ path: screenshot });
      result.steps.push({ workflow: testCase.name, status: 'passed', assertions, screenshot: path.basename(screenshot) });
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.error = safeError(error);
      result.steps.push({ workflow: testCase.name, status: 'failed', assertions: [], error: result.error });
    } finally {
      for (const session of [gm, player]) {
        session.page.off('pageerror', onPageError);
        session.page.off('console', onConsole);
      }
      try { await rpc(gm.page, 'cleanup', report.runId); }
      catch (error) { result.status = 'failed'; result.cleanupError = safeError(error); }
      await saveReport();
    }
  }

  report.sourceChangedDuringRun = await sourceFingerprint() !== report.sourceFingerprint;
  await cleanup(journal);
}

try {
  await run();
} catch (error) {
  report.error = safeError(error);
  process.exitCode = 1;
} finally {
  if (journal && gm && report.cleanup !== 'complete') {
    try { await cleanup(journal); }
    catch (error) { report.cleanup = 'failed'; report.cleanupError = safeError(error); process.exitCode = 1; }
  }
  report.finished = new Date().toISOString();
  try { await saveReport(); } catch (error) { console.error(safeError(error)); process.exitCode = 1; }
  await browser?.close().catch(() => {});
  if (locked) await unlink(lockPath).catch(() => {});
}

const incomplete = report.cases.filter(result => result.status !== 'passed');
if (report.error || (report.runId && (incomplete.length || report.cleanup !== 'complete' || report.startupErrors.length))) process.exitCode = 1;
if (report.runId) console.log(JSON.stringify({ runId: report.runId, passed: report.cases.length - incomplete.length, failed: incomplete.length, cleanup: report.cleanup, report: path.join(evidenceDirectory, 'report.json') }, null, 2));
