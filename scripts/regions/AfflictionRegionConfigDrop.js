import { AfflictionParser } from '../services/AfflictionParser.js';
import { shouldSkipAffliction } from '../utils.js';
import {
  AFFLICTION_REGION_BEHAVIOR_TYPE,
  parseAfflictionUuids
} from './AfflictionRegionBehavior.js';

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  if (html.element instanceof HTMLElement) return html.element;
  return null;
}

function getRegionBehaviorDocument(app) {
  return app?.document ?? app?.object ?? null;
}

function isAfflictionRegionBehaviorConfig(app) {
  const document = getRegionBehaviorDocument(app);
  return document?.documentName === 'RegionBehavior' && document?.type === AFFLICTION_REGION_BEHAVIOR_TYPE;
}

function getAfflictionUuidInput(element) {
  return element?.querySelector?.('[name="system.afflictionUuids"], [name="afflictionUuids"]') ?? null;
}

function getSkipExistingInput(element) {
  return element?.querySelector?.('[name="system.skipExistingAfflictionUuids"], [name="skipExistingAfflictionUuids"]') ?? null;
}

function getDropTarget(input) {
  return input.closest?.('.form-group') ?? input.parentElement ?? input;
}

function syncRowsToInput(input, skipExistingInput, container) {
  const uuids = Array.from(container.querySelectorAll('.pf2e-afflictioner-region-uuid-input'))
    .map((rowInput) => rowInput.value.trim())
    .filter(Boolean);

  input.value = parseAfflictionUuids(uuids).join('\n');
  input.dispatchEvent(new Event('change', { bubbles: true }));

  if (!skipExistingInput) return;

  const skippedUuids = Array.from(container.querySelectorAll('.pf2e-afflictioner-region-uuid-row'))
    .filter((row) => row.querySelector('.pf2e-afflictioner-region-skip-existing')?.checked)
    .map((row) => row.querySelector('.pf2e-afflictioner-region-uuid-input')?.value.trim())
    .filter(Boolean);

  skipExistingInput.value = parseAfflictionUuids(skippedUuids).join('\n');
  skipExistingInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function createUuidRow(input, skipExistingInput, container, value = '') {
  const skipExistingUuids = new Set(parseAfflictionUuids(skipExistingInput?.value));
  const row = document.createElement('div');
  row.className = 'pf2e-afflictioner-region-uuid-row';

  const rowInput = document.createElement('input');
  rowInput.type = value ? 'hidden' : 'text';
  rowInput.className = 'pf2e-afflictioner-region-uuid-input';
  rowInput.value = value;
  rowInput.placeholder = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.UUID_PLACEHOLDER');
  rowInput.addEventListener('input', () => syncRowsToInput(input, skipExistingInput, container));
  rowInput.addEventListener('change', () => promoteTypedUuid(rowInput, input, skipExistingInput, container));
  rowInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    promoteTypedUuid(rowInput, input, skipExistingInput, container);
  });

  if (value) {
    const itemDisplay = document.createElement('div');
    itemDisplay.className = 'pf2e-afflictioner-region-item-display';
    itemDisplay.innerHTML = `
      <div class="pf2e-afflictioner-region-item-name" title="${value}">${value}</div>
      <div class="pf2e-afflictioner-region-item-uuid" title="${value}">${value}</div>
    `;
    resolveUuidName(value, itemDisplay);
    row.append(rowInput, itemDisplay);
  } else {
    row.append(rowInput);
  }

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'pf2e-afflictioner-region-remove';
  removeButton.innerHTML = '<i class="fas fa-trash"></i>';
  removeButton.title = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.REMOVE_ITEM');
  removeButton.addEventListener('click', () => {
    row.remove();
    if (!container.querySelector('.pf2e-afflictioner-region-uuid-row')) {
      createUuidRow(input, skipExistingInput, container);
    }
    syncRowsToInput(input, skipExistingInput, container);
  });

  const skipLabel = document.createElement('label');
  skipLabel.className = 'pf2e-afflictioner-region-skip-existing-label';
  skipLabel.title = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.SKIP_EXISTING_TOOLTIP');
  const skipCheckbox = document.createElement('input');
  skipCheckbox.type = 'checkbox';
  skipCheckbox.className = 'pf2e-afflictioner-region-skip-existing';
  skipCheckbox.checked = value ? skipExistingUuids.has(value) : false;
  skipCheckbox.addEventListener('change', () => syncRowsToInput(input, skipExistingInput, container));
  const skipText = document.createElement('span');
  skipText.textContent = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.SKIP_EXISTING_LABEL');
  skipLabel.append(skipCheckbox, skipText);

  const actions = document.createElement('div');
  actions.className = 'pf2e-afflictioner-region-row-actions';
  actions.append(skipLabel, removeButton);
  row.append(actions);
  container.append(row);
}

async function resolveUuidName(uuid, itemDisplay) {
  try {
    const item = await globalThis.fromUuid?.(uuid);
    if (!item?.name) return;
    const nameElement = itemDisplay.querySelector('.pf2e-afflictioner-region-item-name');
    if (nameElement) {
      nameElement.textContent = item.name;
      nameElement.title = item.name;
    }
    const uuidElement = itemDisplay.querySelector('.pf2e-afflictioner-region-item-uuid');
    if (uuidElement) uuidElement.title = uuid;
  } catch {
    // Keep UUID fallback if item cannot be resolved.
  }
}

