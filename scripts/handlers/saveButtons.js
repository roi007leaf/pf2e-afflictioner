import * as AfflictionStore from '../stores/AfflictionStore.js';
import { getSystemFlags } from '../systemCompat.js';

export function registerSaveButtonHandlers(root) {
  registerInitialSaveButtons(root);
  registerStageSaveButtons(root);
  registerConfirmationButtons(root);
  registerReferencedSaveButtons(root);
}

function registerInitialSaveButtons(root) {
  const rollInitialSaveButtons = root.querySelectorAll('.affliction-roll-initial-save');
  rollInitialSaveButtons.forEach(button => {
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

      let affliction = token
        ? AfflictionStore.getAffliction(token, afflictionId)
        : AfflictionStore.getAfflictionForActor(actor, afflictionId);
      if (!affliction) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_NOT_FOUND'));
        return;
      }

      const AfflictionDefinitionStore = await import('../stores/AfflictionDefinitionStore.js');
      const key = AfflictionDefinitionStore.generateDefinitionKey(affliction);
      const editedDef = AfflictionDefinitionStore.getEditedDefinition(key);
      if (editedDef) {
        const { AfflictionEditorService } = await import('../services/AfflictionEditorService.js');
        affliction = AfflictionEditorService.applyEditedDefinition(affliction, editedDef);
      }

      const currentDC = affliction.dc || dc;

      const { StoryframeIntegrationService } = await import('../services/StoryframeIntegrationService.js');
      const sentToStoryframe = token
        ? await StoryframeIntegrationService.sendSaveRequest(token, affliction, 'initial')
        : false;

      if (sentToStoryframe) {
        btn.disabled = true;
        return;
      }

      const isBlindRoll = btn.dataset.blindRoll === 'true' || actor.type === 'npc';

      let rollMessageId = null;
      Hooks.once('createChatMessage', (message) => {
        if (message.actor?.id === actor.id && getSystemFlags(message)?.context?.type === 'saving-throw') {
          rollMessageId = message.id;
        }
      });

      const rollOptions = { dc: { value: currentDC } };
      if (isBlindRoll) {
        rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
      }

      const saveKey = affliction.saveType || 'fortitude';
      await actor.saves[saveKey].roll(rollOptions);

      await new Promise(resolve => setTimeout(resolve, 100));

      if (!rollMessageId) {
        rollMessageId = game.messages.contents[game.messages.contents.length - 1]?.id;
      }

      const { SocketService } = await import('../services/SocketService.js');
      await SocketService.requestHandleInitialSave(tokenId, afflictionId, rollMessageId, currentDC, actorId);

      btn.disabled = true;

      const messageElement = btn.closest('.message');
      const msgId = messageElement?.dataset.messageId;
      if (msgId) {
        const { SocketService } = await import('../services/SocketService.js');
        await SocketService.syncButtonState(msgId, btn.className, true);
      }

      if (game.user.isGM && !btn.nextElementSibling?.classList.contains('affliction-unlock-save')) {
        const unlockBtn = document.createElement('button');
        unlockBtn.className = 'affliction-unlock-save';
        unlockBtn.style.cssText = 'display: inline-block; margin-left: 8px; padding: 4px 8px; background: #555; border: 1px solid #777; color: #ffd700; border-radius: 4px; cursor: pointer; font-size: 11px; vertical-align: middle;';
        unlockBtn.innerHTML = `<i class="fas fa-unlock"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.UNLOCK')}`;

        unlockBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const messageElement = btn.closest('.message');
          const messageId = messageElement?.dataset.messageId;

          if (messageId) {
            const { SocketService } = await import('../services/SocketService.js');
            await SocketService.unlockSaveButton(messageId, btn.className);
            unlockBtn.remove();
          } else {
            console.error('Could not find message ID for unlock');
          }
        });

        btn.insertAdjacentElement('afterend', unlockBtn);
      }
    });
  });
}

