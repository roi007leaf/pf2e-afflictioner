import { MODULE_ID } from '../constants.js';

export class AfflictionChatService {
  static _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static async promptInitialSave(token, affliction, afflictionData, afflictionId) {
    const actor = token?.actor || affliction?.actor;
    const showDCToPlayers = game.pf2e?.settings?.metagame?.dcs ?? true;
    const anonymizeSaves = game.settings.get(MODULE_ID, 'anonymizeSaveMessages') ?? false;
    const gmRollMysteriousSaves = game.settings.get(MODULE_ID, 'gmRollMysteriousSaves') ?? false;

    const isMysterious = this._isAfflictionMysterious(afflictionData);

    if (gmRollMysteriousSaves && isMysterious) {
      const gmContent = `
        <div class="pf2e-afflictioner-save-request" style="border-color: #8b0000; padding: 12px;">
          <h3><i class="fas fa-user-secret"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.GM_SECRET_SAVE_TITLE', { afflictionName: afflictionData.name })}</h3>
          <p><strong>${actor.name}</strong> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.HAS_BEEN_EXPOSED_TO')} <strong>${afflictionData.name}</strong></p>
          <p><strong>${game.i18n.format('PF2E_AFFLICTIONER.CHAT.SAVE_DC', { dc: afflictionData.dc, saveType: this._capitalize(afflictionData.saveType || 'fortitude') })}</strong></p>
          <p><em style="color: #752f00;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_MYSTERIOUS_REASON')}</em></p>
          <p><em style="font-size: 0.9em;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_REASON_PREFIX')} ${afflictionData.onset ? game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_REASON_ONSET') : game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_REASON_NO_EFFECTS')}</em></p>
          <hr>
          <button class="affliction-roll-initial-save"
                  data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''}
                  data-affliction-id="${afflictionId}"
                  data-dc="${afflictionData.dc}"
                  data-blind-roll="true"
                  style="width: 100%; padding: 8px; margin-top: 10px; background: #8b0000;">
            <i class="fas fa-user-secret"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ROLL_BLIND_SAVE', { actorName: actor.name })}
          </button>
        </div>
      `;
      await ChatMessage.create({
        content: gmContent,
        speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
        whisper: game.users.filter(u => u.isGM).map(u => u.id)
      });
      return;
    }

    const { StoryframeIntegrationService } = await import('./StoryframeIntegrationService.js');
    const sentToStoryframe = token
      ? await StoryframeIntegrationService.sendSaveRequest(token, affliction, 'initial')
      : false;

    if (!sentToStoryframe) {
      const playerContent = this._buildInitialSaveMessage(
        actor,
        token,
        afflictionData,
        afflictionId,
        showDCToPlayers,
        anonymizeSaves
      );

      const whisperTargets = actor.hasPlayerOwner
        ? game.users.filter(u => !u.isGM && actor.testUserPermission(u, 'OWNER')).map(u => u.id)
        : game.users.filter(u => u.isGM).map(u => u.id);

      if (whisperTargets.length > 0) {
        await ChatMessage.create({
          content: playerContent,
          speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
          whisper: whisperTargets
        });
      }
    }

    if (!showDCToPlayers && actor.hasPlayerOwner) {
      const gmContent = `
        <div class="pf2e-afflictioner-save-request" style="border-color: #8b0000; padding: 8px;">
          <p style="margin: 0;"><strong>${afflictionData.name} - DC ${afflictionData.dc}</strong> (${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_INFO')})</p>
        </div>
      `;
      await ChatMessage.create({
        content: gmContent,
        speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
        whisper: game.users.filter(u => u.isGM).map(u => u.id)
      });
    }
  }

  static _isAfflictionMysterious(afflictionData) {
    if (afflictionData.onset) {
      return true;
    }

    const stage1 = afflictionData.stages?.[0];
    if (!stage1) return false;

    const hasConditions = stage1.conditions && stage1.conditions.length > 0;
    const hasWeakness = stage1.weakness && stage1.weakness.length > 0;
    const hasDamage = stage1.damage && stage1.damage.length > 0;

    return !hasConditions && !hasWeakness && !hasDamage;
  }

