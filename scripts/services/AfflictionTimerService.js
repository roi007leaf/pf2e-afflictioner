import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionParser } from './AfflictionParser.js';
import { AfflictionChatService } from './AfflictionChatService.js';
import { shouldSkipAffliction } from '../utils.js';

export class AfflictionTimerService {
  static async updateOnsetTimers(token, combat, AfflictionService) {
    const afflictions = AfflictionStore.getAfflictions(token);

    for (const [id, affliction] of Object.entries(afflictions)) {
      if (shouldSkipAffliction(affliction)) continue;

      if (affliction.inOnset && affliction.onsetRemaining > 0) {
        const newRemaining = affliction.onsetRemaining - 6;

        if (newRemaining <= 0) {
          const targetStage = Math.min(affliction.stageAdvancement || 1, affliction.stages.length);
          const stageData = affliction.stages[targetStage - 1];

          if (!stageData) {
            console.error(`PF2e Afflictioner | Stage ${targetStage} not found for ${affliction.name}`);
            return;
          }

          const durationCopy = stageData.duration ? { ...stageData.duration } : null;
          const durationSeconds = await AfflictionParser.resolveStageDuration(durationCopy, `${affliction.name} Stage ${targetStage}`);
          const durationRounds = Math.ceil(durationSeconds / 6);
          const tokenCombatant = combat.combatants.find(c => c.tokenId === token.id);
          const resolvedDuration = durationCopy?.value > 0
            ? { value: durationCopy.value, unit: durationCopy.unit }
            : undefined;
          const onsetUpdates = {
            inOnset: false,
            currentStage: targetStage,
            onsetRemaining: 0,
            durationElapsed: 0,
            nextSaveRound: combat.round + durationRounds,
            ...(resolvedDuration && { currentStageResolvedDuration: resolvedDuration }),
            nextSaveInitiative: tokenCombatant?.initiative
          };

          if (stageData.effectInterval) {
            const effectIntervalSeconds = AfflictionParser.durationToSeconds(stageData.effectInterval);
            const effectRounds = Math.ceil(effectIntervalSeconds / 6);
            onsetUpdates.effectIntervalElapsed = 0;
            onsetUpdates.nextEffectRound = combat.round + effectRounds;
          }

          await AfflictionStore.updateAffliction(token, id, onsetUpdates);

          const updatedAffliction = AfflictionStore.getAffliction(token, id);
          await AfflictionService.applyStageEffects(token, updatedAffliction, stageData);

          if (stageData.damage && stageData.damage.length > 0) {
            await AfflictionService.promptDamage(token, updatedAffliction);
          }
        } else {
          const updates = { onsetRemaining: newRemaining };

          if (affliction.onsetEffectInterval && affliction.nextOnsetEffectRound && combat.round >= affliction.nextOnsetEffectRound) {
            const syntheticOnsetStage = {
              effects: '',
              conditions: affliction.onsetConditions || [],
              weakness: affliction.onsetWeakness || [],
              damage: affliction.onsetDamage || [],
              autoEffects: [],
              ruleElements: []
            };
            await AfflictionService.applyStageEffects(token, affliction, syntheticOnsetStage);
            await AfflictionChatService.postOnsetEffectIntervalTrigger(token, affliction);

            const intervalSeconds = AfflictionParser.durationToSeconds(affliction.onsetEffectInterval);
            const intervalRounds = Math.ceil(intervalSeconds / 6);
            updates.nextOnsetEffectRound = combat.round + intervalRounds;
          }

          await AfflictionStore.updateAffliction(token, id, updates);
        }
      }
    }
  }

