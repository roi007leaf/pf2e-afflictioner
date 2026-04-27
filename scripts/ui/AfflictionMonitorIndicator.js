import { MODULE_ID, DURATION_MULTIPLIERS } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionParser } from '../services/AfflictionParser.js';

class AfflictionMonitorIndicator {
  static #instance = null;

  static getInstance() {
    if (!this.#instance) this.#instance = new this();
    return this.#instance;
  }

  constructor() {
    this._el = null;
    this._popoverEl = null;
    this._data = null;
    this._drag = { active: false, start: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, moved: false };
    this._boundDocumentMouseDown = (ev) => this.#onDocumentMouseDown(ev);
    this._boundDocumentKeyDown = (ev) => this.#onDocumentKeyDown(ev);
  }

  refresh() {
    if (!game.user?.isGM) return;

    const result = this.#getAfflictedTokens();

    if (result.count === 0) {
      this.hide();
      return;
    }

    this._data = result;
    this.#ensureStyles();
    if (!this._el) this.#createElement();
    this.#updateBadge();
    if (this._popoverEl?.isConnected) this.#renderPopoverContents();
    this._el.classList.add('pf2e-afflictioner-monitor--visible');

    if (result.needsAttention) {
      this._el.classList.add('needs-attention');
    } else {
      this._el.classList.remove('needs-attention');
    }
  }

  hide() {
    if (!this._el) return;
    this._el.classList.remove('pf2e-afflictioner-monitor--visible');
    this._el.classList.remove('needs-attention');
    this.#hidePopover();
  }

  #getAfflictedTokens() {
    const tokens = [];
    let totalCount = 0;
    let needsAttention = false;
    const seenActorIds = new Set();

    if (!canvas.tokens) return { tokens, count: 0, needsAttention: false };

    const tokensToCheck = canvas.tokens.controlled.length > 0
      ? canvas.tokens.controlled
      : canvas.tokens.placeables;

    for (const token of tokensToCheck) {
      const afflictions = AfflictionStore.getAfflictions(token);
      const afflictionList = Object.values(afflictions);

      if (afflictionList.length > 0) {
        totalCount += afflictionList.length;

        for (const aff of afflictionList) {
          if (this.#afflictionNeedsAttention(aff)) {
            needsAttention = true;
          }
        }

        tokens.push({
          token: token,
          tokenId: token.id,
          actorId: (token.document.actorLink && token.actor) ? token.actor.id : null,
          name: token.name,
          afflictions: afflictionList
        });
        if (token.document.actorLink && token.actor) seenActorIds.add(token.actor.id);
      }
    }

    // Include off-scene linked actors with afflictions (only when showing all, not controlled)
    if (canvas.tokens.controlled.length === 0) {
      for (const actor of game.actors) {
        if (seenActorIds.has(actor.id)) continue;
        const afflictions = AfflictionStore.getAfflictionsForActor(actor);
        const afflictionList = Object.values(afflictions);
        if (afflictionList.length === 0) continue;

        totalCount += afflictionList.length;
        for (const aff of afflictionList) {
          if (this.#afflictionNeedsAttention(aff)) needsAttention = true;
        }

        tokens.push({
          token: null,
          tokenId: null,
          actorId: actor.id,
          name: actor.name,
          afflictions: afflictionList
        });
      }
    }

    return { tokens, count: totalCount, needsAttention };
  }

  #afflictionNeedsAttention(affliction) {
    const combat = game.combat;

    if (affliction.inOnset && affliction.onsetRemaining <= 0) return true;

    if (combat && affliction.nextSaveRound && combat.round >= affliction.nextSaveRound) return true;

    if (!combat && !affliction.inOnset) {
      const stage = affliction.stages?.[affliction.currentStage - 1];
      if (stage?.duration) {
        const unit = stage.duration.unit?.toLowerCase() || 'round';
        const multiplier = DURATION_MULTIPLIERS[unit] || DURATION_MULTIPLIERS['round'];
        const totalDuration = stage.duration.value * multiplier;
        const elapsed = affliction.durationElapsed || 0;
        if (elapsed >= totalDuration) return true;
      }
    }

    return false;
  }

  async openManager(tokenId = null, actorId = null) {
    if (!game.user?.isGM) return;
    try {
      const { AfflictionManager } = await import('../managers/AfflictionManager.js');
      if (AfflictionManager.currentInstance) {
        AfflictionManager.currentInstance.close();
      }
      new AfflictionManager({ filterTokenId: tokenId, filterActorId: actorId }).render(true);
    } catch (e) {
      console.error('PF2e Afflictioner | Failed to open manager:', e);
    }
  }

