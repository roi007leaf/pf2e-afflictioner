import { MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionService } from '../services/AfflictionService.js';
import { AddictionService } from '../services/AddictionService.js';

export async function onPreUpdateItem(item, changes, options, userId) {
  if (item.type === 'effect') {
    const isAfflictionEffect = item.getFlag(MODULE_ID, 'isAfflictionEffect');
    const afflictionId = item.getFlag(MODULE_ID, 'afflictionId');
    const badgeChange = changes.system?.badge?.value;

    if (isAfflictionEffect && afflictionId && badgeChange !== undefined) {
      const user = game.users.get(userId);
      const isGM = user?.isGM;

      if (isGM && !options?.bypassAfflictionSync) {
        const token = canvas.tokens.get(item.parent.token?.id) || canvas.tokens.placeables.find(t => t.actor?.id === item.parent.id);
        if (token) {
          const affliction = AfflictionStore.getAffliction(token, afflictionId);
          if (affliction?.isAddiction && !AddictionService.isEnabled()) return false;

          if (affliction && affliction.needsInitialSave) {
            return true;
          }

          if (affliction && affliction.currentStage !== badgeChange) {
            const maxStage = affliction.successStageLimit === 1 ? 1 : (affliction.stages?.length || 4);
            const newStage = Math.max(0, Math.min(badgeChange, maxStage));

            setTimeout(async () => {
              try {
                if (newStage === 0) {
                  const oldStageData = affliction.stages[affliction.currentStage - 1];

                  await AfflictionStore.removeAffliction(token, affliction.id);
                  await AfflictionService.removeStageEffects(token, affliction, oldStageData, null);

                  const { VisualService } = await import('../services/VisualService.js');
                  await VisualService.removeAfflictionIndicator(token);

                  ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RECOVERED', {
                    tokenName: token.name,
                    afflictionName: affliction.name
                  }));
                  return;
                }

                const oldStageData = affliction.stages[affliction.currentStage - 1];
                const newStageData = affliction.stages[newStage - 1];

                await AfflictionStore.updateAffliction(token, affliction.id, {
                  currentStage: newStage
                });

                const updatedAffliction = AfflictionStore.getAffliction(token, affliction.id);

                await AfflictionService.removeStageEffects(token, updatedAffliction, oldStageData, newStageData);

                if (newStageData) {
                  await AfflictionService.applyStageEffects(token, updatedAffliction, newStageData);
                }

                ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.STAGE_UPDATED', {
                  afflictionName: affliction.name,
                  stage: newStage
                }));
              } catch (error) {
                console.error('PF2e Afflictioner | Error syncing affliction stage:', error);
                ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.ERRORS.FAILED_UPDATE_STAGE', {
                  name: affliction.name
                }));
              }
            }, 0);

            return false;
          }
        }
      }
    }
  }

  return true;
}
