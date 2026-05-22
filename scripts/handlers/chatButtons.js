import { registerSaveButtonHandlers, injectConfirmationButton } from './saveButtons.js';
import { registerAfflictionButtonHandlers } from './afflictionButtons.js';
import { registerTreatmentButtonHandlers, addTreatmentAfflictionSelection } from './treatmentButtons.js';
import { registerCounteractButtonHandlers, addCounteractAfflictionSelection, injectCounteractConfirmButton } from './counteractButtons.js';
import { VishkanyaService } from '../services/VishkanyaService.js';
import { getSystemFlags } from '../systemCompat.js';
import { MODULE_ID } from '../constants.js';

export function onRenderChatMessage(message, html) {
  const root = html?.jquery ? html[0] : html;
  if (!root) return;

  injectConfirmationButton(message, root);
  injectCounteractConfirmButton(message, root);
  injectHazardAfflictionButton(message, root);
  injectItemCardAfflictionButton(message, root);

  registerSaveButtonHandlers(root);
  registerAfflictionButtonHandlers(root, message);
  registerTreatmentButtonHandlers(root);
  registerCounteractButtonHandlers(root);

  addTreatmentAfflictionSelection(message, root);
  addCounteractAfflictionSelection(message, root);

  registerMaxDurationRemovalHandler(root);
  registerDeathConfirmationHandler(root);
  registerApplyWeaponPoisonHandler(root);
  registerApplyWeaponInjectionHandler(root);

  injectCoatWeaponButton(message, root);
}

function injectHazardAfflictionButton(message, root) {
  if (!game.user.isGM) return;
  if (root.dataset.hazardAfflictionInjected === 'true') return;

  const flagData = message.getFlag(MODULE_ID, 'hazardAffliction');
  if (!flagData) return;

  const { afflictionData, targets } = flagData;
  const i = game.i18n;
  const K = 'PF2E_AFFLICTIONER.WEAPON_COATING';

  // Insert after .chat-buttons (not inside it) so PF2e system styles don't override ours
  const chatButtons = root.querySelector('.chat-buttons');
  const parent = chatButtons?.parentElement ?? root.querySelector('.message-content') ?? root;

  for (const target of targets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pf2e-afflictioner-apply-weapon-poison pf2e-afflictioner-apply-hazard-btn';
    btn.dataset.targetTokenId = target.tokenId;
    btn.dataset.afflictionData = encodeURIComponent(JSON.stringify(afflictionData));
    btn.innerHTML = `<i class="fas fa-biohazard"></i> ${i.format(`${K}.HIT_APPLY_BTN`, { targetName: target.name })}`;
    if (chatButtons) {
      chatButtons.insertAdjacentElement('afterend', btn);
    } else {
      parent.appendChild(btn);
    }
  }

  root.dataset.hazardAfflictionInjected = 'true';
}

function registerApplyWeaponPoisonHandler(root) {
  const btn = root.querySelector('.pf2e-afflictioner-apply-weapon-poison');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const targetTokenId = btn.dataset.targetTokenId;
    const actorId = btn.dataset.actorId;
    const weaponId = btn.dataset.weaponId;
    const afflictionData = JSON.parse(decodeURIComponent(btn.dataset.afflictionData));

    const target = canvas.tokens.get(targetTokenId);
    if (!target) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.TARGET_NOT_FOUND'));
      return;
    }

    if (actorId && weaponId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const stickyPoisonSuccess = btn.dataset.stickyPoisonSuccess === 'true';
        if (stickyPoisonSuccess) {
          const { updateCoating } = await import('../stores/WeaponCoatingStore.js');
          const combat = game.combat;
          await updateCoating(actor, weaponId, {
            expirationMode: 'end-next-turn',
            appliedRound: combat?.started ? combat.round : null
          });
        } else {
          const { removeCoating } = await import('../stores/WeaponCoatingStore.js');
          await removeCoating(actor, weaponId);
        }
        const { AfflictionManager } = await import('../managers/AfflictionManager.js');
        if (AfflictionManager.currentInstance) AfflictionManager.currentInstance.render({ force: true });
      }
    }

    const { AfflictionService } = await import('../services/AfflictionService.js');
    await AfflictionService.promptInitialSave(target, afflictionData);

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.SAVE_PROMPTED')}`;
  });
}

function registerApplyWeaponInjectionHandler(root) {
  const btn = root.querySelector('.pf2e-afflictioner-inject-weapon-poison');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const targetTokenId = btn.dataset.targetTokenId;
    const actorId = btn.dataset.actorId;
    const weaponId = btn.dataset.weaponId;
    const afflictionData = JSON.parse(decodeURIComponent(btn.dataset.afflictionData));

    const target = canvas.tokens.get(targetTokenId);
    if (!target) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.TARGET_NOT_FOUND'));
      return;
    }

    if (actorId && weaponId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const { removeInjection } = await import('../stores/WeaponCoatingStore.js');
        await removeInjection(actor, weaponId);
        const { AfflictionManager } = await import('../managers/AfflictionManager.js');
        if (AfflictionManager.currentInstance) AfflictionManager.currentInstance.render({ force: true });
      }
    }

    const { AfflictionService } = await import('../services/AfflictionService.js');
    await AfflictionService.promptInitialSave(target, afflictionData);

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.SAVE_PROMPTED')}`;
  });
}

