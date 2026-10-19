import { AfflictionService } from './AfflictionService.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { DEGREE_OF_SUCCESS } from '../constants.js';
import { FeatsService } from './FeatsService.js';

export class TreatmentService {
  static async promptTreatment(token, affliction, actor = null) {
    actor = actor || token?.actor;
    if (!actor) return;

    if (affliction.treatedThisStage) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.NOTIFICATIONS.ALREADY_TREATED'));
      return;
    }

    const content = `
      <div class="pf2e-afflictioner-treatment-request">
        <h3><i class="fas fa-briefcase-medical"></i> Treatment: ${affliction.type === 'poison' ? 'Poison' : 'Disease'}</h3>
        <p><strong>${actor.name}</strong> needs treatment for <strong>${affliction.name}</strong></p>
        <p><em>Crit Success +4, Success +2, Failure 0, Crit Failure -2 to next save</em></p>
        <hr>
        <button class="affliction-roll-treatment" data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''} data-affliction-id="${affliction.id}" data-dc="${affliction.dc}" style="width: 100%; padding: 8px; margin-top: 10px;">
          <i class="fas fa-dice-d20"></i> Roll Medicine (Treat ${affliction.type === 'poison' ? 'Poison' : 'Disease'})
        </button>
      </div>
    `;

    await ChatMessage.create({
      content: content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor })
    });
  }

  static async handleTreatmentResult(token, affliction, total, dc, actor = null, treater = null) {
    const degree = AfflictionService.calculateDegreeOfSuccess(total, dc);
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    // Robust Recovery applies whether the healer or the patient has it
    const robustRecovery = FeatsService.hasRobustRecovery(treater) || FeatsService.hasRobustRecovery(actor);

    let bonus = 0;
    switch (degree) {
      case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
        bonus = 4;
        break;
      case DEGREE_OF_SUCCESS.SUCCESS:
        bonus = robustRecovery ? 4 : 2;
        break;
      case DEGREE_OF_SUCCESS.FAILURE:
        bonus = 0;
        break;
      case DEGREE_OF_SUCCESS.CRITICAL_FAILURE:
        bonus = -2;
        break;
    }

    const updates = bonus !== 0
      ? { treatmentBonus: bonus, treatedThisStage: true, treatmentEffectUuid: actor ? await this.createTreatmentEffect(actor, affliction, bonus, degree) : null }
      : { treatmentBonus: 0, treatedThisStage: true };
    updates.treatmentRobustRecovery = robustRecovery && bonus > 0;

    if (token) {
      await AfflictionStore.updateAffliction(token, affliction.id, updates);
    } else if (actor) {
      await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
    }

    if (bonus > 0) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.TREATMENT_POSITIVE', {
        tokenName: entityName,
        bonus: bonus,
        afflictionName: affliction.name
      }));
    } else if (bonus < 0) {
      ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.TREATMENT_NEGATIVE', {
        tokenName: entityName,
        bonus: bonus,
        afflictionName: affliction.name
      }));
    } else {
      ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.NOTIFICATIONS.TREATMENT_NONE'));
    }
  }

  static async createTreatmentEffect(actor, affliction, bonus, degree) {
    try {
      const degreeNames = {
        [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: 'Critical Success',
        [DEGREE_OF_SUCCESS.SUCCESS]: 'Success',
        [DEGREE_OF_SUCCESS.FAILURE]: 'Failure',
        [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: 'Critical Failure'
      };
      const degreeName = degreeNames[degree] || '';
      const effectName = `${affliction.name} (Treatment: ${degreeName})`;

      const rules = [{
        key: 'FlatModifier',
        selector: 'saving-throw',
        type: 'circumstance',
        value: bonus,
        label: effectName
      }];

      const effectData = {
        type: 'effect',
        name: effectName,
        system: {
          tokenIcon: { show: true },
          duration: {
            value: -1,
            unit: 'unlimited',
            expiry: null,
            sustained: false
          },
          rules: rules,
          slug: `treatment-${affliction.name.toLowerCase().replace(/\s+/g, '-')}`
        },
        flags: {
          'pf2e-afflictioner': {
            afflictionId: affliction.id,
            isTreatmentBonus: true
          }
        }
      };

      const [created] = await actor.createEmbeddedDocuments('Item', [effectData]);
      return created?.uuid;
    } catch (error) {
      console.error('PF2e Afflictioner | Error creating treatment effect:', error);
      return null;
    }
  }
}
