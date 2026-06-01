import { AfflictionItemResolver } from '../scripts/services/AfflictionItemResolver.js';

describe('AfflictionItemResolver', () => {
  afterEach(() => {
    delete global.fromUuid;
  });

  test('resolves a curse referenced by NPC action text', async () => {
    const curseItem = {
      name: 'Forbidden Cravings',
      type: 'condition',
      uuid: 'Item.forbidden-cravings',
      system: {
        traits: { value: ['curse'] },
        description: {
          value:
            '<p><strong>Saving Throw</strong> @Check[will|dc:22]</p>' +
            '<p><strong>Stage 1</strong> The carrier can no longer satisfy its hunger (1 day)</p>',
        },
      },
    };
    const actor = {
      id: 'ghoul-stalker',
      uuid: 'Actor.ghoul-stalker',
      type: 'npc',
      system: { details: { level: { value: 12 } } },
      items: [curseItem],
    };
    const actionItem = {
      name: 'Ghoul Whispers',
      type: 'action',
      uuid: 'Item.ghoul-whispers',
      parent: actor,
      system: {
        traits: { value: ['auditory', 'occult'] },
        description: {
          value: '<p>The target must save against the forbidden cravings curse.</p>',
        },
      },
    };

    const result = await AfflictionItemResolver.resolveFromItem(actionItem);

    expect(result).toEqual(expect.objectContaining({
      name: 'Forbidden Cravings',
      type: 'curse',
      dc: 22,
      originActorUuid: 'Actor.ghoul-stalker',
      originActorId: 'ghoul-stalker',
      originActorLevel: 12,
      originActorType: 'npc',
      triggerItemUuid: 'Item.ghoul-whispers',
      triggerItemType: 'action',
    }));
  });
});