  static async promptStageSave(token, affliction, actor = null) {
    actor = actor || token?.actor;
    if (!actor) return;

    const showDCToPlayers = game.pf2e?.settings?.metagame?.dcs ?? true;
    const anonymizeSaves = game.settings.get(MODULE_ID, 'anonymizeSaveMessages') ?? false;

    const { StoryframeIntegrationService } = await import('./StoryframeIntegrationService.js');
    const sentToStoryframe = token
      ? await StoryframeIntegrationService.sendSaveRequest(token, affliction, 'stage')
      : false;

    if (!sentToStoryframe) {
      const playerContent = this._buildStageSaveMessage(
        actor,
        token,
        affliction,
        showDCToPlayers,
        anonymizeSaves
      );

      const whisperTargets = actor.hasPlayerOwner
        ? game.users.filter(u => !u.isGM && actor.testUserPermission(u, 'OWNER')).map(u => u.id)
        : game.users.filter(u => u.isGM).map(u => u.id);

      const speaker = token
        ? ChatMessage.getSpeaker({ token })
        : ChatMessage.getSpeaker({ actor });

      if (whisperTargets.length > 0) {
        await ChatMessage.create({
          content: playerContent,
          speaker,
          whisper: whisperTargets
        });
      }
    }

    if (!showDCToPlayers && actor.hasPlayerOwner) {
      const speaker = token
        ? ChatMessage.getSpeaker({ token })
        : ChatMessage.getSpeaker({ actor });
      const gmContent = `
        <div class="pf2e-afflictioner-save-request" style="border-color: #8b0000; padding: 8px;">
          <p style="margin: 0;"><strong>${affliction.name} - DC ${affliction.dc}</strong> (${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.GM_INFO')}) - ${game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.STAGE')} ${affliction.currentStage}</p>
        </div>
      `;
      await ChatMessage.create({
        content: gmContent,
        speaker,
        whisper: game.users.filter(u => u.isGM).map(u => u.id)
      });
    }
  }

