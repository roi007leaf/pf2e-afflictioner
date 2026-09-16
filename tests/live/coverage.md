# Afflictioner live functional coverage

| Area | Live evidence |
| --- | --- |
| Public API/storage | add, update, remove; linked actor and off-scene actor storage |
| Parsing | native/structured/effect-only items; advanced syntax; English, Russian, and Chinese branches |
| Lifecycle | initial resistance/failure, manual and save-driven stages, virulent recovery, multiple exposure, incapacitation |
| Timers | onset completion, maximum-duration expiry |
| Effects | PF2e Effect creation/removal, custom rules, weakness, timed conditions, immutable damage, persistent-condition lifetime |
| Immunity/editor | immunity block and source bypass, edited definitions, custom icons, stage form parsing |
| Recovery | treatment, counteract, stage floor, unhealable-damage tracking, counteract unlock |
| Rules | poison/recovery feat adjustments and Vishkanya venom/debilitation |
| Weapons | coating/injection lifecycle, Double Poison, injection weapons, linked and unlinked storage |
| Combat | scheduled stage-save chat prompt |
| Privacy | save prompt whispers to owning player |
| UI | GM manager render, player permission gate, token indicator/tint, monitor popover |
| Regions | v14 registration/config contracts plus real region affliction application and skip-existing behavior |
| Settings | world-setting write/read/restore |
| Integrations | Visioner API/stage visibility, Storyframe fail-closed contract, socketlib authority availability |
| Environment | Foundry 14, PF2e, dependencies, runtime module metadata |

Excluded: one-time migrations, third-party Storyframe network transport,
community-data network import, random dice distributions, and every combinatorial
PF2e item-text variant. Unit tests remain responsible for exhaustive pure-branch
combinations; 41 live cases certify each shipped feature area's real Foundry/PF2e
document, rule, UI, permission, storage, and integration path.
