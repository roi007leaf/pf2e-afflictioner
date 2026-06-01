import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionService } from '../services/AfflictionService.js';
import { AfflictionParser } from '../services/AfflictionParser.js';
import { applyMessageAfflictionContext, shouldSkipPromptAffliction } from '../utils.js';
import { AfflictionItemResolver } from '../services/AfflictionItemResolver.js';
import { FeatsService } from '../services/FeatsService.js';
import { getSystemFlags } from '../systemCompat.js';
import { DEGREE_OF_SUCCESS } from '../constants.js';

export function registerAfflictionButtonHandlers(root, message) {
  registerDamageButtons(root);
  registerTargetButtons(root);

  if (message) {
    addApplyAfflictionButton(message, root);
    addApplyAfflictionToSelectedButton(message, root);
    addAfflictionDragSupport(message, root);
  }
}

function registerDamageButtons(root) {
  const rollDamageButtons = root.querySelectorAll('.affliction-roll-damage');
  rollDamageButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      const tokenId = btn.dataset.tokenId;
      const actorId = btn.dataset.actorId;
      const afflictionId = btn.dataset.afflictionId;

      let token = tokenId ? canvas.tokens.get(tokenId) : null;
      if (!token && actorId) {
        token = AfflictionStore.findTokenForActor(game.actors.get(actorId));
      }
      if (!token) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
        return;
      }

      const affliction = AfflictionStore.getAffliction(token, afflictionId);
      if (!affliction) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_NOT_FOUND'));
        return;
      }

      const currentStageIndex = affliction.currentStage - 1;
      if (currentStageIndex < 0 || !affliction.stages || !affliction.stages[currentStageIndex]) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.NO_ACTIVE_STAGE'));
        return;
      }

      const stage = affliction.stages[currentStageIndex];
      const actor = token.actor;

      if (!stage.damage || stage.damage.length === 0) {
        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.NO_DAMAGE_TO_ROLL', { name: affliction.name, stage: affliction.currentStage }));
        return;
      }

      for (const damageEntry of stage.damage) {
        try {
          const formula = typeof damageEntry === 'string' ? damageEntry : damageEntry.formula;
          const type = typeof damageEntry === 'object' ? damageEntry.type : 'untyped';

          if (!formula || formula.trim() === '') {
            continue;
          }

          const cleanFormula = formula.trim().replace(/\[.*$/, '');

          const damageRoll = await new Roll(cleanFormula).evaluate({ async: true });

          const enrichedFlavor = type !== 'untyped'
            ? `${affliction.name} - Stage ${affliction.currentStage}: @Damage[${cleanFormula}[${type}]]`
            : `${affliction.name} - Stage ${affliction.currentStage}: @Damage[${cleanFormula}]`;

          await damageRoll.toMessage({
            speaker: ChatMessage.getSpeaker({ token: token }),
            flavor: enrichedFlavor
          });

          ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.ROLLED_DAMAGE', { total: damageRoll.total, tokenName: token.name }));
        } catch (error) {
          console.error('PF2e Afflictioner | Error rolling damage:', error);
          const displayFormula = typeof damageEntry === 'string' ? damageEntry : damageEntry.formula;
          ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.FAILED_ROLL_DAMAGE', { formula: displayFormula }));
        }
      }

      btn.disabled = true;
    });
  });
}

function registerTargetButtons(root) {
  const targetTokenButtons = root.querySelectorAll('.affliction-target-token');
  targetTokenButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      const tokenId = btn.dataset.tokenId;
      const actorId = btn.dataset.actorId;

      let token = tokenId ? canvas.tokens.get(tokenId) : null;
      if (!token && actorId) {
        token = AfflictionStore.findTokenForActor(game.actors.get(actorId));
      }
      if (!token) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
        return;
      }

      token.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });

      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.TARGETED', { tokenName: token.name }));
    });
  });
}