async function injectCoatWeaponButton(message, root) {
  const speakerActor = message.speaker?.actor ? game.actors.get(message.speaker.actor) : null;
  if (!game.user.isGM && !speakerActor?.isOwner) return;

  // Prevent double-injection on re-renders
  if (root.dataset.coatWeaponInjected === 'true') return;

  const itemUuid = getSystemFlags(message)?.origin?.uuid;
  if (!itemUuid) return;

  let item;
  try {
    item = await fromUuid(itemUuid);
  } catch {
    return;
  }
  if (!item) return;

  const traits = item.system?.traits?.value || [];
  const isInjuryPoison = traits.includes('injury');
  const isEnvenom = VishkanyaService.isEnvenomItem(item);
  const isFieldVial = item.system?.slug === 'versatile-vial' && traits.includes('poison');

  if (!isInjuryPoison && !isEnvenom && !isFieldVial) return;

  const speakerActorId = message.speaker?.actor;
  const speakerTokenId = message.speaker?.token;

  const footer = root.querySelector('.card-footer, .chat-card footer, .item-card footer');
  const container = footer || root.querySelector('.chat-card, .item-card') || root;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pf2e-afflictioner-coat-weapon-btn';
  btn.innerHTML = `<i class="fas fa-flask"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.COAT_WEAPON_BTN')}`;

  const injectBtn = isInjuryPoison && document.createElement('button');
  if (injectBtn) {
    injectBtn.type = 'button';
    injectBtn.className = 'pf2e-afflictioner-load-injection-btn';
    injectBtn.dataset.itemUuid = itemUuid;
    injectBtn.innerHTML = `<i class="fas fa-syringe"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.LOAD_INJECTION_BTN')}`;
    injectBtn.addEventListener('click', async () => {
      const targetTokenIds = [...game.user.targets].map(t => t.id);
      const { WeaponCoatingService } = await import('../services/WeaponCoatingService.js');
      const loaded = await WeaponCoatingService.openInjectionLoadDialog(itemUuid, speakerActorId, speakerTokenId, targetTokenIds);
      if (loaded) {
        injectBtn.disabled = true;
        injectBtn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.LOAD_INJECTION_DONE')}`;
      }
    });
  }

  if (isEnvenom) {
    const actor = speakerActorId ? game.actors.get(speakerActorId) : null;
    if (!actor) return;

    const afflictionData = VishkanyaService.buildVenomAfflictionData(actor);
    btn.dataset.envenomData = encodeURIComponent(JSON.stringify(afflictionData));

    btn.addEventListener('click', async () => {
      const targetTokenIds = [...game.user.targets].map(t => t.id);
      const hasDebilitatingVenom = VishkanyaService.hasDebilitatingVenom(actor);
      const data = JSON.parse(decodeURIComponent(btn.dataset.envenomData));
      const { WeaponCoatingService } = await import('../services/WeaponCoatingService.js');
      const coated = await WeaponCoatingService.openCoatDialogWithData(data, speakerActorId, speakerTokenId, targetTokenIds, { hasDebilitatingVenom });
      if (coated) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.COAT_WEAPON_DONE')}`;
      }
    });
  } else if (isFieldVial) {
    btn.addEventListener('click', async () => {
      const targetTokenIds = [...game.user.targets].map(t => t.id);
      const { WeaponCoatingService } = await import('../services/WeaponCoatingService.js');
      const coated = await WeaponCoatingService.openCoatDialogForFieldVial(item, speakerActorId, speakerTokenId, targetTokenIds);
      if (coated) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.COAT_WEAPON_DONE')}`;
      }
    });
  } else {
    btn.dataset.itemUuid = itemUuid;

    btn.addEventListener('click', async () => {
      const targetTokenIds = [...game.user.targets].map(t => t.id);
      const { WeaponCoatingService } = await import('../services/WeaponCoatingService.js');
      const coated = await WeaponCoatingService.openCoatDialog(itemUuid, speakerActorId, speakerTokenId, targetTokenIds);
      if (coated) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.COAT_WEAPON_DONE')}`;
      }
    });
  }

  root.dataset.coatWeaponInjected = 'true';
  container.appendChild(btn);
  if (injectBtn) container.appendChild(injectBtn);
}

