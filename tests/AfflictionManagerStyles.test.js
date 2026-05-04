import fs from 'fs';
import path from 'path';

describe('Affliction Manager styles', () => {
  test('weapon coating rows can wrap and truncate long poison names without overlapping controls', () => {
    const css = fs.readFileSync(path.resolve('styles/affliction-manager.css'), 'utf8');

    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-row \{[\s\S]*flex-wrap:\s*wrap;/);
    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-poison-label \{[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;/);
    expect(css).toMatch(/\.pf2e-afflictioner \.weapon-coating-controls \{[\s\S]*flex-wrap:\s*wrap;/);
  });
});