  static async promptDamage(token, affliction, actor = null) {
    actor = actor || token?.actor;
    if (!actor) return;

    const currentStageIndex = affliction.currentStage - 1;
    if (currentStageIndex < 0 || !affliction.stages || !affliction.stages[currentStageIndex]) {
      ui.notifications.warn(game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.NO_ACTIVE_STAGE'));
      return;
    }

    const stage = affliction.stages[currentStageIndex];
    if (!stage.damage || stage.damage.length === 0) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.MANAGER.NO_DAMAGE_TO_ROLL', {
        name: affliction.name,
        stage: affliction.currentStage
      }));
      return;
    }

    const damageLinks = stage.damage.map(d => {
      const formula = typeof d === 'string' ? d : d.formula;
      const type = typeof d === 'object' ? d.type : 'untyped';
      const isChoice = typeof d === 'object' && d.isChoice;
      const altType = typeof d === 'object' ? d.alternativeType : null;

      const cleanFormula = formula.trim().replace(/\[.*$/, '');

      if (isChoice && altType) {
        const link1 = `@Damage[${cleanFormula}[${type}]]`;
        const link2 = `@Damage[${cleanFormula}[${altType}]]`;
        return `<div style="background: rgba(255, 165, 0, 0.15); padding: 8px; border-radius: 4px; border-left: 3px solid #992001; margin: 4px 0;">
          <div style="font-weight: bold; color: #ff3300; margin-bottom: 4px; font-size: 0.9em;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CHOOSE_ONE')}</div>
          <div style="margin-left: 8px;">${link1}</div>
          <div style="margin: 4px 0 0 8px;"><strong style="color: #ff3300;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.OR')}</strong></div>
          <div style="margin-left: 8px;">${link2}</div>
        </div>`;
      }

      return type !== 'untyped'
        ? `@Damage[${cleanFormula}[${type}]]`
        : `@Damage[${cleanFormula}]`;
    }).join(', ');

    const content = `
      <div class="pf2e-afflictioner-save-request">
        <h3><i class="fas fa-heart-broken"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.DAMAGE_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${actor.name}</strong> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.TAKES_DAMAGE')}</p>
        <p>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CURRENT_STAGE_LABEL')} ${affliction.currentStage}</p>
        <p><strong>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.DAMAGE_LABEL')}</strong> ${damageLinks}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CLICK_DAMAGE_LINK')}</em></p>
        <hr>
        <button class="affliction-target-token" data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''} style="width: 100%; padding: 8px; margin-top: 10px; background: #2a4a7c; border: 2px solid #3a5a8c; color: white; border-radius: 6px; cursor: pointer;">
          <i class="fas fa-crosshairs"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR', { actorName: actor.name })}
        </button>
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static _buildInitialSaveMessage(actor, token, afflictionData, afflictionId, showDCToPlayers, anonymizeSaves) {
    const saveTypeLabel = this._capitalize(afflictionData.saveType || 'fortitude');
    const tokenIdAttr = token ? `data-token-id="${token.id}"` : '';
    const actorIdAttr = (token?.document?.actorLink && token?.actor) || (!token && actor) ? `data-actor-id="${actor.id}"` : '';
    const idAttrs = `${tokenIdAttr} ${actorIdAttr}`.trim();

    if (anonymizeSaves) {
      return `
        <div class="pf2e-afflictioner-save-request">
          <h3><i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.FORTITUDE_SAVE_REQUIRED', { saveType: saveTypeLabel })}</h3>
          <p><strong>${actor.name}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.NEEDS_FORTITUDE_SAVE', { saveType: saveTypeLabel })}${showDCToPlayers ? ` ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.FORTITUDE_DC_PARENS', { dc: afflictionData.dc })}` : ''}</p>
          <hr>
          <button class="affliction-roll-initial-save"
                  ${idAttrs}
                  data-affliction-id="${afflictionId}"
                  data-dc="${afflictionData.dc}"
                  style="width: 100%; padding: 8px; margin-top: 10px;">
            <i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ROLL_FORTITUDE_SAVE', { saveType: saveTypeLabel })}
          </button>
        </div>
      `;
    }

    return `
      <div class="pf2e-afflictioner-save-request">
        <h3><i class="fas fa-biohazard"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.INITIAL_SAVE_HEADING', { afflictionName: afflictionData.name })}</h3>
        <p><strong>${actor.name}</strong> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.HAS_BEEN_EXPOSED_TO')} <strong>${afflictionData.name}</strong></p>
        <p>${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MAKE_FORTITUDE_RESIST', { saveType: saveTypeLabel })}${showDCToPlayers ? ` ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.FORTITUDE_DC_PARENS', { dc: afflictionData.dc })}` : ''}</p>
        <hr>
        <button class="affliction-roll-initial-save"
                ${idAttrs}
                data-affliction-id="${afflictionId}"
                data-dc="${afflictionData.dc}"
                style="width: 100%; padding: 8px; margin-top: 10px;">
          <i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ROLL_FORTITUDE_SAVE', { saveType: saveTypeLabel })}
        </button>
      </div>
    `;
  }

  static _buildStageSaveMessage(actor, token, affliction, showDCToPlayers, anonymizeSaves) {
    const saveTypeLabel = this._capitalize(affliction.saveType || 'fortitude');
    const tokenIdAttr = token ? `data-token-id="${token.id}"` : '';
    const actorIdAttr = actor ? `data-actor-id="${actor.id}"` : '';
    const idAttrs = `${tokenIdAttr} ${actorIdAttr}`.trim();

    if (anonymizeSaves) {
      return `
        <div class="pf2e-afflictioner-save-request">
          <h3><i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.FORTITUDE_SAVE_REQUIRED', { saveType: saveTypeLabel })}</h3>
          <p><strong>${actor.name}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MUST_MAKE_FORTITUDE', { saveType: saveTypeLabel })}</p>
          ${showDCToPlayers ? `<p><strong>DC:</strong> ${affliction.dc}</p>` : ''}
          ${affliction.treatmentBonus ? `<p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.TREATMENT_BONUS_ACTIVE')} (${affliction.treatmentBonus > 0 ? '+' : ''}${affliction.treatmentBonus})</em></p>` : ''}
          <hr>
          <button class="affliction-roll-save" ${idAttrs} data-affliction-id="${affliction.id}" data-dc="${affliction.dc}" style="width: 100%; padding: 8px; margin-top: 10px;">
            <i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ROLL_FORTITUDE_SAVE', { saveType: saveTypeLabel })}
          </button>
        </div>
      `;
    }

    return `
      <div class="pf2e-afflictioner-save-request">
        <h3><i class="fas fa-biohazard"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.SAVE_REQUIRED_HEADING', { afflictionName: affliction.name })}${affliction.isVirulent ? ` <span style="color: #c45500; font-size: 0.75em;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.VIRULENT_PARENS')}</span>` : ''}</h3>
        <p><strong>${actor.name}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MUST_MAKE_FORTITUDE', { saveType: saveTypeLabel })}</p>
        ${showDCToPlayers ? `<p><strong>DC:</strong> ${affliction.dc}</p>` : ''}
        <p>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CURRENT_STAGE_LABEL')} ${affliction.currentStage}</p>
        ${affliction.isVirulent ? `<p><em style="color: #c45500; font-size: 0.75em;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.VIRULENT_NOTE')}</em></p>` : ''}
        ${affliction.treatmentBonus ? `<p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.TREATMENT_BONUS_ACTIVE')} (${affliction.treatmentBonus > 0 ? '+' : ''}${affliction.treatmentBonus})</em></p>` : ''}
        <hr>
        <button class="affliction-roll-save" ${idAttrs} data-affliction-id="${affliction.id}" data-dc="${affliction.dc}" style="width: 100%; padding: 8px; margin-top: 10px;">
          <i class="fas fa-dice-d20"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ROLL_FORTITUDE_SAVE', { saveType: saveTypeLabel })}
        </button>
      </div>
    `;
  }

  static async postMaxDurationExpired(token, affliction) {
    const actor = token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    const maxDurationText = affliction.maxDuration
      ? `${affliction.maxDuration.value} ${affliction.maxDuration.unit}(s)`
      : 'unknown';

    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #6C757D;">
        <h3><i class="fas fa-hourglass-end"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MAX_DURATION_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${entityName}</strong>'s ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MAX_DURATION_REACHED_NOTE', { duration: maxDurationText })}</p>
        <p><strong>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.MAX_DURATION_PERSIST_NOTE')}</strong></p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.STAGE_WHEN_EXPIRED')} ${affliction.currentStage}</em></p>
        <div class="pf2e-afflictioner-button-group" style="margin-top: 10px;">
          <button class="pf2e-afflictioner-btn pf2e-afflictioner-remove-expired-btn"
                  data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''}
                  data-affliction-id="${affliction.id}"
                  style="background: #dc3545;">
            <i class="fas fa-trash-alt"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.REMOVE_CONDITIONS_PERSIST')}
          </button>
        </div>
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async promptPerniciousPoisonDamage(token, affliction) {
    const actor = token?.actor;
    if (!actor) return;
    const level = affliction.perniciousPoisonLevel || 0;
    if (!level) return;

    const damageLink = `@Damage[${level}[poison]]`;

    const content = `
      <div class="pf2e-afflictioner-save-request">
        <h3><i class="fas fa-skull-crossbones"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.PERNICIOUS_POISON_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${actor.name}</strong> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.PERNICIOUS_POISON_NOTE')}</p>
        <p><strong>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.DAMAGE_LABEL')}</strong> ${damageLink}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CLICK_DAMAGE_LINK')}</em></p>
        <hr>
        <button class="affliction-target-token" data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''} style="width: 100%; padding: 8px; margin-top: 10px; background: #2a4a7c; border: 2px solid #3a5a8c; color: white; border-radius: 6px; cursor: pointer;">
          <i class="fas fa-crosshairs"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR', { actorName: actor.name })}
        </button>
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async postStageChange(token, affliction, oldStage, newStage, options = {}) {
    const actor = token?.actor;
    const entityName = token?.name || actor?.name || affliction.name;
    const oldStageText = oldStage === 0 ? game.i18n.localize('PF2E_AFFLICTIONER.CHAT.INITIAL_EXPOSURE') : `${game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.STAGE')} ${oldStage}`;
    const stageDirection = newStage > oldStage ? game.i18n.localize('PF2E_AFFLICTIONER.CHAT.STAGE_INCREASED') : game.i18n.localize('PF2E_AFFLICTIONER.CHAT.STAGE_DECREASED');
    const stageIcon = newStage > oldStage ? 'fa-arrow-up' : 'fa-arrow-down';
    const stageColor = newStage > oldStage ? '#ff6b00' : '#4a7c2a';
    const bgColor = newStage > oldStage ? 'rgba(255, 107, 0, 0.1)' : 'rgba(74, 124, 42, 0.1)';

    const newStageData = affliction.stages[newStage - 1];

    let effectsSummary = '';
    if (newStageData) {
      const effects = [];
      if (newStageData.damage?.length) {
        effects.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.DAMAGE_PREFIX')} ${newStageData.damage.map(d => `${d.formula} ${d.type}`).join(', ')}`);
      }
      if (newStageData.conditions?.length) {
        effects.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CONDITIONS_PREFIX')} ${newStageData.conditions.map(c => {
          if (c.name === 'persistent damage' || c.name === 'persistent-damage') {
            return game.i18n.format('PF2E_AFFLICTIONER.CHAT.PERSISTENT_DAMAGE_LABEL', { formula: c.persistentFormula || '1d6', type: c.persistentType || 'untyped' });
          }
          return c.value ? `${c.name} ${c.value}` : c.name;
        }).join(', ')}`);
      }
      if (newStageData.weakness?.length) {
        effects.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.WEAKNESS_PREFIX')} ${newStageData.weakness.map(w => `${w.type} ${w.value}`).join(', ')}`);
      }
      if (effects.length > 0) {
        effectsSummary = `<div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.9em;">${effects.join(' • ')}</div>`;
      }
    }

    const fastRecoveryNote = (options.fastRecovery && newStage < oldStage)
      ? `<div style="margin-top:6px;padding:5px 8px;background:rgba(0,0,0,0.3);border-left:3px solid #4a9c2a;border-radius:3px;font-size:0.85em;color:#f5f5f5;"><i class="fas fa-bolt" style="margin-right:4px;"></i>${game.i18n.format('PF2E_AFFLICTIONER.FEATS.FAST_RECOVERY_STAGE_CHANGE', { tokenName: entityName, afflictionName: affliction.name, stages: oldStage - newStage })}</div>`
      : '';

    const hasDamage = (newStageData?.damage?.length > 0) ||
      (newStageData?.effects ? /\d+d\d+|damage/i.test(newStageData.effects) : false);
    const tokenIdAttr = token ? `data-token-id="${token.id}"` : '';
    const actorIdAttr = (token?.document?.actorLink && token?.actor) || (!token && actor) ? `data-actor-id="${actor.id}"` : '';
    const targetButton = hasDamage
      ? `<hr><button class="affliction-target-token" ${tokenIdAttr} ${actorIdAttr} style="width: 100%; padding: 8px; margin-top: 10px; background: #2a4a7c; border: 2px solid #3a5a8c; color: white; border-radius: 6px; cursor: pointer;"><i class="fas fa-crosshairs"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR', { actorName: entityName })}</button>`
      : '';

    const content = `
      <div class="pf2e-afflictioner-stage-change" style="border-left: 5px solid ${stageColor}; padding: 12px; background: ${bgColor}; border-radius: 4px; margin: 8px 0;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <i class="fas ${stageIcon}" style="color: ${stageColor}; font-size: 24px;"></i>
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 1.2em; color: ${stageColor};">${affliction.name} - ${stageDirection}</h3>
            <p style="margin: 4px 0 0 0; font-size: 0.95em;"><strong>${entityName}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.IS_NOW_AT_STAGE', { stage: newStage })} <span style="color: #888;">${game.i18n.format('PF2E_AFFLICTIONER.CHAT.WAS_STAGE', { stage: oldStageText })}</span></p>
          </div>
        </div>
        ${effectsSummary}
        ${newStageData && newStageData.effects ? `<div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-style: italic; color: #f5f5f5; font-size: 0.9em; border-left: 3px solid ${stageColor}; padding-left: 10px;">${newStageData.effects}</div>` : ''}
        ${fastRecoveryNote}
        ${targetButton}
      </div>
    `;

    await ChatMessage.create({
      content: content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async promptDeathConfirmation(token, affliction) {
    const actor = token?.actor;

    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #4a0000;">
        <h3><i class="fas fa-skull-crossbones"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.LETHAL_STAGE_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${actor?.name || 'Unknown'}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.REACHED_LETHAL_STAGE', { afflictionName: affliction.name, stage: affliction.currentStage })}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.LETHAL_NOTE')}</em></p>
        <hr>
        <button class="pf2e-afflictioner-btn pf2e-afflictioner-confirm-kill-btn"
                data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''}
                data-affliction-id="${affliction.id}"
                style="width: 100%; padding: 8px; margin-top: 10px; background: #8b0000;">
          <i class="fas fa-skull"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CONFIRM_KILL')}
        </button>
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async postPoisonReExposure(token, affliction, stageIncrease, newStage) {
    const actor = token?.actor;
    const entityName = token?.name || actor?.name || affliction.name;
    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #8b008b;">
        <h3><i class="fas fa-biohazard"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.POISON_RE_EXPOSURE_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${entityName}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.EXPOSED_AGAIN', { afflictionName: affliction.name })}</p>
        <p>${game.i18n.format('PF2E_AFFLICTIONER.CHAT.FAILED_INITIAL_SAVE_STAGE', { stageIncrease, newStage })}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.MAX_DURATION_UNCHANGED')}</em></p>
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async postMultipleExposure(token, afflictionData, multipleExposure, newStage) {
    const actor = token?.actor;
    const entityName = token?.name || actor?.name || afflictionData.name;
    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #c45500;">
        <h3><i class="fas fa-biohazard"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.MULTIPLE_EXPOSURE_HEADING', { afflictionName: afflictionData.name })}</h3>
        <p><strong>${entityName}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.EXPOSED_AGAIN', { afflictionName: afflictionData.name })}</p>
        <p>${game.i18n.format('PF2E_AFFLICTIONER.CHAT.STAGE_INCREASED_BY', { stageIncrease: multipleExposure.stageIncrease, newStage })}</p>
        ${multipleExposure.rawText ? `<p><em>${multipleExposure.rawText}</em></p>` : ''}
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async postOnsetEffectIntervalTrigger(token, affliction) {
    const actor = token?.actor;
    const interval = affliction.onsetEffectInterval;
    const intervalText = interval ? `${interval.value} ${interval.unit}(s)` : '';

    // Effects summary
    const effectParts = [];
    if (affliction.onsetConditions?.length) {
      effectParts.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CONDITIONS_PREFIX')} ${affliction.onsetConditions.map(c => {
        if (c.name === 'persistent damage' || c.name === 'persistent-damage') {
          return game.i18n.format('PF2E_AFFLICTIONER.CHAT.PERSISTENT_DAMAGE_LABEL', { formula: c.persistentFormula || '1d6', type: c.persistentType || 'untyped' });
        }
        return c.value ? `${c.name} ${c.value}` : c.name;
      }).join(', ')}`);
    }
    if (affliction.onsetWeakness?.length) {
      effectParts.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.WEAKNESS_PREFIX')} ${affliction.onsetWeakness.map(w => `${w.type} ${w.value}`).join(', ')}`);
    }
    const effectsSummary = effectParts.length
      ? `<div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.9em;">${effectParts.join(' • ')}</div>`
      : '';

    const hasDamage = affliction.onsetDamage && affliction.onsetDamage.length > 0;
    let damageSection = '';
    if (hasDamage) {
      const damageLinks = affliction.onsetDamage.map(d => {
        const formula = (typeof d === 'string' ? d : d.formula || '').trim().replace(/\[.*$/, '');
        const type = typeof d === 'object' ? d.type : 'untyped';
        return type && type !== 'untyped'
          ? `@Damage[${formula}[${type}]]`
          : `@Damage[${formula}]`;
      }).join(', ');
      damageSection = `
        <p><strong>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.DAMAGE_LABEL')}</strong> ${damageLinks}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CLICK_DAMAGE_LINK')}</em></p>
        <hr>
        <button class="affliction-target-token" data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''} style="width: 100%; padding: 8px; margin-top: 10px; background: #2a4a7c; border: 2px solid #3a5a8c; color: white; border-radius: 6px; cursor: pointer;">
          <i class="fas fa-crosshairs"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR', { actorName: actor?.name || 'Unknown' })}
        </button>`;
    }

    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #6B3FA0;">
        <h3><i class="fas fa-hourglass-half"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ONSET_EFFECT_INTERVAL_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${actor?.name || 'Unknown'}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.ONSET_EFFECT_INTERVAL_NOTE', { duration: intervalText })}</p>
        ${effectsSummary}
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.ONSET_EFFECT_INTERVAL_NO_SAVE')}</em></p>
        ${damageSection}
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  static async postEffectIntervalTrigger(token, affliction) {
    const actor = token?.actor;
    const stage = affliction.stages?.[affliction.currentStage - 1];
    const effectInterval = stage?.effectInterval;
    const effectIntervalText = effectInterval
      ? `${effectInterval.value} ${effectInterval.unit}(s)`
      : '';

    // Effects summary
    const effectParts = [];
    if (stage?.conditions?.length) {
      effectParts.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CONDITIONS_PREFIX')} ${stage.conditions.map(c => {
        if (c.name === 'persistent damage' || c.name === 'persistent-damage') {
          return game.i18n.format('PF2E_AFFLICTIONER.CHAT.PERSISTENT_DAMAGE_LABEL', { formula: c.persistentFormula || '1d6', type: c.persistentType || 'untyped' });
        }
        return c.value ? `${c.name} ${c.value}` : c.name;
      }).join(', ')}`);
    }
    if (stage?.weakness?.length) {
      effectParts.push(`${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.WEAKNESS_PREFIX')} ${stage.weakness.map(w => `${w.type} ${w.value}`).join(', ')}`);
    }
    const effectsSummary = effectParts.length
      ? `<div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.9em;">${effectParts.join(' • ')}</div>`
      : '';

    // Damage links
    const hasDamage = stage?.damage?.length > 0;
    let damageSection = '';
    if (hasDamage) {
      const damageLinks = stage.damage.map(d => {
        const formula = (typeof d === 'string' ? d : d.formula || '').trim().replace(/\[.*$/, '');
        const type = typeof d === 'object' ? d.type : 'untyped';
        const isChoice = typeof d === 'object' && d.isChoice;
        const altType = typeof d === 'object' ? d.alternativeType : null;

        if (isChoice && altType) {
          return `<div style="background: rgba(255, 165, 0, 0.15); padding: 8px; border-radius: 4px; border-left: 3px solid #992001; margin: 4px 0;">
            <div style="font-weight: bold; color: #ff3300; margin-bottom: 4px; font-size: 0.9em;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CHOOSE_ONE')}</div>
            <div style="margin-left: 8px;">@Damage[${formula}[${type}]]</div>
            <div style="margin: 4px 0 0 8px;"><strong style="color: #ff3300;">${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.OR')}</strong></div>
            <div style="margin-left: 8px;">@Damage[${formula}[${altType}]]</div>
          </div>`;
        }
        return type && type !== 'untyped' ? `@Damage[${formula}[${type}]]` : `@Damage[${formula}]`;
      }).join(', ');

      damageSection = `
        <p><strong>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.DAMAGE_LABEL')}</strong> ${damageLinks}</p>
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CLICK_DAMAGE_LINK')}</em></p>
        <hr>
        <button class="affliction-target-token" data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''} style="width: 100%; padding: 8px; margin-top: 10px; background: #2a4a7c; border: 2px solid #3a5a8c; color: white; border-radius: 6px; cursor: pointer;">
          <i class="fas fa-crosshairs"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.TARGET_ACTOR', { actorName: actor?.name || 'Unknown' })}
        </button>`;
    }

    const content = `
      <div class="pf2e-afflictioner-save-request" style="border-color: #6B3FA0;">
        <h3><i class="fas fa-clock"></i> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.EFFECT_INTERVAL_HEADING', { afflictionName: affliction.name })}</h3>
        <p><strong>${actor?.name || 'Unknown'}</strong> ${game.i18n.format('PF2E_AFFLICTIONER.CHAT.EFFECT_INTERVAL_NOTE', { duration: effectIntervalText })}</p>
        <p>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.CURRENT_STAGE_LABEL')} ${affliction.currentStage}</p>
        ${effectsSummary}
        <p><em>${game.i18n.localize('PF2E_AFFLICTIONER.CHAT.EFFECT_INTERVAL_NO_SAVE')}</em></p>
        ${damageSection}
      </div>
    `;

    await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }
}