async function injectItemCardAfflictionButton(message, root) {
  if (!game.user.isGM) return;
  if (root.dataset.itemAfflictionInjected === 'true') return;

  // Only item card messages
  if (!root.querySelector('.pf2e.item-card, .pf2e.chat-card.item-card')) return;

  const flags = getSystemFlags(message);
  const originUuid = flags?.origin?.uuid;
  if (!originUuid) return;

  let item;
  try {
    item = await fromUuid(originUuid);
  } catch {
    return;
  }
  if (!item) return;

  const { AfflictionItemResolver } = await import('../services/AfflictionItemResolver.js');
  const { applyMessageAfflictionContext, shouldSkipPromptAffliction } = await import('../utils.js');
  const afflictionData = await AfflictionItemResolver.resolveFromItem(item);
  if (!afflictionData || shouldSkipPromptAffliction(afflictionData)) return;
  afflictionData.originActorUuid = item.parent?.uuid || flags.origin?.actor || null;
  afflictionData.originActorId = item.parent?.id || message.speaker?.actor || null;
  applyMessageAfflictionContext(afflictionData, message);

  root.dataset.itemAfflictionInjected = 'true';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pf2e-afflictioner-apply-item-affliction';
  btn.innerHTML = `<i class="fas fa-biohazard"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.APPLY_AFFLICTION_BTN')}`;
  btn.dataset.afflictionData = encodeURIComponent(JSON.stringify(afflictionData));

  btn.addEventListener('click', async () => {
    const targets = [...game.user.targets];
    if (!targets.length) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.CHAT.APPLY_AFFLICTION_NO_TARGET'));
      return;
    }
    const { AfflictionService } = await import('../services/AfflictionService.js');
    const data = JSON.parse(decodeURIComponent(btn.dataset.afflictionData));
    for (const target of targets) {
      await AfflictionService.promptInitialSave(target, data);
    }
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.WEAPON_COATING.SAVE_PROMPTED')}`;
  });

  const footer = root.querySelector('.card-footer, .chat-card footer, .item-card footer');
  const container = footer || root.querySelector('.chat-card, .item-card') || root;
  container.appendChild(btn);
}

function registerMaxDurationRemovalHandler(root) {
  const removeBtn = root.querySelector('.pf2e-afflictioner-remove-expired-btn');
  if (!removeBtn) return;

  removeBtn.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const tokenId = button.dataset.tokenId;
    const actorId = button.dataset.actorId;
    const afflictionId = button.dataset.afflictionId;

    const AfflictionStore = await import('../stores/AfflictionStore.js');
    let token = tokenId ? canvas.tokens.get(tokenId) : null;
    if (!token && actorId) {
      token = AfflictionStore.findTokenForActor(game.actors.get(actorId));
    }
    if (!token) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
      return;
    }
    const affliction = AfflictionStore.getAffliction(token, afflictionId);
    if (!affliction) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.AFFLICTION_NOT_FOUND'));
      return;
    }

    const resolved = affliction.currentStageResolvedDuration;
    if (resolved?.value > 0 && affliction.appliedEffectUuid) {
      try {
        const effect = await fromUuid(affliction.appliedEffectUuid);
        if (effect) {
          const unitMap = { round: 'rounds', minute: 'minutes', hour: 'hours', day: 'days', week: 'weeks' };
          await effect.update({
            'system.duration': {
              value: resolved.value,
              unit: unitMap[resolved.unit] || resolved.unit,
              expiry: resolved.unit === 'round' ? 'turn-start' : null,
              sustained: false
            }
          });
        }
      } catch (e) {
        console.error('PF2e Afflictioner | Failed to update effect duration on max duration expiry:', e);
      }
    }

    await AfflictionStore.removeAffliction(token, afflictionId);

    const { VisualService } = await import('../services/VisualService.js');
    await VisualService.removeAfflictionIndicator(token);

    if (resolved?.value > 0) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.REMOVED_FROM_TRACKING_EXPIRES', {
        afflictionName: affliction.name,
        value: resolved.value,
        unit: resolved.unit
      }));
    } else {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.REMOVED_FROM_TRACKING_PERSISTS', {
        afflictionName: affliction.name,
        tokenName: token.name
      }));
    }

    button.disabled = true;
    button.textContent = `✓ ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.AFFLICTION_REMOVED')}`;
  });
}

function registerDeathConfirmationHandler(root) {
  const killBtn = root.querySelector('.pf2e-afflictioner-confirm-kill-btn');
  if (!killBtn) return;

  killBtn.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const tokenId = button.dataset.tokenId;
    const actorId = button.dataset.actorId;
    const afflictionId = button.dataset.afflictionId;

    const AfflictionStore = await import('../stores/AfflictionStore.js');
    let token = tokenId ? canvas.tokens.get(tokenId) : null;
    if (!token && actorId) {
      token = AfflictionStore.findTokenForActor(game.actors.get(actorId));
    }
    if (!token) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.TOKEN_NOT_FOUND'));
      return;
    }

    const actor = token.actor;
    if (!actor) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ACTOR_NOT_FOUND'));
      return;
    }
    const affliction = AfflictionStore.getAffliction(token, afflictionId);

    await actor.update({ 'system.attributes.hp.value': 0 });
    await actor.increaseCondition('dying');
    const dying = actor.getCondition('dying');
    if (dying) {
      const dyingMax = actor.system.attributes?.dying?.max ?? 4;
      await dying.update({ 'system.value.value': dyingMax });
    }

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.KILLED', {
      tokenName: token.name,
      afflictionName: affliction?.name ?? 'Unknown'
    }));

    button.disabled = true;
    button.innerHTML = `<i class="fas fa-skull"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.DEATH_CONFIRMED')}`;
  });
}