  #updateBadge() {
    const badge = this._el?.querySelector('.indicator-badge');
    if (!badge) return;
    const count = this._data?.count || 0;
    badge.textContent = count > 0 ? String(count) : '';
  }

  #createElement() {
    this.#ensureStyles();

    const el = document.createElement('div');
    el.className = 'pf2e-afflictioner-monitor';
    el.innerHTML = `
      <div class="indicator-icon"><i class="fas fa-biohazard"></i></div>
      <div class="indicator-badge"></div>
    `;

    try {
      const saved = localStorage.getItem('pf2e-afflictioner-monitor-pos');
      if (saved) {
        const pos = JSON.parse(saved);
        if (pos?.left) el.style.left = pos.left;
        if (pos?.top) el.style.top = pos.top;
      }
    } catch { }

    this._boundMouseMove = (ev) => this.#onMouseMove(ev);
    this._boundMouseUp = (ev) => this.#onMouseUp(ev);
    el.addEventListener('mousedown', (ev) => this.#onMouseDown(ev));

    el.addEventListener('click', async (ev) => {
      if (this._drag.moved) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.#togglePopover();
    });

    document.body.appendChild(el);
    this._el = el;
  }

  #onMouseDown(event) {
    if (event.button !== 0) return;
    this._drag.active = true;
    this._drag.moved = false;
    this._drag.start.x = event.clientX;
    this._drag.start.y = event.clientY;
    const rect = this._el.getBoundingClientRect();
    this._drag.offset.x = event.clientX - rect.left;
    this._drag.offset.y = event.clientY - rect.top;
    this._el.classList.add('dragging');
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
  }

  #onMouseMove(event) {
    if (!this._drag.active) return;
    const dx = event.clientX - this._drag.start.x;
    const dy = event.clientY - this._drag.start.y;
    if (!this._drag.moved && Math.hypot(dx, dy) > 4) this._drag.moved = true;
    if (!this._drag.moved) return;
    const x = event.clientX - this._drag.offset.x;
    const y = event.clientY - this._drag.offset.y;
    const maxX = window.innerWidth - this._el.offsetWidth;
    const maxY = window.innerHeight - this._el.offsetHeight;
    this._el.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    this._el.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  }

  #onMouseUp() {
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);
    if (!this._drag.active) return;
    this._drag.active = false;
    this._el.classList.remove('dragging');
    if (this._drag.moved) {
      try {
        localStorage.setItem(
          'pf2e-afflictioner-monitor-pos',
          JSON.stringify({ left: this._el.style.left, top: this._el.style.top })
        );
      } catch { }
      setTimeout(() => (this._drag.moved = false), 50);
    } else {
      this._drag.moved = false;
    }
  }

  #togglePopover() {
    if (this._popoverEl?.isConnected) {
      this.#hidePopover();
      return;
    }

    this.#showPopover();
  }

  #showPopover() {
    if (!this._data?.tokens?.length) return;

    const popover = document.createElement('div');
    popover.className = 'pf2e-afflictioner-popover';
    this._popoverEl = popover;
    this.#renderPopoverContents();

    document.body.appendChild(popover);
    document.addEventListener('mousedown', this._boundDocumentMouseDown);
    document.addEventListener('keydown', this._boundDocumentKeyDown);
    const rect = this._el.getBoundingClientRect();
    popover.style.left = rect.right + 8 + 'px';
    popover.style.top = Math.max(8, rect.top - 8) + 'px';
  }

  #hidePopover() {
    document.removeEventListener('mousedown', this._boundDocumentMouseDown);
    document.removeEventListener('keydown', this._boundDocumentKeyDown);
    if (this._popoverEl?.parentElement) this._popoverEl.parentElement.removeChild(this._popoverEl);
    this._popoverEl = null;
  }

  #onDocumentMouseDown(event) {
    if (!this._popoverEl?.isConnected) return;
    const target = event.target;
    if (this._popoverEl.contains(target) || this._el?.contains(target)) return;
    this.#hidePopover();
  }

  #onDocumentKeyDown(event) {
    if (event.key === 'Escape') this.#hidePopover();
  }

  #formatAfflictionTime(a) {
    const combat = game.combat;

    if (a.inOnset) {
      return game.i18n.format('PF2E_AFFLICTIONER.MANAGER.ONSET_PREFIX', { duration: AfflictionParser.formatDuration(a.onsetRemaining) });
    }

    if (a.currentStage === -1 || a.needsInitialSave) {
      return game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.INITIAL_SAVE');
    }

    const stage = a.stages?.[a.currentStage - 1];
    if (stage?.duration) {
      if (combat && a.nextSaveRound) {
        const remaining = a.nextSaveRound - combat.round;
        return remaining <= 0 ? game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.SAVE_DUE') : game.i18n.format('PF2E_AFFLICTIONER.MONITOR.ROUNDS_UNTIL_SAVE', { rounds: remaining });
      }

      const unit = stage.duration.unit?.toLowerCase() || 'round';
      const multiplier = DURATION_MULTIPLIERS[unit] || DURATION_MULTIPLIERS['round'];
      const totalDuration = stage.duration.value * multiplier;
      const elapsed = a.durationElapsed || 0;
      const remainingSeconds = Math.max(0, totalDuration - elapsed);
      return remainingSeconds <= 0 ? game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.SAVE_DUE') : game.i18n.format('PF2E_AFFLICTIONER.MONITOR.TIME_UNTIL_SAVE', { duration: AfflictionParser.formatDuration(remainingSeconds) });
    }

    return a.currentStage > 0 ? `${game.i18n.localize('PF2E_AFFLICTIONER.MANAGER.STAGE')} ${a.currentStage}` : game.i18n.localize('PF2E_AFFLICTIONER.MONITOR.NO_STAGE');
  }

  #renderPopoverContents() {
    if (!this._popoverEl) return;

    const tokens = this._data?.tokens || [];
    const hasSelection = canvas.tokens.controlled.length > 0;

    let content = '';

    if (hasSelection) {
      const rows = [];
      for (const t of tokens) {
        for (const a of t.afflictions) {
          rows.push(`
            <div class="tip-row clickable" data-token-id="${t.tokenId || ''}" data-actor-id="${t.actorId || ''}">
              <div class="affliction-name"><strong>${a.name}</strong> <span class="token-label">(${t.name})</span></div>
              <div class="affliction-time">${this.#formatAfflictionTime(a)}</div>
            </div>
          `);
        }
      }
      content = rows.join('');
    } else {
      const groups = tokens.map(t => {
        const afflictions = t.afflictions.map(a => `
          <div class="affliction-item">
            <div class="affliction-name"><strong>${a.name}</strong></div>
            <div class="affliction-time">${this.#formatAfflictionTime(a)}</div>
          </div>
        `).join('');

        return `
          <div class="tip-group clickable" data-token-id="${t.tokenId || ''}" data-actor-id="${t.actorId || ''}">
            <div class="token-header"><i class="fas fa-user"></i> ${t.name}${!t.tokenId ? ' <span style="opacity:0.6">(off-scene)</span>' : ''}</div>
            ${afflictions}
          </div>
        `;
      }).join('');
      content = groups;
    }

    this._popoverEl.innerHTML = `
      <div class="tip-header">
        <span><i class="fas fa-biohazard"></i> ${this._data?.count || 0} ${(this._data?.count !== 1) ? game.i18n.localize('PF2E_AFFLICTIONER.MONITOR.ACTIVE_AFFLICTIONS_PLURAL') : game.i18n.localize('PF2E_AFFLICTIONER.MONITOR.ACTIVE_AFFLICTIONS_SINGULAR')}</span>
        <button type="button" class="popover-close" aria-label="Close"><i class="fas fa-times"></i></button>
      </div>
      <div class="tip-content">
        ${content}
      </div>
    `;

    this._popoverEl.querySelector('.popover-close')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.#hidePopover();
    });

    this._popoverEl.querySelectorAll('.tip-row.clickable, .tip-group.clickable').forEach(row => {
      row.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const tokenId = row.dataset.tokenId || null;
        const actorId = row.dataset.actorId || null;
        await this.openManager(tokenId, actorId);
      });
    });
  }

  #ensureStyles() {
    const existing = document.getElementById('pf2e-afflictioner-monitor-styles');
    const css = `
      .pf2e-afflictioner-monitor {
        position: fixed;
        top: 60%;
        left: 10px;
        width: 42px;
        height: 42px;
        background: rgba(20, 20, 20, 0.95);
        border: 2px solid var(--afflictioner-primary, #8b0000);
        border-radius: 9px;
        color: #fff;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: move;
        z-index: 1001;
        box-shadow: 0 2px 12px rgba(139, 0, 0, 0.5);
        transition: transform .15s ease, box-shadow .15s ease;
        user-select: none;
      }
      .pf2e-afflictioner-monitor--visible { display: flex; }
      .pf2e-afflictioner-monitor.dragging {
        cursor: grabbing;
        transform: scale(1.06);
        box-shadow: 0 4px 18px rgba(139, 0, 0, 0.7);
      }
      .pf2e-afflictioner-monitor .indicator-icon {
        font-size: 18px;
        color: #ffff00;
        filter: drop-shadow(0 0 4px rgba(255, 255, 0, 0.6));
      }
      .pf2e-afflictioner-monitor .indicator-badge {
        position: absolute;
        top: -8px;
        right: -6px;
        background: rgba(244, 67, 54, 0.95);
        color: #fff;
        border: 1px solid #f44336;
        border-radius: 7px;
        padding: 2px 6px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        min-width: 18px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .pf2e-afflictioner-monitor.needs-attention {
        box-shadow: 0 4px 20px rgba(255, 0, 0, 1);
        border-color: #ff0000;
      }

      .pf2e-afflictioner-monitor.needs-attention .indicator-icon {
        filter: drop-shadow(0 0 12px rgba(255, 255, 0, 1));
      }

      .pf2e-afflictioner-popover {
        position: fixed;
        min-width: 300px;
        max-width: 450px;
        background: rgba(30, 30, 30, 0.98);
        color: #fff;
        border: 2px solid var(--afflictioner-border, rgba(139, 0, 0, 0.5));
        border-radius: 8px;
        z-index: 1002;
        font-size: 12px;
        box-shadow: 0 2px 16px rgba(139, 0, 0, 0.6);
      }
      .pf2e-afflictioner-popover {
        min-width: 320px;
      }
      .pf2e-afflictioner-popover .tip-header {
        padding: 8px;
        font-weight: 600;
        color: var(--afflictioner-primary, #8b0000);
        border-bottom: 1px solid rgba(139, 0, 0, 0.3);
      }
      .pf2e-afflictioner-popover .tip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .pf2e-afflictioner-popover .popover-close {
        width: 24px;
        height: 24px;
        padding: 0;
        margin: 0;
        border: 1px solid rgba(139, 0, 0, 0.45);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.25);
        color: #d0d0d0;
        line-height: 1;
        cursor: pointer;
      }
      .pf2e-afflictioner-popover .popover-close:hover {
        color: #fff;
        border-color: var(--afflictioner-primary-hover, #a00000);
        background: rgba(139, 0, 0, 0.3);
      }
      .pf2e-afflictioner-popover .tip-content {
        padding: 8px;
        max-height: 300px;
        overflow-y: auto;
      }
      .pf2e-afflictioner-popover .tip-row {
        padding: 8px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .pf2e-afflictioner-popover .tip-row.clickable,
      .pf2e-afflictioner-popover .tip-group.clickable {
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .pf2e-afflictioner-popover .tip-row.clickable {
        padding: 8px;
        margin: 0 -8px;
      }
      .pf2e-afflictioner-popover .tip-row.clickable:hover,
      .pf2e-afflictioner-popover .tip-group.clickable:hover {
        background-color: rgba(139, 0, 0, 0.3);
      }
      .pf2e-afflictioner-popover .tip-row:first-child {
        border-top: none;
      }
      .pf2e-afflictioner-popover .affliction-name {
        font-weight: 600;
        color: #e0e0e0;
        margin-bottom: 4px;
      }
      .pf2e-afflictioner-popover .token-label {
        font-weight: normal;
        color: #888;
        font-size: 11px;
      }
      .pf2e-afflictioner-popover .affliction-time {
        color: #b0b0b0;
        font-size: 11px;
        padding-left: 20px;
      }
      .pf2e-afflictioner-popover .tip-group {
        margin-bottom: 12px;
      }
      .pf2e-afflictioner-popover .tip-group:last-child {
        margin-bottom: 0;
      }
      .pf2e-afflictioner-popover .token-header {
        font-weight: 600;
        color: #e0e0e0;
        margin-bottom: 6px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(139, 0, 0, 0.3);
      }
      .pf2e-afflictioner-popover .tip-group.clickable .token-header {
        padding: 4px 8px;
        margin: 0 -8px 6px -8px;
        border-radius: 4px;
      }
      .pf2e-afflictioner-popover .tip-group.clickable:hover .token-header {
        color: #fff;
      }
      .pf2e-afflictioner-popover .affliction-item {
        padding: 4px 0 4px 16px;
      }
      .pf2e-afflictioner-popover .affliction-item .affliction-name {
        margin-bottom: 2px;
      }
      .pf2e-afflictioner-popover .affliction-item .affliction-time {
        padding-left: 0;
      }
      .pf2e-afflictioner-popover .tip-footer {
        padding: 6px 8px;
        border-top: 1px solid rgba(139, 0, 0, 0.3);
        text-align: center;
        font-size: 11px;
        color: #888;
      }
    `;

    if (existing) {
      existing.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = 'pf2e-afflictioner-monitor-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }
}

const afflictionMonitorIndicator = AfflictionMonitorIndicator.getInstance();
export default afflictionMonitorIndicator;
export { AfflictionMonitorIndicator };
