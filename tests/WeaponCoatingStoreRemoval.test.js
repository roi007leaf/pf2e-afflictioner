import * as WeaponCoatingStore from '../scripts/stores/WeaponCoatingStore.js';
import { onDeleteItem } from '../scripts/hooks/items.js';

function buildActor() {
  const flags = {
    weaponCoatings: {
      'weapon-1': {
        poisonName: 'Giant Centipede Venom',
        weaponName: 'Longsword',
        coatingEffectUuid: 'Actor.actor-1.Item.effect-1',
      },
    },
  };

  return {
    id: 'actor-1',
    name: 'Alchemist',
    getFlag: jest.fn((_moduleId, key) => flags[key] || {}),
    unsetFlag: jest.fn(async (_moduleId, key) => {
      const [, weaponId] = key.split('.');
      delete flags.weaponCoatings[weaponId];
    }),
    flags,
  };
}

describe('WeaponCoatingStore removal notifications', () => {
  beforeEach(() => {
    game.user.isGM = true;
    game.i18n.format = jest.fn((key, data = {}) => `${key}: ${data.poisonName} ${data.weaponName}`);
    ui.notifications.info = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fromUuid;
  });

  test('store-initiated coating removal does not emit an expired notification from the deleteItem hook', async () => {
    const actor = buildActor();
    const effect = {
      uuid: 'Actor.actor-1.Item.effect-1',
      delete: jest.fn(async () => {
        await onDeleteItem({
          type: 'effect',
          uuid: 'Actor.actor-1.Item.effect-1',
          parent: actor,
          flags: { 'pf2e-afflictioner': { isCoatingEffect: true } },
        });
      }),
    };
    global.fromUuid = jest.fn(async () => effect);

    await WeaponCoatingStore.removeCoating(actor, 'weapon-1');

    expect(effect.delete).toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('pf2e-afflictioner', 'weaponCoatings.weapon-1');
    expect(ui.notifications.info).not.toHaveBeenCalledWith(expect.stringContaining('WEAPON_COATING.EXPIRED'));
  });

  test('direct coating effect deletion still cleans coating data and reports expiry', async () => {
    const actor = buildActor();

    await onDeleteItem({
      type: 'effect',
      uuid: 'Actor.actor-1.Item.effect-1',
      parent: actor,
      flags: { 'pf2e-afflictioner': { isCoatingEffect: true } },
    });

    expect(actor.unsetFlag).toHaveBeenCalledWith('pf2e-afflictioner', 'weaponCoatings.weapon-1');
    expect(ui.notifications.info).toHaveBeenCalledWith(expect.stringContaining('WEAPON_COATING.EXPIRED'));
  });
});
