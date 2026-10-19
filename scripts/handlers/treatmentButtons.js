import * as AfflictionStore from '../stores/AfflictionStore.js';
import { getSystemFlags } from '../systemCompat.js';

export function registerTreatmentButtonHandlers(root) {
  const rollTreatmentButtons = root.querySelectorAll('.affliction-roll-treatment');
  rollTreatmentButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      const tokenId = btn.dataset.tokenId;
      const actorId = btn.dataset.actorId;
      const afflictionId = btn.dataset.afflictionId;
      const dc = parseInt(btn.dataset.dc);

      let token = tokenId ? canvas.tokens.get(tokenId) : null;
      if (!token && actorId) {
        token = AfflictionStore.findTokenForActor(game.actors.get(actorId));
      }

      const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
        return;
      }

      const affliction = token
        ? AfflictionStore.getAffliction(token, afflictionId)
        : AfflictionStore.getAfflictionForActor(actor, afflictionId);
      if (!affliction) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_NOT_FOUND'));
        return;
      }

      const treater = canvas.tokens.controlled[0];
      const treatingActor = treater?.actor || actor;

      if (!treatingActor.skills?.medicine) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.NO_MEDICINE_SKILL'));
        return;
      }

      // Tag the roll as the Treat action so PF2e rule elements predicated on it apply
      const action = affliction.type === 'poison' ? 'treat-poison' : 'treat-disease';
      const roll = await treatingActor.skills.medicine.roll({
        dc: { value: dc },
        extraRollOptions: [`action:${action}`],
      });

      const { SocketService } = await import('../services/SocketService.js');
      await SocketService.requestHandleTreatment(tokenId, afflictionId, roll.total, dc, actorId, treatingActor.id);

      btn.disabled = true;
    });
  });
}

export async function addTreatmentAfflictionSelection(message, htmlElement) {
  if (!game.user.isGM) return;

  if (htmlElement.dataset.treatmentSelectionEnabled === 'true') return;

  const flags = getSystemFlags(message);
  if (!flags?.context?.type || flags.context.type !== 'skill-check') return;

  const options = flags.context?.options || [];
  const isTreatPoison = options.includes('action:treat-poison');
  const isTreatDisease = options.includes('action:treat-disease');

  if (!isTreatPoison && !isTreatDisease) return;

  const rollTotal = message.rolls?.[0]?.total;
  if (typeof rollTotal !== 'number') return;

  const actorId = flags.context?.actor;
  if (!actorId) return;

  const actor = game.actors.get(actorId);
  if (!actor) return;

  if (!canvas?.tokens) return;

  const afflictionType = isTreatPoison ? 'poison' : 'disease';
  const tokensWithAfflictions = [];

  const tokensToCheck = game.user.targets.size > 0
    ? Array.from(game.user.targets)
    : canvas.tokens.placeables;

  for (const token of tokensToCheck) {
    const afflictions = AfflictionStore.getAfflictions(token);
    const matching = Object.values(afflictions).filter(a => a.type === afflictionType);
    if (matching.length > 0) {
      tokensWithAfflictions.push({ token, afflictions: matching });
    }
  }

  if (tokensWithAfflictions.length === 0) return;

  htmlElement.dataset.treatmentSelectionEnabled = 'true';

  const messageContent = htmlElement.querySelector('.message-content') || htmlElement.querySelector('.card-content');
  if (!messageContent) return;

  const selectionDiv = document.createElement('div');
  selectionDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(74, 124, 42, 0.15); border-left: 3px solid #4a7c2a; border-radius: 4px;';

  const header = document.createElement('div');
  header.style.cssText = 'font-weight: bold; color: #4a7c2a; margin-bottom: 8px;';
  header.innerHTML = `<i class="fas fa-medkit"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_TREATMENT_TO')}`;
  selectionDiv.appendChild(header);

  for (const { token, afflictions: matchingAfflictions } of tokensWithAfflictions) {
    for (const affliction of matchingAfflictions) {
      const button = document.createElement('button');
      button.style.cssText = 'width: 100%; padding: 6px; margin: 4px 0; background: #4a7c2a; border: 1px solid #5a8c3a; color: white; border-radius: 4px; cursor: pointer;';
      const stageDisplay = affliction.currentStage === -1 ? game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.INITIAL_SAVE') : `${game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.STAGE')} ${affliction.currentStage}`;
      button.innerHTML = `${token.name}: ${affliction.name} (${stageDisplay})`;

      button.addEventListener('click', async () => {
        try {
          const { TreatmentService } = await import('../services/TreatmentService.js');
          await TreatmentService.handleTreatmentResult(token, affliction, rollTotal, affliction.dc, null, actor);

          button.disabled = true;
          button.style.opacity = '0.5';
          button.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.format('PF2E_AFFLICTIONER.BUTTONS.TREATMENT_APPLIED', { tokenName: token.name, afflictionName: affliction.name })}`;
        } catch (error) {
          console.error('Error applying treatment:', error);
          ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.FAILED_APPLY_TREATMENT'));
        }
      });

      selectionDiv.appendChild(button);
    }
  }

  messageContent.appendChild(selectionDiv);
}
