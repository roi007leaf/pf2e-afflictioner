import { MODULE_ID } from '../constants.js';
import { AfflictionParser } from '../services/AfflictionParser.js';
import { AfflictionService } from '../services/AfflictionService.js';
import { shouldSkipAffliction } from '../utils.js';

const RegionBehaviorBase =
  typeof foundry !== 'undefined' &&
  foundry.data &&
  foundry.data.regionBehaviors &&
  foundry.data.regionBehaviors.RegionBehaviorType
    ? foundry.data.regionBehaviors.RegionBehaviorType
    : class {};

const ENTER_EVENTS = () =>
  new Set([
    globalThis.CONST?.REGION_EVENTS?.BEHAVIOR_ACTIVATED,
    globalThis.CONST?.REGION_EVENTS?.TOKEN_ENTER,
    globalThis.CONST?.REGION_EVENTS?.TOKEN_MOVE_IN,
    globalThis.CONST?.REGION_EVENTS?.TOKEN_ANIMATE_IN
  ].filter(Boolean));

const TOKEN_REGION_EVENTS = () =>
  new Set([
    ...ENTER_EVENTS(),
    globalThis.CONST?.REGION_EVENTS?.TOKEN_EXIT,
    globalThis.CONST?.REGION_EVENTS?.TOKEN_MOVE_OUT,
    globalThis.CONST?.REGION_EVENTS?.TOKEN_ANIMATE_OUT
  ].filter(Boolean));

export const AFFLICTION_REGION_BEHAVIOR_TYPE = `${MODULE_ID}.Pf2eAfflictionerAffliction`;

export function parseAfflictionUuids(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[\n,;]+/);
  const seen = new Set();
  const uuids = [];

  for (const entry of raw) {
    const uuid = String(entry ?? '').trim();
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    uuids.push(uuid);
  }

  return uuids;
}

export function resolveTokenFromRegionEvent(event) {
  if (!event) return null;
  if (event.token && typeof event.token === 'object') return event.token;
  if (event.item?.token) return event.item.token;
  if (event.target?.actor) return event.target;

  const tokenId =
    (typeof event.token === 'string' && event.token) ||
    event.tokenId ||
    event.data?.token?.id ||
    (typeof event.data?.token === 'string' && event.data.token) ||
    null;

  if (tokenId && globalThis.canvas?.tokens?.get) return canvas.tokens.get(tokenId);

  if (typeof event.tokenUuid === 'string' && globalThis.canvas?.tokens?.get) {
    const tokenUuidParts = event.tokenUuid.split('.');
    return canvas.tokens.get(tokenUuidParts[tokenUuidParts.length - 1]);
  }

  return null;
}

export class AfflictionRegionBehavior extends RegionBehaviorBase {
  static LOCALIZATION_PREFIXES = ['PF2E_AFFLICTIONER.REGION_BEHAVIOR'];

  static get label() {
    return 'PF2e Afflictioner Affliction';
  }

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      events: this._createEventsField({
        events: [
          CONST.REGION_EVENTS.BEHAVIOR_ACTIVATED,
          CONST.REGION_EVENTS.TOKEN_ENTER,
          CONST.REGION_EVENTS.TOKEN_EXIT
        ]
      }),

      afflictionUuids: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
        label: 'PF2E_AFFLICTIONER.REGION_BEHAVIOR.AFFLICTION_UUIDS.label',
        hint: 'PF2E_AFFLICTIONER.REGION_BEHAVIOR.AFFLICTION_UUIDS.hint'
      }),

      skipExistingAfflictionUuids: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
        label: 'PF2E_AFFLICTIONER.REGION_BEHAVIOR.SKIP_EXISTING_AFFLICTION_UUIDS.label',
        hint: 'PF2E_AFFLICTIONER.REGION_BEHAVIOR.SKIP_EXISTING_AFFLICTION_UUIDS.hint'
      })
    };
  }

  async _handleRegionEvent(event) {
    const eventName = event?.name ?? event?.type;
    if (!TOKEN_REGION_EVENTS().has(eventName)) return;
    if (!game?.user?.isGM) return;

    const token = resolveTokenFromRegionEvent(event);
    if (!token?.actor) return;

    await this._applyConfiguredAfflictions(token);
  }

  async _applyConfiguredAfflictions(token) {
    const skipExistingUuids = new Set(parseAfflictionUuids(this.skipExistingAfflictionUuids));

    for (const uuid of parseAfflictionUuids(this.afflictionUuids)) {
      try {
        const item = await fromUuid(uuid);
        if (!item) continue;

        const afflictionData = this._parseAfflictionItem(item);
        if (shouldSkipAffliction(afflictionData)) continue;
        if (skipExistingUuids.has(uuid) && this._tokenHasAffliction(token, afflictionData)) {
          continue;
        }

        await AfflictionService.promptInitialSave(token, afflictionData);
      } catch (error) {
        console.error('PF2e Afflictioner | Error applying region affliction:', error);
      }
    }
  }

  _parseAfflictionItem(item) {
    return AfflictionParser.parseFromItem(item);
  }

  _tokenHasAffliction(token, afflictionData) {
    if (!token || !afflictionData?.name) return false;
    return !!AfflictionService.findExistingAffliction(token, afflictionData.name);
  }
}
