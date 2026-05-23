import * as WeaponCoatingStore from '../scripts/stores/WeaponCoatingStore.js';

describe('Weapon injection store', () => {
  test('stores loaded injections separately from weapon coatings', async () => {
    const flags = {
      weaponCoatings: {
        'weapon-1': { poisonName: 'Aconite' },
      },
      weaponInjections: {},
    };
    const actor = {
      getFlag: jest.fn((_moduleId, key) => flags[key] || {}),
      setFlag: jest.fn(async (_moduleId, key, value) => {
        flags[key] = value;
      }),
    };

    await WeaponCoatingStore.addInjection(actor, 'weapon-1', {
      poisonName: 'Belladonna',
      afflictionData: { name: 'Belladonna', type: 'poison' },
    });

    expect(WeaponCoatingStore.getCoating(actor, 'weapon-1').poisonName).toBe('Aconite');
    expect(WeaponCoatingStore.getInjection(actor, 'weapon-1').poisonName).toBe('Belladonna');
    expect(actor.setFlag).toHaveBeenCalledWith('pf2e-afflictioner', 'weaponInjections', {
      'weapon-1': {
        poisonName: 'Belladonna',
        afflictionData: { name: 'Belladonna', type: 'poison' },
      },
    });
  });

  test('stores unlinked token injections on the token document', async () => {
    const flags = { weaponInjections: {} };
    const token = {
      actor: { id: 'actor-1', name: 'Blacknoon Apprentice' },
      document: {
        actorLink: false,
        getFlag: jest.fn((_moduleId, key) => flags[key] || {}),
        setFlag: jest.fn(async (_moduleId, key, value) => {
          flags[key] = value;
        }),
      },
    };

    await WeaponCoatingStore.addInjection(token, 'weapon-1', {
      poisonName: 'Belladonna',
      afflictionData: { name: 'Belladonna', type: 'poison' },
    });

    expect(token.document.setFlag).toHaveBeenCalledWith('pf2e-afflictioner', 'weaponInjections', {
      'weapon-1': {
        poisonName: 'Belladonna',
        afflictionData: { name: 'Belladonna', type: 'poison' },
      },
    });
    expect(WeaponCoatingStore.getInjection(token, 'weapon-1').poisonName).toBe('Belladonna');
  });

  test('removes loaded injection without removing coating data', async () => {
    const flags = {
      weaponCoatings: {
        'weapon-1': { poisonName: 'Aconite' },
      },
      weaponInjections: {
        'weapon-1': { poisonName: 'Belladonna' },
      },
    };
    const actor = {
      getFlag: jest.fn((_moduleId, key) => flags[key] || {}),
      unsetFlag: jest.fn(async (_moduleId, key) => {
        const [, weaponId] = key.split('.');
        delete flags.weaponInjections[weaponId];
      }),
    };

    await WeaponCoatingStore.removeInjection(actor, 'weapon-1');

    expect(flags.weaponCoatings['weapon-1'].poisonName).toBe('Aconite');
    expect(flags.weaponInjections['weapon-1']).toBeUndefined();
    expect(actor.unsetFlag).toHaveBeenCalledWith('pf2e-afflictioner', 'weaponInjections.weapon-1');
  });
});
