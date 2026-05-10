import * as AfflictionStore from '../scripts/stores/AfflictionStore.js';
import { registerSaveButtonHandlers } from '../scripts/handlers/saveButtons.js';

describe('save button roll modes', () => {
  let actor;
  let token;
  let rollMock;

  beforeEach(() => {
    rollMock = jest.fn().mockResolvedValue({ total: 17 });
    actor = {
      id: 'actor-1',
      name: 'Mysterious Target',
      type: 'character',
      hasPlayerOwner: true,
      saves: {
        fortitude: {
          roll: rollMock,
        },
      },
      testUserPermission: jest.fn(),
    };
    token = {
      id: 'token-1',
      name: 'Mysterious Target',
      actor,
      document: { actorLink: false },
    };

    global.CONST = {
      DICE_ROLL_MODES: {
        BLIND: 'blindroll',
      },
    };
    global.Hooks = {
      on: jest.fn(),
      once: jest.fn(),
    };
    global.canvas = {
      tokens: {
        get: jest.fn(id => (id === token.id ? token : null)),
        placeables: [token],
      },
    };
    global.game = {
      ...global.game,
      actors: {
        get: jest.fn(id => (id === actor.id ? actor : null)),
      },
      messages: {
        contents: [{ id: 'roll-message-1' }],
        get: jest.fn(),
      },
      modules: new Map(),
      settings: {
        get: jest.fn((_moduleId, key) => {
          if (key === 'editedAfflictions') return {};
          return false;
        }),
        set: jest.fn(),
      },
      user: {
        id: 'gm-1',
        isGM: true,
      },
    };

    jest.spyOn(AfflictionStore, 'getAffliction').mockReturnValue({
      id: 'affliction-1',
      name: 'Hidden Venom',
      dc: 27,
      saveType: 'fortitude',
      type: 'poison',
      traits: ['injury', 'poison'],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('mysterious GM initial save rolls as blind PF2e message mode', async () => {
    document.body.innerHTML = `
      <div class="message">
        <button class="affliction-roll-initial-save"
                data-token-id="${token.id}"
                data-affliction-id="affliction-1"
                data-dc="27"
                data-blind-roll="true">
        </button>
      </div>
    `;

    registerSaveButtonHandlers(document.body);
    document.querySelector('.affliction-roll-initial-save').click();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(rollMock).toHaveBeenCalledWith(expect.objectContaining({
      dc: { value: 27 },
      messageMode: 'blind',
    }));
  });

  test('initial save roll includes affliction trait roll options', async () => {
    document.body.innerHTML = `
      <div class="message">
        <button class="affliction-roll-initial-save"
                data-token-id="${token.id}"
                data-affliction-id="affliction-1"
                data-dc="27">
        </button>
      </div>
    `;

    registerSaveButtonHandlers(document.body);
    document.querySelector('.affliction-roll-initial-save').click();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(rollMock).toHaveBeenCalledWith(expect.objectContaining({
      extraRollOptions: expect.arrayContaining([
        'poison',
        'injury',
        'item:trait:poison',
        'item:trait:injury',
      ]),
    }));
  });

  test('stage save roll includes affliction trait roll options', async () => {
    document.body.innerHTML = `
      <div class="message">
        <button class="affliction-roll-save"
                data-token-id="${token.id}"
                data-affliction-id="affliction-1"
                data-dc="27">
        </button>
      </div>
    `;

    registerSaveButtonHandlers(document.body);
    document.querySelector('.affliction-roll-save').click();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(rollMock).toHaveBeenCalledWith(expect.objectContaining({
      extraRollOptions: expect.arrayContaining([
        'poison',
        'injury',
        'item:trait:poison',
        'item:trait:injury',
      ]),
    }));
  });
});
