import { MODULE_ID, DEGREE_OF_SUCCESS } from '../constants.js';
import { VisualService } from './VisualService.js';
import { AfflictionService } from './AfflictionService.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { getSystemFlags } from '../systemCompat.js';

export class SocketService {
  /**
   * Resolve a token from tokenId, falling back to finding a linked token via actorId.
   */
  static _resolveToken(tokenId, actorId) {
    let token = tokenId ? canvas.tokens.get(tokenId) : null;
    if (!token && actorId) {
      const actor = game.actors.get(actorId);
      if (actor) token = AfflictionStore.findTokenForActor(actor);
    }
    return token;
  }
  static socket = null;

  static degreeToString(degree) {
    const map = {
      [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: DEGREE_OF_SUCCESS.CRITICAL_SUCCESS,
      [DEGREE_OF_SUCCESS.SUCCESS]: DEGREE_OF_SUCCESS.SUCCESS,
      [DEGREE_OF_SUCCESS.FAILURE]: DEGREE_OF_SUCCESS.FAILURE,
      [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: DEGREE_OF_SUCCESS.CRITICAL_FAILURE
    };
    return map[degree] || DEGREE_OF_SUCCESS.FAILURE;
  }

  static degreeLabel(degree) {
    return {
      [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.CRITICAL_SUCCESS'),
      [DEGREE_OF_SUCCESS.SUCCESS]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.SUCCESS'),
      [DEGREE_OF_SUCCESS.FAILURE]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.FAILURE'),
      [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: game.i18n.localize('PF2E_AFFLICTIONER.DEGREES.CRITICAL_FAILURE')
    }[degree];
  }

  static degreeColor(degree) {
    return {
      [DEGREE_OF_SUCCESS.CRITICAL_SUCCESS]: '#4a7c2a',
      [DEGREE_OF_SUCCESS.SUCCESS]: '#5a8c3a',
      [DEGREE_OF_SUCCESS.FAILURE]: '#c45500',
      [DEGREE_OF_SUCCESS.CRITICAL_FAILURE]: '#8b0000'
    }[degree];
  }

  static incapacitationNoticeHtml(degreeResult) {
    if (!degreeResult?.incapacitationApplied) return '';

    const notice = game.i18n.format('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INCAPACITATION_UPGRADED', {
      from: this.degreeLabel(degreeResult.rawDegree),
      to: this.degreeLabel(degreeResult.degree)
    });

    return `<p style="margin: 4px 0; padding: 6px 8px; font-size: 0.85em; color: #ffd166; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,209,102,0.45); border-radius: 4px;">
          <i class="fas fa-arrow-up"></i> ${notice}
        </p>`;
  }

  static initialize() {
    if (!game.modules.get('socketlib')?.active) {
      return;
    }

    this.socket = socketlib.registerModule(MODULE_ID);

    this.socket.register('refreshAfflictionIndicators', this.refreshAfflictionIndicators.bind(this));
    this.socket.register('notifyAfflictionChange', this.notifyAfflictionChange.bind(this));
    this.socket.register('gmRemoveAffliction', this.gmRemoveAffliction.bind(this));
    this.socket.register('gmUpdateAfflictions', this.gmUpdateAfflictions.bind(this));
    this.socket.register('gmHandleSave', this.gmHandleSave.bind(this));
    this.socket.register('gmHandleInitialSave', this.gmHandleInitialSave.bind(this));
    this.socket.register('gmHandleTreatment', this.gmHandleTreatment.bind(this));
    this.socket.register('gmHandleCounteract', this.gmHandleCounteract.bind(this));
    this.socket.register('gmApplySaveConsequences', this.gmApplySaveConsequences.bind(this));
    this.socket.register('unlockSaveButton', this.handleUnlockSaveButton.bind(this));
    this.socket.register('syncButtonState', this.handleSyncButtonState.bind(this));
    this.socket.register('gmPromptCoatingDuration', this.gmPromptCoatingDuration.bind(this));
    this.socket.register('gmApplyWeaponCoating', this.gmApplyWeaponCoating.bind(this));
    this.socket.register('gmRemoveWeaponCoating', this.gmRemoveWeaponCoating.bind(this));

    Hooks.on('pf2e.preReroll', this.onPf2ePreReroll.bind(this));
    Hooks.on('pf2e.reroll', this.onPf2eReroll.bind(this));
  }

  static async gmApplyWeaponCoating(actorId, weaponId, coatingParams) {
    if (!game.user.isGM) return false;
    const { WeaponCoatingService } = await import('./WeaponCoatingService.js');
    return WeaponCoatingService._applyCoatingToActor(actorId, weaponId, coatingParams);
  }

  static async requestApplyWeaponCoating(actorId, weaponId, coatingParams) {
    if (!this.socket) return false;
    try {
      return await this.socket.executeAsGM('gmApplyWeaponCoating', actorId, weaponId, coatingParams);
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting weapon coating application:', error);
      return false;
    }
  }

  static async gmRemoveWeaponCoating(actorId, weaponId) {
    if (!game.user.isGM) return false;
    const { WeaponCoatingService } = await import('./WeaponCoatingService.js');
    return WeaponCoatingService._removeCoatingFromActor(actorId, weaponId);
  }

  static async requestRemoveWeaponCoating(actorId, weaponId) {
    if (!this.socket) return false;
    try {
      return await this.socket.executeAsGM('gmRemoveWeaponCoating', actorId, weaponId);
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting weapon coating removal:', error);
      return false;
    }
  }

  static async gmPromptCoatingDuration() {
    if (!game.user.isGM) return null;
    const { WeaponCoatingService } = await import('./WeaponCoatingService.js');
    return WeaponCoatingService._promptCoatingDuration();
  }

  static async requestPromptCoatingDuration() {
    if (!this.socket) return null;

    try {
      return await this.socket.executeAsGM('gmPromptCoatingDuration');
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting coating duration prompt:', error);
      return null;
    }
  }

  static async requestHandleSave(tokenId, afflictionId, rollMessageId, dc, actorId = null) {
    if (!this.socket) return false;

    try {
      await this.socket.executeAsGM('gmHandleSave', tokenId, afflictionId, rollMessageId, dc, actorId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting save handling:', error);
      return false;
    }
  }

  static async gmHandleSave(tokenId, afflictionId, rollMessageId, dc, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
    if (!token && !actor) return;

    const { AfflictionService } = await import('./AfflictionService.js');

    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : AfflictionStore.getAfflictionForActor(actor, afflictionId);
    if (!affliction) return;

    const requireConfirmation = game.settings.get(MODULE_ID, 'requireSaveConfirmation');

    if (requireConfirmation) {
      const rollMessage = game.messages.get(rollMessageId);
      if (rollMessage) {
        await rollMessage.update({
          'flags.pf2e-afflictioner.needsConfirmation': true,
          'flags.pf2e-afflictioner.tokenId': tokenId,
          'flags.pf2e-afflictioner.actorId': actorId || (token?.document?.actorLink ? token.actor?.id : undefined),
          'flags.pf2e-afflictioner.afflictionId': afflictionId,
          'flags.pf2e-afflictioner.saveType': 'stage',
          'flags.pf2e-afflictioner.dc': dc
        });
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 150));
      const message = game.messages.get(rollMessageId);
      const saveTotal = await this.getCurrentRollTotal(rollMessageId);
      const dieValue = AfflictionService.getDieValue(message);
      if (saveTotal !== null) {
        await AfflictionService.handleStageSave(token, affliction, saveTotal, dc, false, dieValue, actor);
      } else {
        console.error('PF2e Afflictioner | Failed to read save result for immediate application');
      }
    }
  }

  static async requestHandleInitialSave(tokenId, afflictionId, rollMessageId, dc, actorId = null) {
    if (!this.socket) return false;

    try {
      await this.socket.executeAsGM('gmHandleInitialSave', tokenId, afflictionId, rollMessageId, dc, actorId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting initial save handling:', error);
      return false;
    }
  }

  static async gmHandleInitialSave(tokenId, afflictionId, rollMessageId, dc, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
    if (!token && !actor) return;

    const { AfflictionService } = await import('./AfflictionService.js');

    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : AfflictionStore.getAfflictionForActor(actor, afflictionId);
    if (!affliction) return;

    const requireConfirmation = game.settings.get(MODULE_ID, 'requireSaveConfirmation');

    if (requireConfirmation) {
      const rollMessage = game.messages.get(rollMessageId);
      if (rollMessage) {
        await rollMessage.update({
          'flags.pf2e-afflictioner.needsConfirmation': true,
          'flags.pf2e-afflictioner.tokenId': tokenId,
          'flags.pf2e-afflictioner.actorId': actorId || (token?.document?.actorLink ? token.actor?.id : undefined),
          'flags.pf2e-afflictioner.afflictionId': afflictionId,
          'flags.pf2e-afflictioner.saveType': 'initial',
          'flags.pf2e-afflictioner.dc': dc
        });
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 150));
      const message = game.messages.get(rollMessageId);
      const saveTotal = await this.getCurrentRollTotal(rollMessageId);
      const dieValue = AfflictionService.getDieValue(message);
      if (saveTotal !== null) {
        await AfflictionService.handleInitialSave(token, affliction, saveTotal, dc, dieValue, actor);
      } else {
        console.error('PF2e Afflictioner | Failed to read save result for immediate application');
      }
    }
  }

  static async requestHandleTreatment(tokenId, afflictionId, total, dc, actorId = null) {
    if (!this.socket) return false;

    try {
      await this.socket.executeAsGM('gmHandleTreatment', tokenId, afflictionId, total, dc, actorId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting treatment handling:', error);
      return false;
    }
  }

  static async gmHandleTreatment(tokenId, afflictionId, total, dc, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
    if (!token && !actor) return;

    const { TreatmentService } = await import('./TreatmentService.js');

    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : AfflictionStore.getAfflictionForActor(actor, afflictionId);
    if (!affliction) return;

    await TreatmentService.handleTreatmentResult(token, affliction, total, dc, actor);
  }

  static async requestHandleCounteract(tokenId, afflictionId, counteractRank, afflictionRank, degree, actorId = null) {
    if (!this.socket) return false;

    try {
      await this.socket.executeAsGM('gmHandleCounteract', tokenId, afflictionId, counteractRank, afflictionRank, degree, actorId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting counteract handling:', error);
      return false;
    }
  }

  static async gmHandleCounteract(tokenId, afflictionId, counteractRank, afflictionRank, degree, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
    if (!token && !actor) return;

    const { CounteractService } = await import('./CounteractService.js');

    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : AfflictionStore.getAfflictionForActor(actor, afflictionId);
    if (!affliction) return;

    await CounteractService.handleCounteractResult(token, affliction, counteractRank, afflictionRank, degree, actor);
  }

  static async postSaveConfirmation(token, affliction, rollMessageId, dc, saveType) {
    const actor = token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    const message = game.messages.get(rollMessageId);
    if (!message) {
      console.error('PF2e Afflictioner | Message not found for confirmation');
      return;
    }

    const saveTotal = await this.getCurrentRollTotal(rollMessageId);
    if (saveTotal === null) {
      console.error('PF2e Afflictioner | Could not read roll total from message');
      return;
    }

    const dieValue = AfflictionService.getDieValue(message);

    const degreeResult = AfflictionService.calculateAfflictionDegreeResult(saveTotal, dc, dieValue, actor, affliction);
    const degree = this.degreeToString(degreeResult.degree);
    const degreeText = this.degreeLabel(degree);
    const degreeColor = this.degreeColor(degree);
    const incapacitationNotice = this.incapacitationNoticeHtml(degreeResult);

    const saveTypeLabel = saveType === 'initial' ? game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INITIAL_SAVE') : game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.STAGE_SAVE');

    const content = `
      <div class="pf2e-afflictioner-save-confirmation" style="border-left: 5px solid ${degreeColor}; padding: 12px; background: rgba(0,0,0,0.1); border-radius: 4px; margin: 8px 0;">
        <h3 style="margin: 0 0 8px 0;"><i class="fas fa-biohazard"></i> ${affliction.name} - ${saveTypeLabel}</h3>
        <p style="margin: 4px 0;"><strong>${entityName}</strong> rolled <strong>${saveTotal}</strong> vs DC ${dc}</p>
        <p style="margin: 4px 0; color: ${degreeColor}; font-weight: bold;">Result: ${degreeText}</p>
        ${incapacitationNotice}
        <p style="margin: 8px 0 4px 0; font-size: 0.9em; font-style: italic; color: #ccc;">${game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.AWAITING')}</p>
        <p style="margin: 4px 0; font-size: 0.85em; color: #999;">${game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.IF_REROLLED')}</p>
        <button class="affliction-confirm-save"
                data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && actor) ? ` data-actor-id="${actor.id}"` : ''}
                data-affliction-id="${affliction.id}"
                data-roll-message-id="${rollMessageId}"
                data-dc="${dc}"
                data-save-type="${saveType}"
                style="width: 100%; padding: 8px; margin-top: 10px; background: ${degreeColor}; border: 2px solid ${degreeColor}; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_CONSEQUENCES')}
        </button>
      </div>
    `;

    const confirmMsg = await ChatMessage.create({
      content,
      speaker: token ? ChatMessage.getSpeaker({ token }) : ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id),
      flags: {
        'pf2e-afflictioner': {
          isConfirmation: true,
          rollMessageId: rollMessageId,
          tokenId: token?.id,
          actorId: (token?.document?.actorLink ? token.actor?.id : undefined) || actor?.id,
          afflictionId: affliction.id,
          afflictionName: affliction.name,
          saveType: saveType,
          dc: dc
        }
      }
    });
  }

  static async getCurrentRollTotal(messageId) {
    if (!messageId) {
      return null;
    }

    const message = game.messages.get(messageId);
    if (!message) {
      return null;
    }

    let total = null;

    const roll = message.rolls?.[0];
    if (roll?.total !== undefined) {
      total = roll.total;
      return total;
    }

    const sysFlags = getSystemFlags(message);
    if (sysFlags?.context?.rollTotal !== undefined) {
      total = sysFlags.context.rollTotal;
      return total;
    }

    if (message.content) {
      const match = message.content.match(/class="result-total[^"]*">(\d+)</);
      if (match) {
        total = parseInt(match[1]);
        return total;
      }
    }

    console.error('PF2e Afflictioner | Could not extract roll total from message:', {
      messageId,
      hasRolls: !!message.rolls?.length,
      rolls: message.rolls,
      flags: getSystemFlags(message),
      contentPreview: message.content?.substring(0, 300)
    });
    return null;
  }

  static async requestApplySaveConsequences(tokenId, afflictionId, rollMessageId, dc, saveType, actorId = null) {
    if (!this.socket) return false;

    try {
      await this.socket.executeAsGM('gmApplySaveConsequences', tokenId, afflictionId, rollMessageId, dc, saveType, actorId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting save consequence application:', error);
      return false;
    }
  }

  static async gmApplySaveConsequences(tokenId, afflictionId, rollMessageId, dc, saveType, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    const actor = token?.actor || (actorId ? game.actors.get(actorId) : null);
    if (!token && !actor) return;

    const { AfflictionService } = await import('./AfflictionService.js');

    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : AfflictionStore.getAfflictionForActor(actor, afflictionId);
    if (!affliction) return;

    await new Promise(resolve => setTimeout(resolve, 100));

    const saveTotal = await this.getCurrentRollTotal(rollMessageId);

    if (saveTotal === null) {
      ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.COULD_NOT_READ_ROLL'));
      console.error('PF2e Afflictioner | Failed to read save result from message ID:', rollMessageId);

      const msg = game.messages.get(rollMessageId);
      if (msg) {
        console.error('PF2e Afflictioner | Message exists but no roll total. Full message:', msg);
        console.error('PF2e Afflictioner | Message.rolls:', msg.rolls);
        console.error('PF2e Afflictioner | Message.flags:', msg.flags);
      } else {
        console.error('PF2e Afflictioner | Message not found in game.messages');
      }
      return;
    }

    const message = game.messages.get(rollMessageId);
    const dieValue = AfflictionService.getDieValue(message);

    if (saveType === 'initial') {
      await AfflictionService.handleInitialSave(token, affliction, saveTotal, dc, dieValue, actor);
    } else {
      await AfflictionService.handleStageSave(token, affliction, saveTotal, dc, false, dieValue, actor);
    }
  }

  static async requestRemoveAffliction(tokenId, afflictionId) {
    if (!this.socket) {
      console.error('PF2e Afflictioner | Socket not initialized');
      return false;
    }

    try {
      await this.socket.executeAsGM('gmRemoveAffliction', tokenId, afflictionId);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting affliction removal:', error);
      return false;
    }
  }

  static async gmRemoveAffliction(tokenId, afflictionId, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    if (token) {
      await AfflictionStore.removeAffliction(token, afflictionId);
    } else if (actorId) {
      const actor = game.actors.get(actorId);
      if (actor) await AfflictionStore.removeAfflictionForActor(actor, afflictionId);
    } else {
      return;
    }

    await this.broadcastAfflictionChange(tokenId || actorId, '', 'removed');
  }

  static async requestUpdateAfflictions(tokenId, afflictions) {
    if (!this.socket) {
      console.error('PF2e Afflictioner | Socket not initialized');
      return false;
    }

    try {
      await this.socket.executeAsGM('gmUpdateAfflictions', tokenId, afflictions);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error requesting affliction update:', error);
      return false;
    }
  }

  static async gmUpdateAfflictions(tokenId, afflictions, actorId) {
    if (!game.user.isGM) return;

    const token = this._resolveToken(tokenId, actorId);
    if (token) {
      await AfflictionStore.setAfflictions(token, afflictions);
    } else if (actorId) {
      const actor = game.actors.get(actorId);
      if (actor) await actor.setFlag(MODULE_ID, 'afflictions', afflictions);
    } else {
      return;
    }

    await this.broadcastAfflictionChange(tokenId || actorId, '', 'updated');
  }

  static async broadcastRefreshIndicators(tokenId) {
    if (!this.socket) return;

    try {
      await this.socket.executeForEveryone('refreshAfflictionIndicators', tokenId);
    } catch (error) {
      console.error('PF2e Afflictioner | Error broadcasting refresh:', error);
    }
  }

  static async refreshAfflictionIndicators(tokenId) {
    const token = canvas.tokens.get(tokenId);
    if (token) {
      VisualService.refreshTokenIndicator(token);
    }
  }

  static async broadcastAfflictionChange(tokenId, afflictionName, type) {
    if (!this.socket) return;

    try {
      await this.socket.executeForEveryone('notifyAfflictionChange', tokenId, afflictionName, type);
    } catch (error) {
      console.error('PF2e Afflictioner | Error broadcasting notification:', error);
    }
  }

  static async notifyAfflictionChange(_entityId, _afflictionName, _type) {
    const { AfflictionManager } = await import('../managers/AfflictionManager.js');
    if (AfflictionManager.currentInstance) {
      AfflictionManager.currentInstance.render({ force: true });
    }
  }

  static async onPf2ePreReroll(oldRoll, ..._args) {
    if (!game.user.isGM) return;

    const messageId = oldRoll?.options?.messageId || oldRoll?.messageId;
    let oldMessage = messageId ? game.messages.get(messageId) : null;
    if (!oldMessage) {
      const recentMessages = game.messages.contents.slice(-20);
      oldMessage = recentMessages.find(msg =>
        msg.rolls?.some(r => r === oldRoll || r.total === oldRoll?.total)
      );
    }

    if (!oldMessage) {
      return;
    }

    this._lastRerollOldMessageId = oldMessage.id;

    if (oldMessage.flags?.['pf2e-afflictioner']?.needsConfirmation) {
      this._lastRerollConfirmationFlags = {
        needsConfirmation: true,
        tokenId: oldMessage.flags['pf2e-afflictioner'].tokenId,
        afflictionId: oldMessage.flags['pf2e-afflictioner'].afflictionId,
        saveType: oldMessage.flags['pf2e-afflictioner'].saveType,
        dc: oldMessage.flags['pf2e-afflictioner'].dc
      };
    }

    if (oldMessage.flags?.['pf2e-afflictioner']?.needsCounteractConfirmation) {
      const counteractFlags = { ...oldMessage.flags['pf2e-afflictioner'] };
      const speakerActorId = oldMessage.speaker?.actor;
      Hooks.once('createChatMessage', async (newMsg) => {
        if (!speakerActorId || newMsg.speaker?.actor === speakerActorId || newMsg.actor?.id === speakerActorId) {
          await newMsg.update({ 'flags.pf2e-afflictioner': counteractFlags });
        }
      });
    }
  }

  static async onPf2eReroll(_oldRoll, newRoll, _arg2, _rerollMode) {
    if (!game.user.isGM) return;

    const oldMessageId = this._lastRerollOldMessageId;
    if (!oldMessageId) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    const newMessageId = newRoll?.options?.messageId || newRoll?.messageId;
    let newMessage = newMessageId ? game.messages.get(newMessageId) : null;
    if (!newMessage) {
      const recentMessages = game.messages.contents.slice(-20);
      newMessage = recentMessages.find(msg =>
        msg.id !== oldMessageId && msg.rolls?.some(r => r === newRoll || r.total === newRoll?.total)
      );
    }

    if (!newMessage) {
      return;
    }

    if (this._lastRerollConfirmationFlags) {
      await newMessage.update({
        'flags.pf2e-afflictioner': this._lastRerollConfirmationFlags
      });
      this._lastRerollConfirmationFlags = null;
    }

    this._lastRerollOldMessageId = null;
  }

  static async updateConfirmationMessage(confirmationMessage, rollMessage) {
    const flags = confirmationMessage.flags['pf2e-afflictioner'];
    const { tokenId, afflictionId, afflictionName, saveType, dc } = flags;

    const saveTotal = await this.getCurrentRollTotal(rollMessage.id);
    if (saveTotal === null) {
      return;
    }

    const dieValue = AfflictionService.getDieValue(rollMessage);

    const flagActorId = flags.actorId;
    const token = this._resolveToken(tokenId, flagActorId);
    const actor = token?.actor || (flagActorId ? game.actors.get(flagActorId) : null);
    const affliction = token
      ? AfflictionStore.getAffliction(token, afflictionId)
      : (actor ? AfflictionStore.getAfflictionForActor(actor, afflictionId) : null);

    const degreeResult = AfflictionService.calculateAfflictionDegreeResult(saveTotal, dc, dieValue, actor, affliction);
    const degree = this.degreeToString(degreeResult.degree);
    const degreeText = this.degreeLabel(degree);
    const degreeColor = this.degreeColor(degree);
    const incapacitationNotice = this.incapacitationNoticeHtml(degreeResult);

    const saveTypeLabel = saveType === 'initial' ? game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.INITIAL_SAVE') : game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.STAGE_SAVE');

    const actorIdAttr = flagActorId ? ` data-actor-id="${flagActorId}"` : '';
    const newContent = `
      <div class="pf2e-afflictioner-save-confirmation" style="border-left: 5px solid ${degreeColor}; padding: 12px; background: rgba(0,0,0,0.1); border-radius: 4px; margin: 8px 0;">
        <h3 style="margin: 0 0 8px 0;"><i class="fas fa-biohazard"></i> ${afflictionName} - ${saveTypeLabel}</h3>
        <p style="margin: 4px 0;"><strong>${token?.name || 'Token'}</strong> rolled <strong>${saveTotal}</strong> vs DC ${dc}</p>
        <p style="margin: 4px 0; color: ${degreeColor}; font-weight: bold;">Result: ${degreeText}</p>
        ${incapacitationNotice}
        <p style="margin: 8px 0 4px 0; font-size: 0.9em; font-style: italic; color: #ccc;">${game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.AWAITING')}</p>
        <p style="margin: 4px 0; font-size: 0.85em; color: #ffa500;">${game.i18n.localize('PF2E_AFFLICTIONER.SAVE_CONFIRMATION.UPDATED_FROM_REROLL')}</p>
        <button class="affliction-confirm-save"
                data-token-id="${tokenId}"${actorIdAttr}
                data-affliction-id="${afflictionId}"
                data-roll-message-id="${flags.rollMessageId}"
                data-dc="${dc}"
                data-save-type="${saveType}"
                style="width: 100%; padding: 8px; margin-top: 10px; background: ${degreeColor}; border: 2px solid ${degreeColor}; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-check"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.APPLY_CONSEQUENCES')}
        </button>
      </div>
    `;

    await confirmationMessage.update({ content: newContent });
  }

  static async unlockSaveButton(messageId, buttonClass) {
    return await this.syncButtonState(messageId, buttonClass, false);
  }

  static async handleUnlockSaveButton(messageId, buttonClass) {
    await this.handleSyncButtonState(messageId, buttonClass, false);
    ui.notifications.info(game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.SAVE_BUTTON_UNLOCKED'));
  }

  static async syncButtonState(messageId, buttonClass, disabled) {
    if (!this.socket) {
      console.error('PF2e Afflictioner | Socket not initialized');
      return false;
    }

    try {
      await this.socket.executeForEveryone('syncButtonState', messageId, buttonClass, disabled);
      return true;
    } catch (error) {
      console.error('PF2e Afflictioner | Error syncing button state:', error);
      return false;
    }
  }

  static async handleSyncButtonState(messageId, buttonClass, disabled) {
    if (!messageId || !buttonClass) {
      return;
    }

    let chatLog = document.getElementById('chat-log');
    if (!chatLog) {
      chatLog = document.querySelector('#chat .chat-log');
    }
    if (!chatLog && ui.chat?.element) {
      chatLog = ui.chat.element[0] || ui.chat.element;
    }

    if (!chatLog) {
      console.error('PF2e Afflictioner | Could not find chat element');
      return;
    }

    const messageElements = chatLog.querySelectorAll(`[data-message-id="${messageId}"]`);

    if (!messageElements.length) return;

    messageElements.forEach((msgElement, index) => {
      const button = msgElement.querySelector(`.${buttonClass}`);

      if (!button) {
        return;
      }

      button.disabled = disabled;
      button.style.opacity = disabled ? '0.6' : '1';

      if (disabled && game.user.isGM) {
        if (!button.nextElementSibling?.classList.contains('affliction-unlock-save')) {
          let container = button.parentElement;
          if (!container.classList.contains('affliction-button-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'affliction-button-wrapper';
            wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';
            button.parentElement.insertBefore(wrapper, button);
            wrapper.appendChild(button);
            container = wrapper;
          }

          const unlockBtn = document.createElement('button');
          unlockBtn.className = 'affliction-unlock-save';
          unlockBtn.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: linear-gradient(135deg, rgb(180, 145, 0) 0%, rgb(140, 110, 0) 100%); border: 2px dashed #ffd700; color: #ffd700; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 3px 8px rgba(0,0,0,0.4), 0 0 15px rgba(255,215,0,0.5); transition: all 0.2s ease; z-index: 5; display: flex; align-items: center; justify-content: center;';
          unlockBtn.innerHTML = `<i class="fas fa-unlock-alt"></i> ${game.i18n.localize('PF2E_AFFLICTIONER.BUTTONS.UNLOCK')}`;

          unlockBtn.addEventListener('mouseenter', () => {
            unlockBtn.style.background = 'linear-gradient(135deg, rgb(200, 165, 0) 0%, rgb(160, 130, 0) 100%)';
            unlockBtn.style.transform = 'scale(1.01)';
            unlockBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5), 0 0 25px rgba(255,215,0,0.6)';
          });

          unlockBtn.addEventListener('mouseleave', () => {
            unlockBtn.style.background = 'linear-gradient(135deg, rgb(180, 145, 0) 0%, rgb(140, 110, 0) 100%)';
            unlockBtn.style.transform = 'scale(1)';
            unlockBtn.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4), 0 0 15px rgba(255,215,0,0.5)';
          });

          unlockBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await SocketService.syncButtonState(messageId, buttonClass, false);
          });

          container.appendChild(unlockBtn);
        }
      } else if (!disabled) {
        const unlockBtn = button.nextElementSibling;
        if (unlockBtn?.classList.contains('affliction-unlock-save')) {
          unlockBtn.remove();
        }
      }
    });
  }
}
