import { DEFAULT_AFFLICTION_ICON, DEGREE_OF_SUCCESS, MODULE_ID } from '../constants.js';
import * as Store from '../stores/AfflictionStore.js';
import { AfflictionEffectBuilder } from './AfflictionEffectBuilder.js';
import { AfflictionChatService } from './AfflictionChatService.js';
import { FeatsService } from './FeatsService.js';
import { AfflictionParser } from './AfflictionParser.js';

const DAY = 86400;
const WEEK = 7 * DAY;

/** Legacy addiction is a disease with separate drug-use and recovery saves. */
export class AddictionService {
  static isEnabled() {
    return game.settings.get(MODULE_ID, 'enableAddictionRules') === true;
  }

  static isDrugItem(item) {
    return item?.system?.traits?.value?.includes('drug') === true;
  }

  static getDrugDC(item) {
    const description = item.system?.description?.value || '';
    const fortitudeCheck = description.match(/@Check\[(?:type:)?fortitude\b[^\]]*\bdc:\d+[^\]]*\]/i);
    // Drug DC belongs to the item, never to the actor carrying it.
    const dc = Number(AfflictionParser.extractDC(fortitudeCheck?.[0] || description, {
      name: item.name, uuid: item.uuid, system: { save: item.system?.save, dc: item.system?.dc },
    }));
    return Number.isInteger(dc) && dc > 0 ? dc : null;
  }

  static createDefinitionFromItem(item, dc = this.getDrugDC(item)) {
    if (!this.isDrugItem(item)) throw Error('Item must have the drug trait');
    return {
      ...this.createDefinition(item.name, dc),
      img: item.img || DEFAULT_AFFLICTION_ICON, sourceItemUuid: item.uuid,
      level: item.system?.level?.value,
    };
  }

  static createDefinition(drugName, dc) {
    drugName = String(drugName ?? '').trim();
    dc = Number(dc);
    if (!drugName || !Number.isInteger(dc) || dc < 1) throw Error('Drug name and positive integer DC required');
    const conditions = [
      [{ name: 'fatigued', value: null }],
      [{ name: 'fatigued', value: null }, { name: 'sickened', value: 1 }],
      [{ name: 'fatigued', value: null }, { name: 'drained', value: 1 }, { name: 'sickened', value: 1 }],
      [{ name: 'fatigued', value: null }, { name: 'drained', value: 2 }, { name: 'sickened', value: 2 }, { name: 'stupefied', value: 2 }],
    ];
    return {
      name: `${game.i18n.localize('PF2E_AFFLICTIONER.ADDICTION.NAME')} (${drugName})`,
      isAddiction: true, drugName, drugKey: drugName.normalize('NFKC').toLowerCase(),
      type: 'disease', traits: ['disease'], dc, saveType: 'fortitude',
      onset: { value: 1, unit: 'day' }, maxDuration: null, img: DEFAULT_AFFLICTION_ICON,
      stages: conditions.map((values, i) => ({
        number: i + 1, conditions: values, damage: [], weakness: [],
        effects: values.map(c => `${c.name}${c.value ? ` ${c.value}` : ''}`).join(', '),
        duration: { value: 1, unit: 'week' }, requiresManualHandling: false,
      })),
    };
  }

  static get(token, actor, id) {
    return token ? Store.getAffliction(token, id) : Store.getAfflictionForActor(actor, id);
  }

  static async update(token, actor, id, updates) {
    if (token) await Store.updateAffliction(token, id, updates);
    else await Store.updateAfflictionForActor(actor, id, updates);
    return this.get(token, actor, id);
  }

  static async promptDrugUse(token, definition, actor = token?.actor) {
    if (!this.isEnabled() || !actor || !game.user.isGM) return;
    const values = token ? Store.getAfflictions(token) : Store.getAfflictionsForActor(actor);
    let affliction = Object.values(values).find(a => a.isAddiction && a.drugKey === definition.drugKey);
    // Reopening a pending request must not create another disease or reset timers.
    if (!affliction?.drugSavePending) {
      const now = game.time.worldTime;
      if (affliction) {
        affliction = await this.update(token, actor, affliction.id, {
          drugSavePending: true, drugTakenAt: now, suppressedUntil: now + DAY, dc: definition.dc,
        });
        await this.syncEffect(token, actor, affliction);
      } else {
        affliction = {
          ...definition, id: foundry.utils.randomID(), currentStage: -1,
          needsInitialSave: true, inOnset: false, drugSavePending: true,
          drugTakenAt: now, suppressedUntil: now + DAY, nextSaveTimestamp: null,
          addedTimestamp: Date.now(), durationElapsed: 0, treatmentBonus: 0,
        };
        if (token) {
          await Store.addAffliction(token, affliction);
          const { VisualService } = await import('./VisualService.js');
          await VisualService.addAfflictionIndicator(token);
        } else await Store.addAfflictionForActor(actor, affliction);
      }
    }
    await AfflictionChatService.promptInitialSave(token, affliction, affliction, affliction.id, actor);
    return affliction;
  }

  static async handleDrugSave(token, affliction, degree, actor = token?.actor) {
    if (!this.isEnabled() || !actor || !game.user.isGM || !affliction.drugSavePending) return;
    const failed = degree === DEGREE_OF_SUCCESS.FAILURE || degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE;
    if (!failed) {
      if (affliction.needsInitialSave) {
        await this.remove(token, actor, affliction);
        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RESISTED', { tokenName: token?.name || actor.name, afflictionName: affliction.name }));
        return;
      }
      await this.update(token, actor, affliction.id, { drugSavePending: false });
      return;
    }
    const maximum = Store.getAddictionMaximum(token, actor, affliction.drugKey);
    const stage = Math.min(affliction.stages.length, maximum + (degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE ? 2 : 1));
    if (affliction.needsInitialSave || affliction.inOnset) {
      const updated = await this.update(token, actor, affliction.id, {
        needsInitialSave: false, drugSavePending: false, currentStage: 0, inOnset: true,
        stageAdvancement: stage, onsetEndsAt: affliction.onsetEndsAt ?? affliction.drugTakenAt + DAY,
        onsetRemaining: Math.max(0, (affliction.onsetEndsAt ?? affliction.drugTakenAt + DAY) - game.time.worldTime),
      });
      await this.processTime(token, actor, updated);
    } else {
      await this.changeStage(token, actor, affliction, stage, { drugSavePending: false });
    }
  }

  static async handleRecoverySave(token, affliction, degree, actor = token?.actor) {
    if (!this.isEnabled() || !actor || !game.user.isGM || affliction.needsInitialSave || affliction.inOnset) return;
    const fastRecovery = FeatsService.hasFastRecovery(actor) ? FeatsService.getFastRecoveryStageChange(degree, false) : null;
    const reduction = fastRecovery !== null ? -fastRecovery : degree === DEGREE_OF_SUCCESS.CRITICAL_SUCCESS ? 2 : degree === DEGREE_OF_SUCCESS.SUCCESS ? 1 : 0;
    return this.changeStage(token, actor, affliction, Math.max(0, affliction.currentStage - reduction));
  }

  static async changeStage(token, actor, affliction, stage, extra = {}) {
    if (!this.isEnabled() || !actor || !game.user.isGM) return;
    stage = Math.max(0, Math.min(stage, affliction.stages.length));
    if (stage === 0) {
      await this.remove(token, actor, affliction);
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RECOVERED', { tokenName: token?.name || actor.name, afflictionName: affliction.name }));
      return;
    }
    const updated = await this.update(token, actor, affliction.id, {
      currentStage: stage, needsInitialSave: false, inOnset: false, onsetRemaining: 0,
      nextSaveTimestamp: game.time.worldTime + WEEK, savePrompted: false,
      durationElapsed: 0, treatmentBonus: 0, treatedThisStage: false, ...extra,
    });
    await this.syncEffect(token, actor, updated);
    if (affliction.currentStage !== stage) {
      await AfflictionChatService.postStageChange(token, affliction, Math.max(0, affliction.currentStage), stage, { actor });
    }
  }

  static async syncEffect(token, actor, affliction) {
    if (!this.isEnabled() || !actor || !affliction || affliction.needsInitialSave) return;
    const stage = affliction.stages[affliction.currentStage - 1] || { effects: '', conditions: [] };
    // Resolve on the actor so off-scene actors and deleted/recreated effects work too.
    const effect = actor.items.find(i => i.type === 'effect' && i.flags?.[MODULE_ID]?.afflictionId === affliction.id);
    const uuid = await AfflictionEffectBuilder.createOrUpdateEffect(token, actor, {
      ...affliction, appliedEffectUuid: effect?.uuid || null,
    }, stage);
    if (uuid && uuid !== affliction.appliedEffectUuid) {
      await this.update(token, actor, affliction.id, { appliedEffectUuid: uuid });
    }
  }

  static async remove(token, actor, affliction) {
    if (!actor || !game.user.isGM) return;
    // Store removal records the high-water mark before deleting the disease.
    if (token) await Store.removeAffliction(token, affliction.id);
    else await Store.removeAfflictionForActor(actor, affliction.id);
    for (const effect of actor.items.filter(i => i.type === 'effect' && i.flags?.[MODULE_ID]?.afflictionId === affliction.id)) {
      await effect.delete();
    }
    if (token && Object.keys(Store.getAfflictions(token)).length === 0) {
      const { VisualService } = await import('./VisualService.js');
      await VisualService.removeAfflictionIndicator(token);
    }
  }

  static async processTime(token, actor, affliction) {
    if (!this.isEnabled() || !affliction.isAddiction || affliction.needsInitialSave || !game.user.isGM) return;
    if (game.users?.activeGM && game.users.activeGM.id !== game.user.id) return;
    const now = game.time.worldTime;
    const updates = {};
    let refresh = false;
    if (affliction.suppressedUntil != null && now >= affliction.suppressedUntil) {
      updates.suppressedUntil = null;
      refresh = true;
    }
    if (affliction.inOnset) {
      updates.onsetRemaining = Math.max(0, affliction.onsetEndsAt - now);
      if (now >= affliction.onsetEndsAt) {
        Object.assign(updates, {
          inOnset: false, currentStage: affliction.stageAdvancement,
          nextSaveTimestamp: affliction.onsetEndsAt + WEEK, savePrompted: false,
        });
        refresh = true;
      }
    }
    if (Object.keys(updates).length) affliction = await this.update(token, actor, affliction.id, updates);
    if (refresh) await this.syncEffect(token, actor, affliction);
    if (!affliction.inOnset && affliction.nextSaveTimestamp != null && now >= affliction.nextSaveTimestamp && !affliction.savePrompted) {
      await this.update(token, actor, affliction.id, { savePrompted: true });
      await AfflictionChatService.promptStageSave(token, affliction, actor);
    }
  }
}
