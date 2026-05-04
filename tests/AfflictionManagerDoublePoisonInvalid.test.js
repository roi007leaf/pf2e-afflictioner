describe('AfflictionManager invalid Double Poison selections', () => {
  beforeEach(() => {
    jest.resetModules();
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };
    game.i18n.localize = jest.fn(key => key);
    ui.notifications.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.foundry;
    delete global.fromUuid;
  });

  test('second poison action warns and does not replace when selected item cannot merge', async () => {
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const { WeaponCoatingService } = await import('../scripts/services/WeaponCoatingService.js');

    const actor = {
      id: 'actor-1',
      items: Object.assign(
        [{ type: 'feat', system: { slug: 'double-poison' } }],
        { get: jest.fn(() => ({ id: 'weapon-1', name: 'Longsword' })) }
      ),
      getFlag: jest.fn(() => ({
        'weapon-1': {
          afflictionData: {
            name: 'Giant Centipede Venom',
            type: 'poison',
            traits: ['injury', 'poison'],
            stages: [{ number: 1, effects: '1 poison damage' }],
          },
        },
      })),
    };
    const button = document.createElement('button');
    button.dataset.actorId = 'actor-1';
    button.dataset.weaponId = 'weapon-1';
    button.dataset.doublePoison = 'true';
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = '<select class="coating-poison-select"><option value="Item.flayleaf" selected>Flayleaf</option></select>';
    row.append(button);
    document.body.append(row);

    game.actors = { get: jest.fn(() => actor) };
    global.fromUuid = jest.fn(async () => ({ name: 'Flayleaf' }));
    jest.spyOn(WeaponCoatingService, '_getPreparedCoatingAfflictionData').mockReturnValue({
      skip: true,
    });
    jest.spyOn(WeaponCoatingService, '_applyCoatingWithPermission').mockResolvedValue(true);

    await AfflictionManager.addCoating.call({ render: jest.fn() }, null, button);

    expect(ui.notifications.warn).toHaveBeenCalledWith('PF2E_AFFLICTIONER.WEAPON_COATING.DOUBLE_POISON_INVALID');
    expect(WeaponCoatingService._applyCoatingWithPermission).not.toHaveBeenCalled();
  });

  test('second poison action warns and does not replace when either poison is too high level', async () => {
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const { WeaponCoatingService } = await import('../scripts/services/WeaponCoatingService.js');

    const actor = {
      id: 'actor-1',
      level: 10,
      items: Object.assign(
        [{ type: 'feat', system: { slug: 'double-poison' } }],
        { get: jest.fn(() => ({ id: 'weapon-1', name: 'Longsword' })) }
      ),
      getFlag: jest.fn(() => ({
        'weapon-1': {
          afflictionData: {
            name: 'Giant Centipede Venom',
            type: 'poison',
            level: 8,
            traits: ['injury', 'poison'],
            stages: [{ number: 1, effects: '1 poison damage' }],
          },
        },
      })),
    };
    const button = document.createElement('button');
    button.dataset.actorId = 'actor-1';
    button.dataset.weaponId = 'weapon-1';
    button.dataset.doublePoison = 'true';
    const row = document.createElement('div');
    row.className = 'weapon-row';
    row.innerHTML = '<select class="coating-poison-select"><option value="Item.high" selected>High Poison</option></select>';
    row.append(button);
    document.body.append(row);

    game.actors = { get: jest.fn(() => actor) };
    global.fromUuid = jest.fn(async () => ({ name: 'High Poison' }));
    jest.spyOn(WeaponCoatingService, '_getPreparedCoatingAfflictionData').mockReturnValue({
      name: 'High Poison',
      type: 'poison',
      level: 9,
      traits: ['injury', 'poison'],
      stages: [{ number: 1, effects: 'high poison damage' }],
    });
    jest.spyOn(WeaponCoatingService, '_applyCoatingWithPermission').mockResolvedValue(true);

    await AfflictionManager.addCoating.call({ render: jest.fn() }, null, button);

    expect(ui.notifications.warn).toHaveBeenCalledWith('PF2E_AFFLICTIONER.WEAPON_COATING.DOUBLE_POISON_LEVEL_INVALID');
    expect(WeaponCoatingService._applyCoatingWithPermission).not.toHaveBeenCalled();
  });
});
