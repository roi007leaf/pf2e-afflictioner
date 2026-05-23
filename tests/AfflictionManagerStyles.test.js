import fs from 'fs';
import path from 'path';

describe('Affliction Manager styles', () => {
  test('weapon coating rows can wrap and truncate long poison names without overlapping controls', () => {
    const css = fs.readFileSync(path.resolve('styles/affliction-manager.css'), 'utf8');

    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-row \{[\s\S]*flex-wrap:\s*wrap;/);
    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-poison-label \{[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;/);
    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-coating-controls \{[\s\S]*flex-wrap:\s*wrap;/);
  });

  test('second poison controls are hidden until the Double Poison checkbox is checked', () => {
    const css = fs.readFileSync(path.resolve('styles/affliction-manager.css'), 'utf8');

    expect(css).toMatch(/\.pf2e-afflictioner \.double-poison-controls \{[\s\S]*display:\s*none;/);
    expect(css).toMatch(/\.pf2e-afflictioner \.double-poison-checkbox:checked ~ \.double-poison-controls \{[\s\S]*display:\s*flex;/);
  });

  test('chat affliction cards do not overflow the Foundry chat message width', () => {
    const css = fs.readFileSync(path.resolve('styles/chat.css'), 'utf8');

    expect(css).toMatch(/ol#chat-log,[\s\S]*ul#chat-log,[\s\S]*\.chat-log,[\s\S]*ol:has\(> li\.chat-message\),[\s\S]*ul:has\(> li\.chat-message\) \{[\s\S]*padding-left:\s*0 !important;[\s\S]*padding-inline-start:\s*0 !important;/);
    expect(css).toMatch(/\.pf2e-afflictioner-save-request \{[\s\S]*box-sizing:\s*border-box;[\s\S]*max-width:\s*100%;/);
    expect(css).toMatch(/\.pf2e-afflictioner-save-request \{[\s\S]*padding:\s*10px;[\s\S]*margin:\s*0;/);
    expect(css).toMatch(/\.pf2e-afflictioner-save-request button \{[\s\S]*box-sizing:\s*border-box;[\s\S]*min-width:\s*0;[\s\S]*white-space:\s*normal;/);
    expect(css).toMatch(/\.pf2e-afflictioner-apply-item-affliction \{[\s\S]*box-sizing:\s*border-box;[\s\S]*min-width:\s*0;[\s\S]*white-space:\s*normal;/);
  });
});
