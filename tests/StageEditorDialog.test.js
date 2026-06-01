describe('StageEditorDialog form parsing', () => {
  beforeEach(() => {
    jest.resetModules();
    global.foundry = {
      applications: {
        api: {
          ApplicationV2: class {},
          HandlebarsApplicationMixin: Base => Base,
        },
        ux: {
          FormDataExtended: class {
            constructor() {
              this.object = global.__stageEditorFormData;
            }
          },
        },
      },
      utils: {
        deepClone: value => JSON.parse(JSON.stringify(value)),
      },
    };
  });

  afterEach(() => {
    delete global.__stageEditorFormData;
    delete global.foundry;
  });

  test('saves multiple conditions from nested indexed FormDataExtended output', async () => {
    global.__stageEditorFormData = {
      condition: {
        0: { name: 'enfeebled', value: '1' },
        1: { name: 'stupefied', value: '1' },
      },
    };

    const { StageEditorDialog } = await import('../scripts/managers/StageEditorDialog.js');
    const dialog = Object.create(StageEditorDialog.prototype);
    dialog.element = {};
    dialog.stageData = { conditions: [] };

    await dialog.updateFromForm();

    expect(dialog.stageData.conditions).toEqual([
      { name: 'enfeebled', value: 1 },
      { name: 'stupefied', value: 1 },
    ]);
  });

  test('uses only affliction name and stage for rule element labels', async () => {
    const { StageEditorDialog } = await import('../scripts/managers/StageEditorDialog.js');

    expect(StageEditorDialog.buildRuleElementLabel('Rust Creep', 4)).toBe('Rust Creep - Stage 4');
  });
});
