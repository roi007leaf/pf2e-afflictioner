import { AfflictionService } from '../services/AfflictionService.js';
import { AfflictionParser } from '../services/AfflictionParser.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import * as WeaponCoatingStore from '../stores/WeaponCoatingStore.js';

async function processAfflictionsForToken(token, afflictions, delta) {
  for (const [id, affliction] of Object.entries(afflictions)) {
    if (game.combat && game.combat.started) {
      continue;
    }

    if (affliction.inOnset && affliction.onsetRemaining > 0) {
      const newRemaining = affliction.onsetRemaining - delta;

      if (newRemaining <= 0) {
        const targetStage = Math.min(affliction.stageAdvancement || 1, affliction.stages.length);
        const stageData = affliction.stages[targetStage - 1];

        if (!stageData) {
          console.error(`PF2e Afflictioner | Stage ${targetStage} not found for ${affliction.name}`);
          continue;
        }

        const durationCopy = stageData.duration ? { ...stageData.duration } : null;
        const stageDurationSeconds = await AfflictionParser.resolveStageDuration(durationCopy, `${affliction.name} Stage ${targetStage}`);
        const resolvedDuration = durationCopy?.value > 0
          ? { value: durationCopy.value, unit: durationCopy.unit }
          : undefined;

        const onsetUpdates = {
          inOnset: false,
          currentStage: targetStage,
          onsetRemaining: 0,
          durationElapsed: 0,
          nextSaveTimestamp: game.time.worldTime + stageDurationSeconds,
          ...(resolvedDuration && { currentStageResolvedDuration: resolvedDuration })
        };

        if (stageData.effectInterval) {
          const effectIntervalSeconds = AfflictionParser.durationToSeconds(stageData.effectInterval);
          onsetUpdates.effectIntervalElapsed = 0;
          onsetUpdates.nextEffectTimestamp = game.time.worldTime + effectIntervalSeconds;
        }

        await AfflictionStore.updateAffliction(token, id, onsetUpdates);

        const updatedAffliction = AfflictionStore.getAffliction(token, id);
        await AfflictionService.applyStageEffects(token, updatedAffliction, stageData);

        if (stageData.damage && stageData.damage.length > 0) {
          await AfflictionService.promptDamage(token, updatedAffliction);
        }

        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.ONSET_COMPLETE', {
          tokenName: token.name,
          afflictionName: affliction.name,
          stage: targetStage
        }));
      } else {
        await AfflictionStore.updateAffliction(token, id, {
          onsetRemaining: newRemaining
        });
        await AfflictionService.checkWorldTimeOnsetEffectInterval(token, affliction, delta);
      }
    } else {
      const wasRemoved = await AfflictionService.checkWorldTimeMaxDuration(token, affliction, delta);
      if (wasRemoved) continue;

      await AfflictionService.checkWorldTimeSave(token, affliction, delta);
      await AfflictionService.checkWorldTimeEffectInterval(token, affliction, delta);
    }
  }
}

