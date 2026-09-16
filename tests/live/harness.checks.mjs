import test from 'node:test';
import assert from 'node:assert/strict';
import { fullCases, smokeCases } from './cases.mjs';
import { validateCases, casePassed } from './coverage.mjs';
import { assessRequirements } from './requirements.mjs';
import { accountDefaults } from './local-defaults.mjs';
import { assertQaWorld, DEFAULT_QA_WORLD } from './world-guard.mjs';
import { featureInventory } from './feature-inventory.mjs';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('catalog is unique, automated, and fully mapped', () => {
  assert.doesNotThrow(() => validateCases(fullCases));
  assert.ok(smokeCases.length > 0 && smokeCases.every(item => fullCases.includes(item)));
  assert.equal(assessRequirements(fullCases, []).details.flatMap(item => item.missing).length, 0);
});

test('every focused unit feature suite maps to live Foundry evidence', () => {
  const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const suites = readdirSync(testsDir).filter(name => name.endsWith('.test.js')).sort();
  assert.deepEqual(Object.keys(featureInventory).sort(), suites);
  const liveNames = new Set(fullCases.map(item => item.name));
  for (const [suite, scenarios] of Object.entries(featureInventory)) {
    assert.ok(scenarios.length > 0, `${suite} has no live scenario`);
    assert.deepEqual(scenarios.filter(name => !liveNames.has(name)), [], `${suite} references unknown live scenarios`);
  }
});

test('passing evidence requires assertions', () => {
  assert.equal(casePassed({ status: 'passed', mode: 'automated', steps: [] }), false);
  assert.equal(casePassed({ status: 'passed', mode: 'automated', steps: [{ status: 'passed', assertions: [{ status: 'passed' }] }] }), true);
});

test('shared Visioner account config never inherits password across usernames', () => {
  const local = { gm: { username: 'qa-gm', password: 'secret' } };
  assert.equal(accountDefaults('gm', local, { VISIONER_GM_USER: 'other' }).password, undefined);
  assert.equal(accountDefaults('gm', local, {}).password, 'secret');
});

test('world guard accepts only exact disposable ID', () => {
  assert.doesNotThrow(() => assertQaWorld(DEFAULT_QA_WORLD));
  assert.throws(() => assertQaWorld('campaign'));
  assert.throws(() => assertQaWorld(undefined));
});
