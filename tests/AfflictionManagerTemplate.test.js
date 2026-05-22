import fs from 'fs';
import path from 'path';

describe('Affliction Manager template', () => {
  test('renders a dedicated overrides tab and panel for source immunity rules', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('data-tab="overrides"');
    expect(template).toContain('SOURCE_IMMUNITY_RULE_TITLE');
    expect(template).toMatch(/affliction-manager-tab-btn[\s\S]*data-tab="overrides"/);
    expect(template).toMatch(/affliction-manager-tab-panel[\s\S]*data-tab="overrides"/);
  });

  test('renders named afflictions as tags instead of a raw textarea', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('source-rule-key-tags');
    expect(template).toContain('openSourceRuleAffliction');
    expect(template).toContain('removeSourceRuleAffliction');
    expect(template).not.toContain('name="sourceRule.afflictionKeys" rows="2"');
  });

  test('renders bypass traits as removable tags with autocomplete input', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('source-rule-trait-tags');
    expect(template).toContain('source-rule-trait-input');
    expect(template).toContain('source-rule-trait-options');
    expect(template).toContain('removeSourceRuleTrait');
    expect(template).toContain('<option value="{{value}}"></option>');
    expect(template).not.toContain('name="sourceRule.traits" value=');
  });

  test('renders a Double Poison opt-in checkbox before second-poison controls', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('canAddDoublePoison');
    expect(template).toContain('double-poison-toggle');
    expect(template).toContain('name="doublePoison.enabled"');
    expect(template).toContain('DOUBLE_POISON_TOGGLE');
    expect(template).toContain('double-poison-controls');
    expect(template).toContain('SELECT_SECOND_POISON');
    expect(template).toContain('ADD_SECOND_POISON_BTN');
    expect(template).toContain('APPLY_SECOND_COATING_TOOLTIP');
  });

  test('bases second poison controls on service double poison eligibility', async () => {
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
      },
    };

    const { AfflictionManager } = await import('../scripts/managers/AfflictionManager.js');
    const source = AfflictionManager.prototype._prepareContext.toString();

    expect(source).toContain('WeaponCoatingService._canAddSecondPoison(actor, coating');
    expect(source).not.toContain('canAddDoublePoison: !!coating && WeaponCoatingService._canUseDoublePoison(actor)');

    delete global.foundry;
  });

  test('marks the second poison button as a Double Poison action', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('data-double-poison="true"');
  });

  test('renders info buttons for Double Poison component items', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('componentPoisonLinks');
    expect(template).toContain('{{#each componentPoisonLinks}}');
    expect(template).toContain('data-uuid="{{uuid}}"');
    expect(template).toContain('{{name}}');
  });

  test('renders separate injection load controls for injection trait weapons', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('hasInjectionTrait');
    expect(template).toContain('isInjectionLoaded');
    expect(template).toContain('data-action="addInjection"');
    expect(template).toContain('data-action="removeInjection"');
    expect(template).toContain('weapon-control-pair');
    expect(template).toContain('WEAPON_COATING.LOAD_INJECTION_BTN');
    expect(template).toContain('WEAPON_COATING.REMOVE_INJECTION');
  });
});