async function processAfflictionsForOffSceneActor(actor, afflictions, delta) {
  for (const [id, affliction] of Object.entries(afflictions)) {
    if (game.combat && game.combat.started) continue;

    if (affliction.inOnset && affliction.onsetRemaining > 0) {
      const newRemaining = affliction.onsetRemaining - delta;

      if (newRemaining <= 0) {
        const targetStage = Math.min(affliction.stageAdvancement || 1, affliction.stages.length);
        const stageData = affliction.stages[targetStage - 1];
        if (!stageData) continue;

        const durationCopy = stageData.duration ? { ...stageData.duration } : null;
        const stageDurationSeconds = await AfflictionParser.resolveStageDuration(durationCopy, `${affliction.name} Stage ${targetStage}`);
        const resolvedDuration = durationCopy?.value > 0
          ? { value: durationCopy.value, unit: durationCopy.unit }
          : undefined;

        const onsetUpdates = {
          inOnset: false,
          currentStage: targetStage,
          onsetRemaining: 0,
          durationElapsed: 0,
          nextSaveTimestamp: game.time.worldTime + stageDurationSeconds,
          ...(resolvedDuration && { currentStageResolvedDuration: resolvedDuration })
        };

        if (stageData.effectInterval) {
          const effectIntervalSeconds = AfflictionParser.durationToSeconds(stageData.effectInterval);
          onsetUpdates.effectIntervalElapsed = 0;
          onsetUpdates.nextEffectTimestamp = game.time.worldTime + effectIntervalSeconds;
        }

        await AfflictionStore.updateAfflictionForActor(actor, id, onsetUpdates);

        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.ONSET_COMPLETE', {
          tokenName: actor.name,
          afflictionName: affliction.name,
          stage: targetStage
        }));
      } else {
        await AfflictionStore.updateAfflictionForActor(actor, id, {
          onsetRemaining: newRemaining
        });
      }
    } else {
      // Track max duration using maxDurationElapsed (same field as AfflictionTimerService)
      if (affliction.maxDuration && !affliction.maxDurationExpired) {
        const maxDurationSeconds = AfflictionParser.durationToSeconds(affliction.maxDuration);
        if (maxDurationSeconds > 0) {
          const newMaxElapsed = (affliction.maxDurationElapsed || 0) + delta;
          await AfflictionStore.updateAfflictionForActor(actor, id, {
            maxDurationElapsed: newMaxElapsed
          });

          if (newMaxElapsed >= maxDurationSeconds) {
            await AfflictionStore.updateAfflictionForActor(actor, id, {
              maxDurationExpired: true
            });
            ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MAX_DURATION_EXPIRED', {
              afflictionName: affliction.name,
              tokenName: actor.name
            }));
            // Don't remove — let the GM decide via the manager, same as on-scene behavior
            continue;
          }
        }
      }

      // Track stage duration for save timing using durationElapsed
      if (!affliction.currentStage || affliction.currentStage === 0) continue;
      const stage = affliction.stages?.[affliction.currentStage - 1];
      if (!stage?.duration) continue;

      const stageDurationSeconds = AfflictionParser.durationToSeconds(stage.duration);
      const newElapsed = (affliction.durationElapsed || 0) + delta;

      if (newElapsed >= stageDurationSeconds) {
        // Save is due — reset elapsed and prompt the save
        await AfflictionStore.updateAfflictionForActor(actor, id, {
          durationElapsed: 0
        });

        const token = AfflictionStore.findTokenForActor(actor);
        const updatedAffliction = token
          ? AfflictionStore.getAffliction(token, id) || affliction
          : affliction;
        await AfflictionService.promptSave(token, updatedAffliction, actor);
      } else {
        await AfflictionStore.updateAfflictionForActor(actor, id, {
          durationElapsed: newElapsed
        });
      }
    }
  }
}

export async function onWorldTimeUpdate(worldTime, delta) {
  if (!game.user.isGM) return;

  if (delta < 1) return;

  if (!canvas?.tokens) {
    return;
  }

  const seenActorIds = new Set();

  for (const token of canvas.tokens.placeables) {
    const afflictions = AfflictionStore.getAfflictions(token);
    if (Object.keys(afflictions).length === 0) continue;
    if (token.document.actorLink && token.actor) seenActorIds.add(token.actor.id);

    await processAfflictionsForToken(token, afflictions, delta);
  }

  // Process off-scene linked actors
  for (const actor of game.actors) {
    if (seenActorIds.has(actor.id)) continue;
    const afflictions = AfflictionStore.getAfflictionsForActor(actor);
    if (Object.keys(afflictions).length === 0) continue;

    await processAfflictionsForOffSceneActor(actor, afflictions, delta);
  }

  // Check coating expiration for time-based modes
  await checkWorldTimeCoatingExpiration(worldTime);
}

function getCoatingDurationSeconds(expirationMode) {
  if (expirationMode?.startsWith('custom:')) {
    const [, val, unit] = expirationMode.split(':');
    const n = parseInt(val) || 1;
    const multipliers = { rounds: 6, minutes: 60, hours: 3600 };
    return n * (multipliers[unit] || 60);
  }
  switch (expirationMode) {
    case '1-minute': return 60;
    case '10-minutes': return 600;
    case '1-hour': return 3600;
    default: return null; // unlimited or turn-based
  }
}

async function checkWorldTimeCoatingExpiration(currentWorldTime) {
  const allCoatings = WeaponCoatingStore.getAllCoatingsOnCanvas();
  for (const coating of allCoatings) {
    if (!coating.appliedTimestamp) continue;
    let shouldExpire = false;

    const durationSec = getCoatingDurationSeconds(coating.expirationMode);

    if (durationSec != null) {
      // Time-based modes (1-minute, 10-minutes, 1-hour, custom)
      if (currentWorldTime - coating.appliedTimestamp >= durationSec) {
        shouldExpire = true;
      }
    } else if (
      (coating.expirationMode === 'start-next-turn' || coating.expirationMode === 'end-next-turn') &&
      coating.appliedCombatantId == null &&
      !(game.combat && game.combat.started)
    ) {
      // Turn-based coating applied outside combat: fall back to 10-min expiry
      if (currentWorldTime - coating.appliedTimestamp >= 600) {
        shouldExpire = true;
      }
    }

    if (!shouldExpire) continue;

    const actor = coating.actor || game.actors.get(coating.actorId);
    if (!actor) continue;

    await WeaponCoatingStore.removeCoating(actor, coating.weaponId);
    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.WEAPON_COATING.EXPIRED', {
      poisonName: coating.poisonName,
      weaponName: coating.weaponName
    }));
  }
}