async function promoteTypedUuid(rowInput, input, skipExistingInput, container) {
  const uuid = rowInput.value.trim();
  syncRowsToInput(input, skipExistingInput, container);
  if (!uuid || rowInput.type === 'hidden') return;

  const row = rowInput.closest('.pf2e-afflictioner-region-uuid-row');
  if (!row) return;

  try {
    const item = await globalThis.fromUuid?.(uuid);
    if (!item?.name) return;

    rowInput.type = 'hidden';
    const itemDisplay = document.createElement('div');
    itemDisplay.className = 'pf2e-afflictioner-region-item-display';
    itemDisplay.innerHTML = `
      <div class="pf2e-afflictioner-region-item-name" title="${item.name}">${item.name}</div>
      <div class="pf2e-afflictioner-region-item-uuid" title="${uuid}">${uuid}</div>
    `;
    rowInput.insertAdjacentElement('afterend', itemDisplay);
  } catch {
    // Leave editable UUID text if it cannot resolve yet.
  }
}

function buildUuidEditor(input, skipExistingInput) {
  const editor = document.createElement('div');
  editor.className = 'form-fields pf2e-afflictioner-region-uuid-editor pf2e-afflictioner-region-uuid-panel';

  const list = document.createElement('div');
  list.className = 'pf2e-afflictioner-region-uuid-list';

  const uuids = parseAfflictionUuids(input.value);
  for (const uuid of uuids.length ? uuids : ['']) {
    createUuidRow(input, skipExistingInput, list, uuid);
  }

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'pf2e-afflictioner-region-add';
  addButton.innerHTML = '<i class="fas fa-plus"></i>';
  addButton.title = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.ADD_ITEM');
  addButton.addEventListener('click', () => {
    createUuidRow(input, skipExistingInput, list);
    list.querySelector('.pf2e-afflictioner-region-uuid-row:last-child input')?.focus();
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'pf2e-afflictioner-region-uuid-toolbar';
  toolbar.append(addButton);

  editor.append(list, toolbar);
  return editor;
}

function parseDropData(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getDroppedItemUuid(event) {
  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer) return null;

  const types = Array.from(dataTransfer.types ?? ['text/plain', 'application/json']);
  const preferredTypes = ['application/json', 'text/plain', 'text'];

  for (const type of [...preferredTypes, ...types]) {
    const data = parseDropData(dataTransfer.getData(type));
    if (data?.type === 'Item' && data.uuid) return data.uuid;
  }

  return null;
}

export function appendAfflictionUuid(existingValue, uuid) {
  const uuids = parseAfflictionUuids(existingValue);
  if (!uuids.includes(uuid)) uuids.push(uuid);
  return uuids.join('\n');
}

export async function handleAfflictionRegionDrop(
  event,
  input,
  {
    fromUuidFn = globalThis.fromUuid,
    parseAfflictionFn = AfflictionParser.parseFromItem,
    notify = globalThis.ui?.notifications
  } = {}
) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const uuid = getDroppedItemUuid(event);
  if (!uuid) return false;

  const item = await fromUuidFn(uuid);
  const afflictionData = item ? parseAfflictionFn(item) : null;
  if (shouldSkipAffliction(afflictionData)) {
    notify?.warn?.(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.ITEM_MUST_HAVE_TRAIT_FULL'));
    return false;
  }

  input.value = appendAfflictionUuid(input.value, uuid);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  notify?.info?.(game.i18n.format('PF2E_AFFLICTIONER.REGION_BEHAVIOR.AFFLICTION_ADDED', {
    name: item.name
  }));
  return true;
}

export function enhanceAfflictionRegionBehaviorConfig(app, html) {
  if (!isAfflictionRegionBehaviorConfig(app)) return;

  const element = getElement(html);
  const input = getAfflictionUuidInput(element);
  if (!input || input.dataset.pf2eAfflictionerDropReady === 'true') return;
  const skipExistingInput = getSkipExistingInput(element);

  const dropTarget = getDropTarget(input);
  dropTarget.classList?.add('pf2e-afflictioner-region-items-group');
  const label = dropTarget.querySelector?.('label');
  if (label) label.textContent = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.AFFLICTION_ITEMS_LABEL');
  const hint = dropTarget.querySelector?.('.hint, p.notes');
  if (hint) hint.hidden = true;
  const skipGroup = skipExistingInput?.closest?.('.form-group');
  if (skipGroup) skipGroup.hidden = true;

  input.dataset.pf2eAfflictionerDropReady = 'true';
  input.placeholder = game.i18n.localize('PF2E_AFFLICTIONER.REGION_BEHAVIOR.DROP_PLACEHOLDER');
  input.type = 'hidden';
  input.classList?.add('pf2e-afflictioner-region-storage-input');
  if (skipExistingInput) {
    skipExistingInput.type = 'hidden';
    skipExistingInput.classList?.add('pf2e-afflictioner-region-storage-input');
  }

  if (!dropTarget.querySelector('.pf2e-afflictioner-region-uuid-editor')) {
    input.insertAdjacentElement('afterend', buildUuidEditor(input, skipExistingInput));
  }

  dropTarget.classList?.add('pf2e-afflictioner-region-drop-target');
  dropTarget.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  dropTarget.addEventListener('drop', (event) => {
    handleAfflictionRegionDrop(event, input);
  });
}

export function registerAfflictionRegionConfigDrop() {
  if (typeof Hooks === 'undefined' || !Hooks.on) return;
  Hooks.on('renderApplication', enhanceAfflictionRegionBehaviorConfig);
  Hooks.on('renderRegionBehaviorConfig', enhanceAfflictionRegionBehaviorConfig);
}
