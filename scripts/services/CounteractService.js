import { AfflictionService } from './AfflictionService.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionParser } from './AfflictionParser.js';
import { DEGREE_OF_SUCCESS } from '../constants.js';
import { RecoveryRestrictionService } from './RecoveryRestrictionService.js';

export class CounteractService {
  static async calculateAfflictionRank(affliction) {
    let afflictionLevel = affliction.level;

    if (!afflictionLevel && affliction.sourceItemUuid) {
      try {
        const sourceItem = await fromUuid(affliction.sourceItemUuid);

        afflictionLevel = sourceItem?.level || sourceItem?.system?.level?.value;

        if (!afflictionLevel && sourceItem?.actor) {
          afflictionLevel = sourceItem.actor.level || sourceItem.actor.system?.details?.level?.value;
        }
      } catch {
        console.warn('PF2e Afflictioner | Could not load source item for level detection');
      }
    }

    if (!afflictionLevel) {
      afflictionLevel = Math.max(1, Math.floor(affliction.dc / 2));
    }

    return {
      level: afflictionLevel,
      rank: Math.max(0, Math.ceil(afflictionLevel / 2))
    };
  }

  static async promptCounteract(token, affliction, casterActor = null, defaultCounterRank = null, spellEntryId = null) {
    const afflictedActor = token?.actor;
    const { level: afflictionLevel, rank: afflictionRank } = await this.calculateAfflictionRank(affliction);

    const detectedEntries = [];
    if (casterActor?.spellcasting) {
      const entries = casterActor.spellcasting.contents || [];
      for (const entry of entries) {
        if (entry.tradition && entry.statistic) {
          detectedEntries.push({ id: entry.id, name: entry.name, tradition: entry.tradition });
        }
      }
    }
    const spellcastingOptions = detectedEntries.map(e =>
      `<option value="spellcasting:${e.id}"${e.id === spellEntryId ? ' selected' : ''}>${e.name}</option>`
    ).join('') || [
      '<option value="spellcasting:arcane">Arcane Spellcasting</option>',
      '<option value="spellcasting:divine">Divine Spellcasting</option>',
      '<option value="spellcasting:occult">Occult Spellcasting</option>',
      '<option value="spellcasting:primal">Primal Spellcasting</option>'
    ].join('');

    const template = `
      <form>
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Counteract Rank</label>
          <input type="number" name="counteractRank" value="${defaultCounterRank ?? Math.max(1, afflictionRank)}" min="0" max="10" required
                 style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"/>
          <p style="font-size: 0.85em; color: #666; margin: 4px 0 0 0;">Spell rank or half creature/item level (rounded up)</p>
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Counteract DC</label>
          <input type="number" name="dc" value="${affliction.dc}" min="1" max="50" required
                 style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"/>
          <p style="font-size: 0.85em; color: #666; margin: 4px 0 0 0;">DC from affliction (can override if needed)</p>
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Check Type</label>
          <select name="skill" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            <optgroup label="Spellcasting (attr mod + proficiency)">
              ${spellcastingOptions}
            </optgroup>
            <optgroup label="Skills">
              <option value="medicine">Medicine</option>
              <option value="religion">Religion</option>
              <option value="nature">Nature</option>
              <option value="arcana">Arcana</option>
              <option value="occultism">Occultism</option>
              <option value="acrobatics">Acrobatics</option>
              <option value="athletics">Athletics</option>
              <option value="crafting">Crafting</option>
              <option value="deception">Deception</option>
              <option value="diplomacy">Diplomacy</option>
              <option value="intimidation">Intimidation</option>
              <option value="performance">Performance</option>
              <option value="society">Society</option>
              <option value="stealth">Stealth</option>
              <option value="survival">Survival</option>
              <option value="thievery">Thievery</option>
            </optgroup>
          </select>
          <p style="font-size: 0.85em; color: #666; margin: 4px 0 0 0;">Spellcasting uses ability mod + proficiency bonus per PF2e rules</p>
        </div>
        <div style="padding: 10px; background: rgba(74, 124, 42, 0.1); border-left: 3px solid #4a7c2a; border-radius: 4px;">
          <p style="margin: 0; font-size: 0.9em;"><strong>Target Affliction:</strong> ${affliction.name}</p>
          <p style="margin: 4px 0 0 0; font-size: 0.9em;"><strong>Affliction Level:</strong> ${afflictionLevel} (Rank ${afflictionRank})</p>
        </div>
      </form>
    `;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Counteract Affliction' },
      content: template,
      ok: {
        label: 'Create Counteract Prompt',
        callback: (_event, button, _dialog) => new FormDataExtended(button.form).object
      }
    });

    if (!result) return;

    const counteractRank = parseInt(result.counteractRank);
    const dc = parseInt(result.dc);
    const skill = result.skill || 'medicine';

    const skillNames = {
      acrobatics: 'Acrobatics',
      arcana: 'Arcana',
      athletics: 'Athletics',
      crafting: 'Crafting',
      deception: 'Deception',
      diplomacy: 'Diplomacy',
      intimidation: 'Intimidation',
      medicine: 'Medicine',
      nature: 'Nature',
      occultism: 'Occultism',
      performance: 'Performance',
      religion: 'Religion',
      society: 'Society',
      stealth: 'Stealth',
      survival: 'Survival',
      thievery: 'Thievery'
    };
    let skillDisplay = skillNames[skill];
    if (!skillDisplay && skill.startsWith('spellcasting:')) {
      const matchedEntry = detectedEntries.find(e => e.id === skill.split(':')[1]);
      const tradition = matchedEntry?.tradition || skill.split(':')[1] || '';
      skillDisplay = matchedEntry?.name || (tradition ? `${tradition.charAt(0).toUpperCase()}${tradition.slice(1)} Spellcasting` : 'Spellcasting');
    }
    skillDisplay = skillDisplay || skill.charAt(0).toUpperCase() + skill.slice(1);

    const showDCToPlayers = game.pf2e?.settings?.metagame?.dcs ?? true;

    {
      const playerContent = `
        <div class="pf2e-afflictioner-counteract-request">
          <h3><i class="fas fa-shield-alt"></i> Counteract: ${affliction.name}</h3>
          <p><strong>${afflictedActor?.name || 'Unknown'}</strong> - Attempt to counteract affliction</p>
          ${showDCToPlayers ? `<p><strong>${skillDisplay} Check DC:</strong> ${dc}</p>` : ''}
          <hr>
          <button class="affliction-roll-counteract"
                  data-token-id="${token?.id || ''}"${(token?.document?.actorLink && token?.actor) || (!token && afflictedActor) ? ` data-actor-id="${afflictedActor.id}"` : ''}
                  data-affliction-id="${affliction.id}"
                  data-counteract-rank="${counteractRank}"
                  data-affliction-rank="${afflictionRank}"
                  data-dc="${dc}"
                  data-skill="${skill}"
                  style="width: 100%; padding: 8px; margin-top: 10px; background: #4a7c2a; border: 2px solid #5a8c3a; color: white; border-radius: 6px; cursor: pointer;">
            <i class="fas fa-dice-d20"></i> Roll ${skillDisplay} Check
          </button>
        </div>
      `;

      await ChatMessage.create({
        content: playerContent,
        speaker: ChatMessage.getSpeaker({ token })
      });
    }
  }

  static async handleCounteractResult(token, affliction, counteractRank, afflictionRank, degree, actor = null) {
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    let maxRankDifference;
    switch (degree) {
      case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
        maxRankDifference = 3;
        break;
      case DEGREE_OF_SUCCESS.SUCCESS:
        maxRankDifference = 1;
        break;
      case DEGREE_OF_SUCCESS.FAILURE:
        maxRankDifference = -1;
        break;
      default:
        maxRankDifference = -Infinity;
        break;
    }

    const rankDiff = afflictionRank - counteractRank;
    const succeeds = rankDiff <= maxRankDifference;

    if (!succeeds) {
      if (game.user.isGM) {
        ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.COUNTERACT_FAILED', {
          afflictionName: affliction.name,
          afflictionRank,
          counteractRank,
          degree
        }));
      }
      return false;
    }

    const oldStageData = affliction.currentStage > 0 ? affliction.stages[affliction.currentStage - 1] : null;

    if (RecoveryRestrictionService.requiresCounteract(affliction)) {
      const updates = { recoveryRestrictionResolved: true };
      if (token) {
        await AfflictionStore.updateAffliction(token, affliction.id, updates);
      } else if (actor) {
        await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
      }
      await RecoveryRestrictionService.releaseAll(actor, affliction);
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RECOVERY_RESTRICTION_CLEARED', {
        afflictionName: affliction.name,
        tokenName: entityName,
        stage: affliction.currentStage,
      }));
      return true;
    }

    if (token) {
      await AfflictionStore.removeAffliction(token, affliction.id);

      if (oldStageData) {
        await AfflictionService.removeStageEffects(token, affliction, oldStageData, null);
      }

      const remainingAfflictions = AfflictionStore.getAfflictions(token);
      if (Object.keys(remainingAfflictions).length === 0) {
        const { VisualService } = await import('./VisualService.js');
        await VisualService.removeAfflictionIndicator(token);
      }
    } else if (actor) {
      await AfflictionStore.removeAfflictionForActor(actor, affliction.id);
    }

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.COUNTERACTED', {
      afflictionName: affliction.name,
      tokenName: entityName
    }));
    return true;
  }

  static async reduceAfflictionStage(token, affliction, actor = null) {
    actor = actor || token?.actor;
    const newStage = Math.max(
      RecoveryRestrictionService.getMinimumStage(affliction),
      affliction.currentStage - 1,
    );
    const combat = game.combat;

    const oldStageData = affliction.stages[affliction.currentStage - 1];
    const newStageData = affliction.stages[newStage - 1];

    const updates = {
      currentStage: newStage,
      treatmentBonus: 0,
      treatedThisStage: false
    };

    if (newStageData) {
      if (combat) {
        const durationSeconds = await AfflictionParser.resolveStageDuration(newStageData.duration, `${affliction.name} Stage ${newStage}`);
        const durationRounds = Math.ceil(durationSeconds / 6);
        updates.nextSaveRound = combat.round + durationRounds;
        if (token) {
          const tokenCombatant = combat.combatants.find(c => c.tokenId === token.id);
          updates.nextSaveInitiative = tokenCombatant?.initiative;
        }
        updates.stageStartRound = combat.round;
      } else {
        const durationSeconds = await AfflictionParser.resolveStageDuration(newStageData.duration, `${affliction.name} Stage ${newStage}`);
        updates.nextSaveTimestamp = game.time.worldTime + durationSeconds;
      }
    }

    if (token) {
      await AfflictionStore.updateAffliction(token, affliction.id, updates);
    } else if (actor) {
      await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
    }

    const updatedAffliction = token
      ? AfflictionStore.getAffliction(token, affliction.id)
      : AfflictionStore.getAfflictionForActor(actor, affliction.id);

    if (token) {
      await AfflictionService.removeStageEffects(token, updatedAffliction, oldStageData, newStageData);
      if (newStageData) {
        await AfflictionService.applyStageEffects(token, updatedAffliction, newStageData);
      }
    }
  }
}