  static async checkDurations(token, _combat) {
    const afflictions = AfflictionStore.getAfflictions(token);

    for (const [_id, affliction] of Object.entries(afflictions)) {
      if (!affliction.maxDuration) continue;

      if (affliction.inOnset) continue;

      const newMaxDurationElapsed = (affliction.maxDurationElapsed || 0) + 6;
      await AfflictionStore.updateAffliction(token, affliction.id, {
        maxDurationElapsed: newMaxDurationElapsed
      });

      const maxDurationSeconds = AfflictionParser.durationToSeconds(affliction.maxDuration);

      if (newMaxDurationElapsed >= maxDurationSeconds && !affliction.maxDurationExpired) {
        await AfflictionStore.updateAffliction(token, affliction.id, {
          maxDurationExpired: true
        });

        await AfflictionChatService.postMaxDurationExpired(token, affliction);

        ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MAX_DURATION_EXPIRED', {
          afflictionName: affliction.name,
          tokenName: token.name
        }));
      }
    }
  }

  static async checkWorldTimeMaxDuration(token, affliction, deltaSeconds) {
    if (!affliction.maxDuration) return false;

    if (affliction.inOnset) return false;

    const newMaxDurationElapsed = (affliction.maxDurationElapsed || 0) + deltaSeconds;
    await AfflictionStore.updateAffliction(token, affliction.id, {
      maxDurationElapsed: newMaxDurationElapsed
    });

    const maxDurationSeconds = AfflictionParser.durationToSeconds(affliction.maxDuration);

    if (newMaxDurationElapsed >= maxDurationSeconds && !affliction.maxDurationExpired) {
      await AfflictionStore.updateAffliction(token, affliction.id, {
        maxDurationExpired: true
      });

      await AfflictionChatService.postMaxDurationExpired(token, affliction);

      ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MAX_DURATION_EXPIRED', {
        afflictionName: affliction.name,
        tokenName: token.name
      }));

      return false;
    }

    return false;
  }

  static async checkEffectIntervals(token, combat, AfflictionService) {
    const afflictions = AfflictionStore.getAfflictions(token);

    for (const [_id, affliction] of Object.entries(afflictions)) {
      if (affliction.inOnset) continue;
      if (shouldSkipAffliction(affliction)) continue;
      if (!affliction.currentStage || affliction.currentStage === 0) continue;

      const stage = affliction.stages[affliction.currentStage - 1];
      if (!stage || !stage.effectInterval) continue;

      if (affliction.nextEffectRound && combat.round >= affliction.nextEffectRound) {
        await AfflictionService.applyStageEffects(token, affliction, stage);
        await AfflictionChatService.postEffectIntervalTrigger(token, affliction);

        const effectIntervalSeconds = AfflictionParser.durationToSeconds(stage.effectInterval);
        const effectRounds = Math.ceil(effectIntervalSeconds / 6);
        await AfflictionStore.updateAffliction(token, affliction.id, {
          effectIntervalElapsed: 0,
          nextEffectRound: combat.round + effectRounds
        });
      }
    }
  }

  static async checkWorldTimeEffectInterval(token, affliction, deltaSeconds, AfflictionService) {
    if (affliction.inOnset) return;
    if (!affliction.currentStage || affliction.currentStage === 0) return;

    const stage = affliction.stages[affliction.currentStage - 1];
    if (!stage || !stage.effectInterval) return;

    const effectIntervalSeconds = AfflictionParser.durationToSeconds(stage.effectInterval);
    const newElapsed = (affliction.effectIntervalElapsed || 0) + deltaSeconds;

    if (newElapsed >= effectIntervalSeconds) {
      if (stage) {
        await AfflictionService.applyStageEffects(token, affliction, stage);
      }

      await AfflictionChatService.postEffectIntervalTrigger(token, affliction);

      const remainingElapsed = newElapsed % effectIntervalSeconds;
      await AfflictionStore.updateAffliction(token, affliction.id, {
        effectIntervalElapsed: remainingElapsed,
        nextEffectTimestamp: game.time.worldTime + (effectIntervalSeconds - remainingElapsed)
      });
    } else {
      await AfflictionStore.updateAffliction(token, affliction.id, {
        effectIntervalElapsed: newElapsed
      });
    }
  }

  static async checkWorldTimeOnsetEffectInterval(token, affliction, deltaSeconds, AfflictionService) {
    if (!affliction.inOnset) return;
    if (!affliction.onsetEffectInterval) return;

    const intervalSeconds = AfflictionParser.durationToSeconds(affliction.onsetEffectInterval);
    const newElapsed = (affliction.onsetEffectIntervalElapsed || 0) + deltaSeconds;

    if (newElapsed >= intervalSeconds) {
      const syntheticOnsetStage = {
        effects: '',
        conditions: affliction.onsetConditions || [],
        weakness: affliction.onsetWeakness || [],
        damage: affliction.onsetDamage || [],
        autoEffects: [],
        ruleElements: []
      };
      await AfflictionService.applyStageEffects(token, affliction, syntheticOnsetStage);
      await AfflictionChatService.postOnsetEffectIntervalTrigger(token, affliction);

      const remainingElapsed = newElapsed % intervalSeconds;
      await AfflictionStore.updateAffliction(token, affliction.id, {
        onsetEffectIntervalElapsed: remainingElapsed,
        nextOnsetEffectTimestamp: game.time.worldTime + (intervalSeconds - remainingElapsed)
      });
    } else {
      await AfflictionStore.updateAffliction(token, affliction.id, {
        onsetEffectIntervalElapsed: newElapsed
      });
    }
  }

  static async checkWorldTimeSave(token, affliction, deltaSeconds, AfflictionService) {
    if (affliction.inOnset) {
      return;
    }

    if (!affliction.currentStage || affliction.currentStage === 0) return;

    const stage = affliction.stages[affliction.currentStage - 1];
    if (!stage || !stage.duration) return;

    const stageDurationSeconds = AfflictionParser.durationToSeconds(stage.duration);

    const newElapsed = (affliction.durationElapsed || 0) + deltaSeconds;

    if (newElapsed >= stageDurationSeconds) {
      await AfflictionStore.updateAffliction(token, affliction.id, {
        durationElapsed: 0
      });

      await AfflictionService.promptSave(token, affliction);
    } else {
      await AfflictionStore.updateAffliction(token, affliction.id, {
        durationElapsed: newElapsed
      });
    }
  }

  static async checkForScheduledSaves(token, combat, AfflictionService, combatant = null) {
    const afflictions = AfflictionStore.getAfflictions(token);
    const triggerInitiative = combatant?.initiative ?? combat.combatant?.initiative;

    for (const [_id, affliction] of Object.entries(afflictions)) {
      if (affliction.inOnset) continue;
      if (shouldSkipAffliction(affliction)) continue;
      if (affliction.nextSaveRound == null) continue;

      const isOverdue = combat.round > affliction.nextSaveRound;
      const isDueNow = combat.round === affliction.nextSaveRound &&
        affliction.nextSaveInitiative === triggerInitiative;

      if (isOverdue || isDueNow) {
        await AfflictionStore.updateAffliction(token, affliction.id, {
          nextSaveRound: null,
          nextSaveInitiative: null
        });
        await AfflictionService.promptSave(token, affliction);
      }
    }
  }

  static buildExpirationData(_affliction, stage, token) {
    const combat = game.combat;

    if (!stage.duration) {
      return { type: "permanent" };
    }

    if (combat) {
      const durationSeconds = AfflictionParser.durationToSeconds(stage.duration);
      const durationRounds = Math.ceil(durationSeconds / 6);
      const tokenCombatant = combat.combatants.find(c => c.tokenId === token.id);

      return {
        type: "combat",
        round: combat.round + durationRounds,
        initiative: tokenCombatant?.initiative,
        timestamp: null
      };
    } else {
      const durationSeconds = AfflictionParser.durationToSeconds(stage.duration);
      return {
        type: "worldTime",
        round: null,
        initiative: null,
        timestamp: game.time.worldTime + durationSeconds
      };
    }
  }
}
