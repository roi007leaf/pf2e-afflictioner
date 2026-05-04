describe('AfflictionManager source immunity override actions', () => {
  test('saving source immunity rule works when action is bound to manager instance', async () => {
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };
    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const savedRule = {};
    const actor = {
      id: 'actor-1',
      name: 'Toxicologist',
      getFlag: jest.fn(() => null),
      setFlag: jest.fn(async (_moduleId, _key, rule) => {
        Object.assign(savedRule, rule);
      }),
    };
    const panel = document.createElement('div');
    panel.className = 'source-immunity-bypass-rule';
    panel.innerHTML = `
      <input type="checkbox" name="sourceRule.enabled" checked>
      <span class="source-rule-trait-tag" data-trait="poison"></span>
      <span class="source-rule-key-tag"
            data-key="Compendium.pf2e.afflictions.Item.test"
            data-name="Test Poison"
            data-uuid="Compendium.pf2e.afflictions.Item.test"></span>
      <button data-actor-id="actor-1"></button>
    `;

    game.user.isGM = true;
    game.actors = { get: jest.fn(() => actor) };
    game.i18n.format = jest.fn(() => 'saved');
    ui.notifications.info = jest.fn();

    const appInstance = { render: jest.fn() };
    const button = panel.querySelector('button');

    await AfflictionManager.saveSourceImmunityBypassRule.call(appInstance, null, button);

    expect(savedRule).toEqual({
      enabled: true,
      traits: ['poison'],
      afflictionKeys: [{
        key: 'Compendium.pf2e.afflictions.Item.test',
        name: 'Test Poison',
        uuid: 'Compendium.pf2e.afflictions.Item.test',
      }],
    });
    expect(appInstance.render).toHaveBeenCalledWith({ force: true });

    delete global.foundry;
  });

  test('trait suggestions are limited to affliction immunity categories', async () => {
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };
    global.CONFIG = { PF2E: {} };

    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const options = AfflictionManager._getTraitOptions().map(option => option.value);

    expect(options).toEqual(['curse', 'disease', 'poison']);

    delete global.CONFIG;
    delete global.foundry;
  });
});