function registerStageSaveButtons(root) {
  const rollSaveButtons = root.querySelectorAll('.affliction-roll-save');
  rollSaveButtons.forEach(button => {
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

      let affliction = token
        ? AfflictionStore.getAffliction(token, afflictionId)
        : AfflictionStore.getAfflictionForActor(actor, afflictionId);
      if (!affliction) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_NOT_FOUND'));
        return;
      }

      const AfflictionDefinitionStore = await import('../stores/AfflictionDefinitionStore.js');
      const key = AfflictionDefinitionStore.generateDefinitionKey(affliction);
      const editedDef = AfflictionDefinitionStore.getEditedDefinition(key);
      if (editedDef) {
        const { AfflictionEditorService } = await import('../services/AfflictionEditorService.js');
        affliction = AfflictionEditorService.applyEditedDefinition(affliction, editedDef);
      }

      const currentDC = affliction.dc || dc;

      const { StoryframeIntegrationService } = await import('../services/StoryframeIntegrationService.js');
      const sentToStoryframe = token
        ? await StoryframeIntegrationService.sendSaveRequest(token, affliction, 'stage')
        : false;

      if (sentToStoryframe) {
        btn.disabled = true;
        return;
      }

      let rollMessageId = null;
      Hooks.once('createChatMessage', (message) => {
        if (message.actor?.id === actor.id && getSystemFlags(message)?.context?.type === 'saving-throw') {
          rollMessageId = message.id;
        }
      });

      const stageRollOptions = { dc: { value: currentDC } };
      if (actor.type === 'npc') {
        stageRollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;
      }

      const saveKey = affliction.saveType || 'fortitude';
      await actor.saves[saveKey].roll(stageRollOptions);

      await new Promise(resolve => setTimeout(resolve, 100));

      if (!rollMessageId) {
        rollMessageId = game.messages.contents[game.messages.contents.length - 1]?.id;
      }

      const { SocketService } = await import('../services/SocketService.js');
      await SocketService.requestHandleSave(tokenId, afflictionId, rollMessageId, currentDC, actorId);

      btn.disabled = true;

      const messageElement = btn.closest('.message');
      const msgId = messageElement?.dataset.messageId;
      if (msgId) {
        const { SocketService } = await import('../services/SocketService.js');
        await SocketService.syncButtonState(msgId, btn.className, true);
      }

      if (game.user.isGM && !btn.nextElementSibling?.classList.contains('affliction-unlock-save')) {
        const unlockBtn = document.createElement('button');
        unlockBtn.className = 'affliction-unlock-save';
        unlockBtn.style.cssText = 'display: inline-block; margin-left: 8px; padding: 4px 8px; background: #555; border: 1px solid #777; color: #ffd700; border-radius: 4px; cursor: pointer; font-size: 11px; vertical-align: middle;';
        unlockBtn.innerHTML = `<i class="fas fa-unlock"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.UNLOCK')}`;

        unlockBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const messageElement = btn.closest('.message');
          const messageId = messageElement?.dataset.messageId;

          if (messageId) {
            const { SocketService } = await import('../services/SocketService.js');
            await SocketService.unlockSaveButton(messageId, btn.className);
            unlockBtn.remove();
          } else {
            console.error('Could not find message ID for unlock');
          }
        });

        btn.insertAdjacentElement('afterend', unlockBtn);
      }
    });
  });
}

function registerConfirmationButtons(root) {
  const confirmSaveButtons = root.querySelectorAll('.affliction-confirm-save');
  confirmSaveButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      const tokenId = btn.dataset.tokenId;
      const actorId = btn.dataset.actorId;
      const afflictionId = btn.dataset.afflictionId;
      const rollMessageId = btn.dataset.rollMessageId;
      const dc = parseInt(btn.dataset.dc);
      const saveType = btn.dataset.saveType;

      const { SocketService } = await import('../services/SocketService.js');
      await SocketService.requestApplySaveConsequences(tokenId, afflictionId, rollMessageId, dc, saveType, actorId);

      btn.disabled = true;
      btn.textContent = game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLIED');
      btn.style.opacity = '0.5';
    });
  });
}

function registerReferencedSaveButtons(root) {
  const buttons = root.querySelectorAll('.affliction-roll-referenced-save');
  buttons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      const tokenId = btn.dataset.tokenId;
      const dc = parseInt(btn.dataset.dc);
      const saveType = btn.dataset.saveType || 'fortitude';
      const refData = JSON.parse(decodeURIComponent(btn.dataset.refData));

      const token = tokenId ? canvas.tokens.get(tokenId) : null;
      const actor = token?.actor;
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
        return;
      }

      // Roll the save
      const isNpc = actor.type === 'npc';
      const rollOptions = { dc: { value: dc } };
      if (isNpc) rollOptions.rollMode = CONST.DICE_ROLL_MODES.BLIND;

      let rollMessage = null;
      Hooks.once('createChatMessage', (message) => {
        if (message.actor?.id === actor.id && getSystemFlags(message)?.context?.type === 'saving-throw') {
          rollMessage = message;
        }
      });

      await actor.saves[saveType].roll(rollOptions);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!rollMessage) {
        rollMessage = game.messages.contents[game.messages.contents.length - 1];
      }

      // Determine degree of success
      const { AfflictionService } = await import('../services/AfflictionService.js');
      const roll = rollMessage?.rolls?.[0];
      if (!roll) return;

      const dieValue = AfflictionService.getDieValue(roll);
      const degree = AfflictionService.calculateDegreeOfSuccess(roll.total, dc, dieValue);

      await AfflictionService.applyEffectOnlyResult(token, refData, degree);

      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';

      const { DEGREE_OF_SUCCESS } = await import('../constants.js');
      const success = degree === DEGREE_OF_SUCCESS.CRITICAL_SUCCESS || degree === DEGREE_OF_SUCCESS.SUCCESS;
      btn.innerHTML = success
        ? `<i class="fas fa-shield-alt"></i> ${game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.REFERENCED_RESISTED', { tokenName: token.name, afflictionName: refData.name })}`
        : `<i class="fas fa-skull-crossbones"></i> ${game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.REFERENCED_AFFLICTED', { tokenName: token.name, afflictionName: refData.name })}`;
    });
  });
}

