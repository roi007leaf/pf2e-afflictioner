import { MODULE_ID } from './constants.js';
import { registerSettings } from './settings.js';
import { registerAfflictionHooks } from './hooks/registration.js';
import { detectSystem } from './systemCompat.js';
import './regions/register.js';

const MIGRATION_VERSION = 1;

/**
 * One-time migration: move afflictions from linked token documents to actor documents.
 * This ensures afflictions persist across scenes for linked tokens (PCs, named NPCs).
 */
async function migrateLinkedTokenAfflictions() {
  const currentVersion = game.settings.get(MODULE_ID, 'migrationVersion') ?? 0;
  if (currentVersion >= MIGRATION_VERSION) return;

  console.log('PF2e Afflictioner | Running migration: linked token afflictions → actor storage');
  let migratedCount = 0;

  for (const scene of game.scenes) {
    for (const tokenDoc of scene.tokens) {
      if (!tokenDoc.actorLink) continue;

      const tokenAfflictions = tokenDoc.getFlag(MODULE_ID, 'afflictions');
      if (!tokenAfflictions || Object.keys(tokenAfflictions).length === 0) continue;

      const actor = tokenDoc.actor;
      if (!actor) continue;

      // Merge into actor flags (prefer most recent by addedTimestamp on conflict)
      const actorAfflictions = { ...actor.getFlag(MODULE_ID, 'afflictions') ?? {} };
      for (const [id, affliction] of Object.entries(tokenAfflictions)) {
        if (!actorAfflictions[id] || (affliction.addedTimestamp > (actorAfflictions[id].addedTimestamp ?? 0))) {
          actorAfflictions[id] = affliction;
        }
      }

      await actor.setFlag(MODULE_ID, 'afflictions', actorAfflictions);
      await tokenDoc.unsetFlag(MODULE_ID, 'afflictions');
      migratedCount += Object.keys(tokenAfflictions).length;
    }
  }

  await game.settings.set(MODULE_ID, 'migrationVersion', MIGRATION_VERSION);

  if (migratedCount > 0) {
    console.log(`PF2e Afflictioner | Migration complete: moved ${migratedCount} affliction(s) to actor storage`);
    ui.notifications.info(`PF2e Afflictioner: Migrated ${migratedCount} affliction(s) to actor-based storage for cross-scene persistence.`);
  }
}

Hooks.once('init', async () => {
  detectSystem();
  registerSettings();
  registerAfflictionHooks();

  const { api } = await import('./api.js');
  game.modules.get(MODULE_ID).api = api;

  console.log('PF2e Afflictioner | Initialized');
});

Hooks.once('ready', async () => {
  console.log('PF2e Afflictioner | Ready');

  const { SocketService } = await import('./services/SocketService.js');
  SocketService.initialize();

  const { StoryframeIntegrationService } = await import('./services/StoryframeIntegrationService.js');
  game.afflictioner = game.afflictioner || {};
  game.afflictioner.storyframeService = new StoryframeIntegrationService();

  setInterval(async () => {
    if (StoryframeIntegrationService.isAvailable()) {
      await game.afflictioner.storyframeService.pollResults();
    }
  }, 2000);

  if (game.user.isGM) {
    const { CommunityAfflictionsService } = await import('./services/CommunityAfflictionsService.js');
    await CommunityAfflictionsService.maybeImport();

    // Migrate linked-token afflictions to actor storage (one-time)
    await migrateLinkedTokenAfflictions();
  }

  if (game.user.isGM) {
    const { default: indicator } = await import('./ui/AfflictionMonitorIndicator.js');
    game.modules.get(MODULE_ID).indicator = indicator;

    Hooks.on('canvasReady', () => {
      indicator.refresh();
    });

    Hooks.on('updateToken', () => {
      indicator.refresh();
    });

    Hooks.on('updateActor', () => {
      indicator.refresh();
    });

    Hooks.on('updateCombat', () => {
      indicator.refresh();
    });

    Hooks.on('updateWorldTime', () => {
      indicator.refresh();
    });

    Hooks.on('controlToken', () => {
      indicator.refresh();
    });

    indicator.refresh();
  }
});
