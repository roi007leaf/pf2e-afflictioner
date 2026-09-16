# Local automated Foundry tests

Afflictioner uses Visioner's live-test configuration and disposable QA world.
The runner reads `~/.config/pf2e-visioner/live.json`, honors the same
`VISIONER_*` URL/account environment variables, and defaults to world ID
`visioner-qa`. It refuses any other world unless `VISIONER_DISPOSABLE_WORLD`
explicitly names it.

## First run

1. Launch the disposable Foundry 14 / PF2e world used by Visioner live tests.
2. Enable this source checkout, PF2e Visioner, libWrapper, and socketlib.
3. Use the same GM and player accounts configured for Visioner.
4. Run `npm ci` and `npx playwright install chromium` once.
5. Run `npm run test:live:full`.

```powershell
npm run test:live
npm run test:live:full
npm run test:live:list
npm run test:live:harness
npm run test:live:cleanup
npm run test:live:matrix -- artifacts/live/<run-id>/report.json
npm run test:shipping -- artifacts/live/<run-id>/report.json
```

Use `AFFLICTIONER_LIVE_CASE=name,other-name` with `test:live:full` to select
cases. `--headless` is optional. `VISIONER_BROWSER_CHANNEL=chrome` selects the
installed Chrome channel, matching Visioner's runner.

Every case creates a fresh flagged scene and actors. A write-ahead recovery
journal is saved before documents are created. GM/player scenes, tested world
settings, applications, chat messages, combats, scenes, and actors are restored
or deleted after each run. A stale journal must be recovered with
`test:live:cleanup`; do not use this suite in a campaign world.

Reports and screenshots are written under ignored `artifacts/live/<run-id>/`.
Full coverage means every contract in `requirements.mjs` has an automated live
case that passed with assertions, matching source fingerprint, and complete
cleanup. `feature-inventory.mjs` also maps every focused `tests/*.test.js` suite
to live evidence; adding a unit feature suite without a live mapping fails the
harness gate. It does not claim exhaustive line/branch coverage or migration testing.
No live test runs in GitHub Actions or ships in the module ZIP.