export async function injectConfirmationButton(message, root) {
  if (!game.user.isGM) return;

  if (!message.flags?.['pf2e-afflictioner']?.needsConfirmation) return;

  if (root.querySelector('.affliction-confirm-save')) return;

  const flags = message.flags['pf2e-afflictioner'];
  const { tokenId, actorId, afflictionId, saveType, dc } = flags;

  const { AfflictionService } = await import('../services/AfflictionService.js');
  const roll = message.rolls?.[0];
  if (!roll) return;

  const saveTotal = roll.total;
  const dieValue = AfflictionService.getDieValue(message);
  const token = canvas?.tokens?.get(tokenId);
  const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
  const affliction = token
    ? AfflictionStore.getAffliction(token, afflictionId)
    : (actor ? AfflictionStore.getAfflictionForActor(actor, afflictionId) : null);
  const degreeResult = AfflictionService.calculateAfflictionDegreeResult(saveTotal, dc, dieValue, actor, affliction);
  const degreeConstant = degreeResult.degree;

  const { DEGREE_OF_SUCCESS } = await import('../constants.js');
  const degreeMap = {
    [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: DEGREE_OF_SUCCESS.CRITICAL_SUCCESS,
    [DEGREE_OF_SUCCESS.SUCCESS]: DEGREE_OF_SUCCESS.SUCCESS,
    [DEGREE_OF_SUCCESS.FAILURE]: DEGREE_OF_SUCCESS.FAILURE,
    [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: DEGREE_OF_SUCCESS.CRITICAL_FAILURE
  };
  const degree = degreeMap[degreeConstant] || DEGREE_OF_SUCCESS.FAILURE;

  const colorScheme = {
    [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: {
      gradient: 'linear-gradient(135deg, rgb(0, 180, 0) 0%, rgb(0, 128, 0) 100%)',
      border: 'rgb(0, 200, 0)',
      glow: 'rgba(0, 255, 0, 0.4)'
    },
    [DEGREE_OF_SUCCESS.SUCCESS]: {
      gradient: 'linear-gradient(135deg, rgb(50, 100, 255) 0%, rgb(0, 0, 200) 100%)',
      border: 'rgb(0, 100, 255)',
      glow: 'rgba(0, 100, 255, 0.4)'
    },
    [DEGREE_OF_SUCCESS.FAILURE]: {
      gradient: 'linear-gradient(135deg, rgb(255, 120, 50) 0%, rgb(255, 69, 0) 100%)',
      border: 'rgb(255, 100, 0)',
      glow: 'rgba(255, 100, 0, 0.4)'
    },
    [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: {
      gradient: 'linear-gradient(135deg, rgb(255, 50, 50) 0%, rgb(200, 0, 0) 100%)',
      border: 'rgb(255, 0, 0)',
      glow: 'rgba(255, 0, 0, 0.4)'
    }
  };

  // Blowgun Poisoner: degrade the displayed degree for initial saves
  let effectiveDegree = degree;
  let blowgunPoisonerActive = false;
  if (saveType === 'initial') {
    if (affliction) {
      if (affliction?.blowgunPoisonerCrit) {
        const { FeatsService } = await import('../services/FeatsService.js');
        const degraded = FeatsService.degradeDegree(degree);
        if (degraded !== degree) {
          effectiveDegree = degraded;
          blowgunPoisonerActive = true;
        }
      }
    }
  }

  // Pernicious Poison: show indicator on initial saves when target succeeds
  let perniciousPoisonActive = false;
  if (saveType === 'initial' && effectiveDegree === DEGREE_OF_SUCCESS.SUCCESS) {
    if (affliction?.perniciousPoisonLevel > 0) {
      perniciousPoisonActive = true;
    }
  }

  // Fast Recovery: show extra stage-reduction indicator on stage saves
  let fastRecoveryStages = 0;
  if (saveType === 'stage') {
    if (affliction) {
      const { FeatsService } = await import('../services/FeatsService.js');
      if (FeatsService.hasFastRecovery(actor)) {
        const frChange = FeatsService.getFastRecoveryStageChange(degree, affliction.isVirulent);
        if (frChange !== null) fastRecoveryStages = Math.abs(frChange);
      }
    }
  }

  const colors = colorScheme[effectiveDegree];

  const messageContent = root.querySelector('.message-content');
  if (!messageContent) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin-top: 8px; padding-top: 8px;';

  const button = document.createElement('button');
  button.className = 'affliction-confirm-save';
  button.dataset.tokenId = tokenId;
  button.dataset.afflictionId = afflictionId;
  button.dataset.rollMessageId = message.id;
  button.dataset.dc = dc;
  button.dataset.saveType = saveType;
  if (actorId) button.dataset.actorId = actorId;
  button.style.cssText = `
    width: 100%;
    padding: 10px;
    background: ${colors.gradient};
    border: 2px solid ${colors.border};
    color: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
    margin-top: 4px;
    box-shadow: 0 3px 8px rgba(0,0,0,0.3), 0 0 15px ${colors.glow};
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;

  const degreeLabels = {
    [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.CRITICAL_SUCCESS'),
    [DEGREE_OF_SUCCESS.SUCCESS]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.SUCCESS'),
    [DEGREE_OF_SUCCESS.FAILURE]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.FAILURE'),
    [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.CRITICAL_FAILURE'),
  };
  const infoHtml = blowgunPoisonerActive
    ? ` <i class="fas fa-info-circle" style="margin-left:5px;font-size:12px;opacity:0.9;pointer-events:all;" data-tooltip="${game.i18n.format('PF2E_AFFLICTIONER.FEATS.BLOWGUN_POISONER_DEGRADED_TOOLTIP', { to: degreeLabels[effectiveDegree] })}"></i>`
    : '';
  const incapacitationInfoHtml = degreeResult.incapacitationApplied
    ? ` <i class="fas fa-arrow-up" style="margin-left:5px;font-size:12px;opacity:0.9;pointer-events:all;color:#ffd166;" data-tooltip="${game.i18n.format('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INCAPACITATION_UPGRADED', { from: degreeLabels[degreeResult.rawDegree], to: degreeLabels[degreeResult.degree] })}"></i>`
    : '';
  const frInfoHtml = fastRecoveryStages > 0
    ? ` <i class="fas fa-bolt" style="margin-left:5px;font-size:12px;opacity:0.9;pointer-events:all;color:#90ee90;" data-tooltip="${game.i18n.format('PF2E_AFFLICTIONER.FEATS.FAST_RECOVERY_BUTTON_TOOLTIP', { stages: fastRecoveryStages })}"></i>`
    : '';
  const ppInfoHtml = perniciousPoisonActive
    ? ` <i class="fas fa-skull-crossbones" style="margin-left:5px;font-size:12px;opacity:0.9;pointer-events:all;color:#b19cd9;" data-tooltip="${game.i18n.localize('PF2E_AFFLICTIONER.FEATS.PERNICIOUS_POISON_BUTTON_TOOLTIP')}"></i>`
    : '';
  button.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_CONSEQUENCES')}${infoHtml}${incapacitationInfoHtml}${frInfoHtml}${ppInfoHtml}`;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
    button.style.boxShadow = `0 5px 12px rgba(0,0,0,0.4), 0 0 25px ${colors.glow}`;
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = `0 3px 8px rgba(0,0,0,0.3), 0 0 15px ${colors.glow}`;
  });

  button.addEventListener('mousedown', () => {
    button.style.transform = 'translateY(1px)';
  });

  button.addEventListener('mouseup', () => {
    button.style.transform = 'translateY(-1px)';
  });

  button.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    const { SocketService } = await import('../services/SocketService.js');
    await SocketService.requestApplySaveConsequences(
      btn.dataset.tokenId,
      btn.dataset.afflictionId,
      btn.dataset.rollMessageId,
      parseInt(btn.dataset.dc),
      btn.dataset.saveType,
      btn.dataset.actorId
    );

    btn.disabled = true;
    btn.textContent = game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLIED');
    btn.style.opacity = '0.5';
  });

  if (degreeResult.incapacitationApplied) {
    const note = document.createElement('p');
    note.style.cssText = 'margin: 4px 0 8px 0; padding: 6px 8px; font-size: 0.85em; color: #ffd166; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,209,102,0.45); border-radius: 4px;';
    note.innerHTML = `<i class="fas fa-arrow-up"></i> ${game.i18n.format('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INCAPACITATION_UPGRADED', { from: degreeLabels[degreeResult.rawDegree], to: degreeLabels[degreeResult.degree] })}`;
    buttonContainer.appendChild(note);
  }

  buttonContainer.appendChild(button);
  messageContent.appendChild(buttonContainer);

  setTimeout(() => {
    ui.chat?.scrollBottom();
  }, 100);
}
