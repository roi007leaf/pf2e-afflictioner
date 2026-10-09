[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/pf2e-afflictioner?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/pf2e-afflictioner/releases/latest)

[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/pf2e-afflictioner/total)](https://github.com/roi007leaf/pf2e-afflictioner/releases)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-afflictioner)](https://forge-vtt.com/bazaar)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/roileaf)
# PF2e Afflictioner

Automated affliction (poison/disease/curse) manager for Pathfinder 2e in FoundryVTT implementing official PF2e rules.

## Documentation
https://github.com/roi007leaf/pf2e-afflictioner/wiki

## Legacy addiction

Enable **Enable Legacy Addiction Rules** in the module's world settings first (GM only;
disabled by default). Turning it off hides drug-use controls and pauses addiction saves,
timers, and effect restoration. Existing records, history, and effects remain; the GM
can still remove addictions through the manager.

Select a token (or open an actor-filtered manager), then choose **Add Addiction (Legacy)**.
Drag a drug item into the dialog, or select one from the actor/compendium lists. The item's
name, icon, and Fortitude DC are read automatically. If the DC is missing, enter only the DC.
**Manual Entry** remains available for custom drugs. This records a dose and prompts an addiction save.
Use the addiction row's flask button for later doses. After recovery, add the same drug name again:
its highest stage remains stored permanently. Each drug has independent history.

Drug-use failures advance from the highest recorded stage (+1, or +2 on a critical failure,
capped at stage 4); successful drug-use saves never improve an existing addiction.
Symptoms are suppressed for one day after a dose. Weekly recovery saves can improve the
current stage but cannot worsen it. Addiction conditions remain bound to the disease and
disappear during suppression or after recovery. World-time advancement drives onset,
suppression expiry, and weekly reminders, including off-scene actors.

Drug use is recorded explicitly; it does not consume inventory or apply the drug's separate
poison. Rules: [Archives of Nethys — Addiction](https://2e.aonprd.com/Diseases.aspx?ID=15).

Macros can call `game.modules.get('pf2e-afflictioner').api.takeDrug(token, 'Pesh', 20)`.
For an off-scene actor, pass `null` as the token and the actor as the fourth argument.

## Dependencies

- **FoundryVTT**: v13+
- **PF2e System**: v7.0.0+
- **lib-wrapper**: Required
- **socketlib**: Required

### Optional

- **Storyframe**: For integrated roll handling
