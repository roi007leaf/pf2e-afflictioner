import { casePassed } from './coverage.mjs';

export const requirements = [
  ['Public API and actor-backed storage', ['runtime-api-crud', 'off-scene-actor-storage']],
  ['PF2e item parsing', ['parser-native-item', 'parser-advanced-syntax', 'parser-locales', 'parser-structured-and-effect-only']],
  ['Initial saves and stage lifecycle', ['initial-save-failure', 'initial-save-resisted', 'stage-advance-and-recovery', 'manual-stage-and-incapacitation', 'multiple-exposure-and-virulent']],
  ['World-time and maximum-duration timers', ['onset-world-time', 'maximum-duration']],
  ['PF2e stage effects and persistent conditions', ['stage-effect-rules', 'persistent-condition-lifetime', 'advanced-stage-effects']],
  ['Immunity and edited definitions', ['actor-immunity', 'source-immunity-bypass', 'edited-definition', 'custom-icon-and-stage-editor']],
  ['Treatment and counteract recovery', ['treatment-result', 'counteract-result', 'recovery-restrictions']],
  ['Feat and ancestry rules', ['feat-adjustments', 'vishkanya-venom']],
  ['Weapon coatings and injections', ['weapon-coating-lifecycle', 'weapon-injection-lifecycle', 'double-poison-and-weapon-rules', 'unlinked-token-storage']],
  ['Combat scheduling', ['combat-scheduled-save']],
  ['Chat privacy', ['chat-message-privacy']],
  ['GM and player UI permissions', ['manager-gm-ui', 'player-coating-access', 'token-indicator', 'monitor-ui']],
  ['Region behavior', ['region-behavior-registration', 'region-runtime-application']],
  ['Settings persistence and restoration', ['settings-persistence']],
  ['Optional integrations', ['visioner-stage-integration', 'optional-integration-contracts']],
  ['Supported environment', ['foundry14-pf2e-compatibility']],
].map(([name, scenarios]) => ({ name, scenarios }));

export function assessRequirements(catalog, results) {
  const implemented = new Set(catalog.map(testCase => testCase.name));
  const outcomes = new Map(results.map(result => [result.name, casePassed(result)]));
  const details = requirements.map(requirement => ({
    name: requirement.name,
    missing: requirement.scenarios.filter(name => !implemented.has(name)),
    unrun: requirement.scenarios.filter(name => implemented.has(name) && !outcomes.has(name)),
    failed: requirement.scenarios.filter(name => outcomes.has(name) && !outcomes.get(name)),
  }));
  return { complete: details.every(item => !item.missing.length && !item.unrun.length && !item.failed.length), details };
}
