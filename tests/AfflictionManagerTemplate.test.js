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

  test('renders controls for applying a second poison when Double Poison is available', () => {
    const template = fs.readFileSync(path.resolve('templates/affliction-manager.hbs'), 'utf8');

    expect(template).toContain('canAddDoublePoison');
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
});