async function addApplyAfflictionButton(message, htmlElement) {
  if (!game.user.isGM) return;

  if (htmlElement.dataset.applyAfflictionEnabled === 'true') return;

  const notes = getSystemFlags(message)?.context?.notes || [];

  let afflictionNote = notes.find(note => {
    const text = note.text || '';
    return text.includes('Saving Throw') && (text.includes('Stage 1') || text.includes('Stage 2'));
  });

  if (!afflictionNote) {
    const actor = message.actor;
    if (actor) {
      afflictionNote = notes.find(note => {
        if (!note.title) return false;
        const item = actor.items.find(i => {
          if (i.name === note.title) {
            const traits = i.system?.traits?.value || [];
            return traits.includes('curse') || traits.includes('poison') || traits.includes('disease');
          }
          return false;
        });
        return !!item;
      });
    }
  }

  if (!afflictionNote) return;

  const target = getSystemFlags(message)?.context?.target;
  if (!target?.token) return;

  htmlElement.dataset.applyAfflictionEnabled = 'true';

  const actor = message.actor;
  if (!actor) return;

  let item = actor.items.find(i => {
    if (i.name === afflictionNote.title) {
      const traits = i.system?.traits?.value || [];
      return traits.includes('poison') || traits.includes('disease') || traits.includes('curse');
    }
    return false;
  });

  if (!item) return;

  const afflictionData = await AfflictionItemResolver.resolveFromItem(item);
  if (!afflictionData || shouldSkipPromptAffliction(afflictionData)) return;

  // Store the origin actor so referenced afflictions can look up items on it later
  afflictionData.originActorUuid = actor.uuid;
  afflictionData.originActorId = actor.id || afflictionData.originActorId || null;
  AfflictionService.applyOriginActorMetadata(afflictionData, actor);

  // Always prefer DC and save type from the note — they're computed at roll time with elite/weak adjustments applied
  const noteDcMatch = afflictionNote.text?.match(/data-pf2-dc="(\d+)"/i);
  if (noteDcMatch) {
    afflictionData.dc = parseInt(noteDcMatch[1]);
  }

  const noteSaveMatch = afflictionNote.text?.match(/data-pf2-check="(\w+)"/i);
  if (noteSaveMatch) {
    const noteType = noteSaveMatch[1].toLowerCase();
    if (['fortitude', 'reflex', 'will'].includes(noteType)) {
      afflictionData.saveType = noteType;
    }
  }

  applyMessageAfflictionContext(afflictionData, message);

  // Blowgun Poisoner: degrade the target's initial save if the attacker critically hit with a blowgun
  const attackOutcome = getSystemFlags(message)?.context?.outcome;
  const attackOptions = getSystemFlags(message)?.context?.options ?? [];
  const isBlowgunAttack = attackOptions.some(opt => typeof opt === 'string' && opt.includes('blowgun'));
  if (
    attackOutcome === DEGREE_OF_SUCCESS.CRITICAL_SUCCESS &&
    isBlowgunAttack &&
    FeatsService.hasBlowgunPoisoner(actor)
  ) {
    afflictionData.blowgunPoisonerCrit = true;
  }

  const allRollNotes = htmlElement.querySelectorAll('.roll-note');
  const rollNote = allRollNotes[allRollNotes.length - 1];
  if (!rollNote) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'affliction-apply-container';
  buttonContainer.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(139, 0, 0, 0.3);';

  const button = document.createElement('button');
  button.className = 'affliction-apply-to-target';
  button.style.cssText = 'width: 100%; padding: 8px; background: var(--afflictioner-primary, #8b0000); border: 2px solid var(--afflictioner-primary-hover, #a00000); color: white; border-radius: 6px; cursor: pointer; font-weight: bold;';
  button.innerHTML = `<i class="fas fa-biohazard"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_TO_TARGET')}`;
  button.dataset.targetToken = target.token;
  button.dataset.itemUuid = item.uuid;

  button.addEventListener('click', async () => {
    try {
      // If the user has exactly one token targeted at click time, use it — this allows
      // redirecting the affliction to a Guardian who used Intercept Attack.
      const currentTargets = Array.from(game.user.targets);
      let token;
      if (currentTargets.length === 1) {
        token = currentTargets[0];
      } else {
        const targetTokenDoc = await fromUuid(target.token);
        if (!targetTokenDoc) {
          ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
          return;
        }
        token = targetTokenDoc.object;
        if (!token) {
          ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
          return;
        }
      }

      await AfflictionService.promptInitialSave(token, afflictionData);

      button.disabled = true;
      button.innerHTML = `<i class="fas fa-check-circle"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLIED')}`;
      button.style.opacity = '0.5';
      button.style.cursor = 'default';
    } catch (error) {
      console.error('PF2e Afflictioner | Error applying affliction:', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ERROR_ADDING_AFFLICTION'));
    }
  });

  buttonContainer.appendChild(button);
  rollNote.appendChild(buttonContainer);
}

async function addApplyAfflictionToSelectedButton(message, htmlElement) {
  if (!game.user.isGM) return;

  if (htmlElement.dataset.applyAfflictionToSelectedEnabled === 'true') {
    return;
  }

  const itemUuid = getSystemFlags(message)?.origin?.uuid;

  if (!itemUuid) {
    return;
  }

  if (getSystemFlags(message)?.context?.target?.token) {
    return;
  }

  let item;
  try {
    item = await fromUuid(itemUuid);
  } catch (error) {
    // ignore — will try fallbacks below
  }

  // Fallback to embedded spell data from casting flags (e.g. consumed scrolls/wands)
  if (!item) {
    const embedded = getSystemFlags(message)?.casting?.embeddedSpell;
    if (embedded?.system) {
      item = embedded;
    }
  }

  // Fallback: build synthetic item from message content and origin rollOptions
  // Handles item activations where the item can't be resolved and no embedded spell exists
  if (!item) {
    item = buildSyntheticItemFromMessage(message);
  }

  if (!item) return;

  let afflictionData = await AfflictionItemResolver.resolveFromItem(item);

  // If item-based parsing failed, try parsing from message content directly
  if ((!afflictionData || shouldSkipPromptAffliction(afflictionData)) && message.content) {
    const contentItem = buildSyntheticItemFromMessage(message);
    if (contentItem) {
      afflictionData = await AfflictionItemResolver.resolveFromItem(contentItem, { originActor: message.actor || item.parent });
    }
  }

  if (!afflictionData || shouldSkipPromptAffliction(afflictionData)) {
    return;
  }

  // Store the origin actor so referenced afflictions can look up items on it later
  const originActorUuid = getSystemFlags(message)?.origin?.actor || message.actor?.uuid || null;
  if (originActorUuid) afflictionData.originActorUuid = originActorUuid;
  if (message.actor?.id || item.parent?.id) {
    afflictionData.originActorId = message.actor?.id || item.parent?.id;
  }
  AfflictionService.applyOriginActorMetadata(afflictionData, message.actor || item.parent);

  // Spell/action chat cards carry computed DCs after elite/weak and spellcasting adjustments.
  applyMessageAfflictionContext(afflictionData, message);

  htmlElement.dataset.applyAfflictionToSelectedEnabled = 'true';

  const messageContent = htmlElement.querySelector('.message-content') || htmlElement.querySelector('.card-content');
  if (!messageContent) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'affliction-apply-container';
  buttonContainer.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(139, 0, 0, 0.3);';

  const button = document.createElement('button');
  button.className = 'affliction-apply-to-selected';
  button.style.cssText = 'width: 100%; padding: 8px; background: var(--afflictioner-primary, #8b0000); border: 2px solid var(--afflictioner-primary-hover, #a00000); color: white; border-radius: 6px; cursor: pointer; font-weight: bold;';
  button.innerHTML = `<i class="fas fa-biohazard"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_TO_SELECTED')}`;

  button.addEventListener('click', async () => {
    try {
      let tokens = Array.from(game.user.targets);
      if (!tokens.length) {
        tokens = canvas.tokens.controlled;
      }
      if (!tokens.length) {
        ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.SELECT_TOKEN_FIRST'));
        return;
      }

      for (const token of tokens) {
        await AfflictionService.promptInitialSave(token, afflictionData);
      }

      button.disabled = true;
      button.textContent = game.i18n.format('PF2E_AFFLICTIONER.BUTTONS.APPLIED_COUNT', { count: tokens.length });
      button.style.opacity = '0.5';
    } catch (error) {
      console.error('PF2e Afflictioner | Error applying affliction:', error);
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ERROR_ADDING_AFFLICTION'));
    }
  });

  buttonContainer.appendChild(button);
  messageContent.appendChild(buttonContainer);
}

async function addAfflictionDragSupport(message, htmlElement) {
  if (!game.user.isGM) return;

  if (htmlElement.dataset.afflictionDragEnabled === 'true') return;

  const item = message.getAssociatedItem?.();
  if (!item) return;

  const afflictionData = await AfflictionItemResolver.resolveFromItem(item);
  if (!afflictionData || shouldSkipPromptAffliction(afflictionData)) return;

  htmlElement.dataset.afflictionDragEnabled = 'true';

  htmlElement.setAttribute('draggable', 'true');
  htmlElement.style.cursor = 'grab';

  const contentElement = htmlElement.querySelector('.message-content');
  if (contentElement && !contentElement.querySelector('.affliction-drag-hint')) {
    const dragHint = document.createElement('div');
    dragHint.className = 'affliction-drag-hint';
    dragHint.innerHTML = `<i class="fas fa-hand-rock"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.DRAG_HINT')}`;
    contentElement.appendChild(dragHint);
  }

  const onDragStart = (event) => {
    htmlElement.style.cursor = 'grabbing';

    const dragData = {
      type: 'Affliction',
      afflictionData: afflictionData,
      itemUuid: item.uuid
    };

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onDragEnd = () => {
    htmlElement.style.cursor = 'grab';
  };

  htmlElement.addEventListener('dragstart', onDragStart);
  htmlElement.addEventListener('dragend', onDragEnd);
}

/**
 * Build a synthetic item-like object from message content and origin rollOptions.
 * Used as a fallback when the actual item can't be resolved (consumed scrolls/wands,
 * item activations without embedded spell data).
 */
function buildSyntheticItemFromMessage(message) {
  const content = message.content;
  if (!content) return null;

  const rollOptions = getSystemFlags(message)?.origin?.rollOptions || [];
  let traits = rollOptions
    .filter(o => o.startsWith('origin:item:trait:'))
    .map(o => o.replace('origin:item:trait:', ''));

  if (!traits.includes('poison') && !traits.includes('disease') && !traits.includes('curse')) {
    const traitMatches = [...content.matchAll(/data-trait=["']([^"']+)["']/gi)].map(match => match[1]);
    traits = [...new Set(traitMatches)];
  }

  if (!traits.includes('poison') && !traits.includes('disease') && !traits.includes('curse')) {
    traits = AfflictionParser.extractReferencedAfflictions(content).length > 0 ? ['curse'] : traits;
  }

  if (!traits.includes('poison') && !traits.includes('disease') && !traits.includes('curse')) {
    return null;
  }

  // Extract name from the card header: <h3>Spider Sting <span ...>2</span></h3>
  const nameMatch = content.match(/<h3>([^<]+?)(?:\s*<span[^>]*>[^<]*<\/span>)?\s*<\/h3>/);

  return {
    name: nameMatch ? nameMatch[1].trim() : 'Unknown',
    uuid: getSystemFlags(message)?.origin?.uuid,
    system: {
      traits: { value: traits },
      description: { value: content },
      level: { value: 0 },
      defense: { save: {} }
    }
  };
}
