import {
  appendAfflictionUuid,
  enhanceAfflictionRegionBehaviorConfig,
  getDroppedItemUuid,
  handleAfflictionRegionDrop
} from '../scripts/regions/AfflictionRegionConfigDrop.js';

describe('AfflictionRegionConfigDrop', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.Event = window.Event;
  });

  test('extracts item UUID from Foundry drag data', () => {
    const event = {
      dataTransfer: {
        getData: jest.fn(() => JSON.stringify({ type: 'Item', uuid: 'Compendium.pf2e.Item.abc' }))
      }
    };

    expect(getDroppedItemUuid(event)).toBe('Compendium.pf2e.Item.abc');
  });

  test('extracts item UUID from alternate Foundry drag payload types', () => {
    const event = {
      dataTransfer: {
        types: ['application/json', 'text/plain'],
        getData: jest.fn((type) => {
          if (type === 'application/json') return JSON.stringify({ type: 'Item', uuid: 'Item.json' });
          return '';
        })
      }
    };

    expect(getDroppedItemUuid(event)).toBe('Item.json');
  });

  test('appends dropped UUIDs without duplicates', () => {
    expect(appendAfflictionUuid('Item.a\nItem.b', 'Item.a')).toBe('Item.a\nItem.b');
    expect(appendAfflictionUuid('Item.a', 'Item.b')).toBe('Item.a\nItem.b');
  });

  test('drop validates item and updates input value', async () => {
    document.body.innerHTML = '<textarea name="system.afflictionUuids">Item.a</textarea>';
    const input = document.querySelector('textarea');
    const changeSpy = jest.fn();
    input.addEventListener('change', changeSpy);

    const item = { uuid: 'Item.b', name: 'Arsenic' };
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        getData: jest.fn(() => JSON.stringify({ type: 'Item', uuid: 'Item.b' }))
      }
    };

    const result = await handleAfflictionRegionDrop(event, input, {
      fromUuidFn: jest.fn().mockResolvedValue(item),
      parseAfflictionFn: jest.fn().mockReturnValue({ name: 'Arsenic', stages: [{}] }),
      notify: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
    });

    expect(result).toBe(true);
    expect(input.value).toBe('Item.a\nItem.b');
    expect(changeSpy).toHaveBeenCalled();
  });

  test('drop ignores non-affliction items', async () => {
    document.body.innerHTML = '<textarea name="system.afflictionUuids"></textarea>';
    const input = document.querySelector('textarea');
    const notify = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        getData: jest.fn(() => JSON.stringify({ type: 'Item', uuid: 'Item.weapon' }))
      }
    };

    const result = await handleAfflictionRegionDrop(event, input, {
      fromUuidFn: jest.fn().mockResolvedValue({ uuid: 'Item.weapon' }),
      parseAfflictionFn: jest.fn().mockReturnValue(null),
      notify
    });

    expect(result).toBe(false);
    expect(input.value).toBe('');
    expect(notify.warn).toHaveBeenCalled();
  });

  test('enhancement allows dragging over the field group, not only directly over the input', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    const group = document.querySelector('.form-group');
    const input = document.querySelector('input');
    const event = new window.Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        dropEffect: ''
      }
    });

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    group.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  test('enhancement adds a plus button that creates another UUID row and syncs storage input', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="Item.a" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    const storageInput = document.querySelector('input[name="system.afflictionUuids"]');
    const changeSpy = jest.fn();
    storageInput.addEventListener('change', changeSpy);

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    document.querySelector('.pf2e-afflictioner-region-add').click();
    const rowInputs = document.querySelectorAll('.pf2e-afflictioner-region-uuid-input');
    rowInputs[1].value = 'Item.b';
    rowInputs[1].dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(rowInputs).toHaveLength(2);
    expect(storageInput.value).toBe('Item.a\nItem.b');
    expect(changeSpy).toHaveBeenCalled();
  });

  test('enhancement puts row editor inside Foundry form-fields layout', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="Item.a" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    const editor = document.querySelector('.pf2e-afflictioner-region-uuid-editor');
    const row = document.querySelector('.pf2e-afflictioner-region-uuid-row');
    expect(editor.classList.contains('form-fields')).toBe(true);
    expect(row.children[0].classList.contains('pf2e-afflictioner-region-uuid-input')).toBe(true);
    expect(row.querySelector('.pf2e-afflictioner-region-remove')).not.toBeNull();
  });

  test('enhancement replaces raw UUID label with a full-width affliction item panel', () => {
    game.i18n.localize = jest.fn((key) => {
      if (key === 'PF2E_AFFLICTIONER.REGION_BEHAVIOR.AFFLICTION_ITEMS_LABEL') return 'Affliction Items';
      return key;
    });

    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="Item.a" />
          <p class="hint">Item UUIDs to apply when a token enters this region.</p>
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    const group = document.querySelector('.form-group');
    expect(group.classList.contains('pf2e-afflictioner-region-items-group')).toBe(true);
    expect(group.querySelector('label').textContent).toBe('Affliction Items');
    expect(group.querySelector('.pf2e-afflictioner-region-uuid-panel')).not.toBeNull();
    expect(group.querySelector('.hint').hidden).toBe(true);
  });

  test('per-row skip existing checkbox syncs skip UUID storage input', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="Item.a,Item.b" />
        </div>
        <div class="form-group">
          <label>Skip Existing</label>
          <input name="system.skipExistingAfflictionUuids" value="Item.b" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    const skipInput = document.querySelector('input[name="system.skipExistingAfflictionUuids"]');

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    const toggles = document.querySelectorAll('.pf2e-afflictioner-region-skip-existing');
    expect(toggles).toHaveLength(2);
    expect(toggles[0].checked).toBe(false);
    expect(toggles[1].checked).toBe(true);

    toggles[0].checked = true;
    toggles[0].dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(skipInput.value).toBe('Item.a\nItem.b');
    expect(skipInput.closest('.form-group').hidden).toBe(true);
  });

  test('enhancement resolves saved UUIDs to item names in rows', async () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="Item.arsenic" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    global.fromUuid = jest.fn().mockResolvedValue({ uuid: 'Item.arsenic', name: 'Arsenic' });

    enhanceAfflictionRegionBehaviorConfig(app, document.body);
    await Promise.resolve();

    expect(document.querySelector('.pf2e-afflictioner-region-item-name').textContent).toBe('Arsenic');
    expect(document.querySelector('.pf2e-afflictioner-region-item-uuid').textContent).toBe('Item.arsenic');
    expect(document.querySelector('.pf2e-afflictioner-region-item-name').title).toBe('Arsenic');
    expect(document.querySelector('.pf2e-afflictioner-region-item-uuid').title).toBe('Item.arsenic');
  });

  test('typed valid UUID resolves to item name after change', async () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" value="" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    global.fromUuid = jest.fn().mockResolvedValue({ uuid: 'Item.flyleaf', name: 'Flyleaf' });

    enhanceAfflictionRegionBehaviorConfig(app, document.body);

    const uuidInput = document.querySelector('.pf2e-afflictioner-region-uuid-input');
    uuidInput.value = 'Item.flyleaf';
    uuidInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await Promise.resolve();

    expect(document.querySelector('.pf2e-afflictioner-region-item-name').textContent).toBe('Flyleaf');
    expect(document.querySelector('.pf2e-afflictioner-region-item-uuid').textContent).toBe('Item.flyleaf');
  });


  test('enhancement remove button deletes UUID row and syncs storage input', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-group">
          <label>Affliction Item UUIDs</label>
          <input name="system.afflictionUuids" />
        </div>
      </form>
    `;

    const app = {
      document: {
        documentName: 'RegionBehavior',
        type: 'pf2e-afflictioner.Pf2eAfflictionerAffliction'
      }
    };
    const storageInput = document.querySelector('input[name="system.afflictionUuids"]');
    storageInput.value = 'Item.a,Item.b';

    enhanceAfflictionRegionBehaviorConfig(app, document.body);
    document.querySelector('.pf2e-afflictioner-region-remove').click();

    expect(document.querySelectorAll('.pf2e-afflictioner-region-uuid-input')).toHaveLength(1);
    expect(storageInput.value).toBe('Item.b');
  });
});
