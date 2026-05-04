<claude-mem-context>
# Memory Context

# [pf2e-afflictioner] recent context, 2026-05-04 3:54pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,158t read) | 716,458t work | 98% savings

### May 4, 2026
866 8:10a 🔵 AfflictionParser Returns traits Array — Bypass Check Can Match Directly
867 " 🟣 TDD: Three Failing Tests Written for Immunity Bypass Feature
868 " 🟣 Immunity Bypass Feature — Full Implementation Complete
869 8:20a 🔵 Source Immunity Bypass UI Missing Dedicated "Overrides" Tab
870 " 🔴 Overrides Tab Added — Bypass Rule Panel Moved Out of Coatings
871 " 🔴 Overrides Tab Fix Verified — 10/10 Tests Pass
872 8:21a 🔴 Overrides Tab Bug Fully Resolved — 155/155 Tests Green, Lint Clean
873 8:23a ⚖️ Simplify Override Model: Single Bypass Trait List
874 8:24a ✅ Tests Updated for Single-Trait Bypass Model (Red Phase)
875 " 🔵 Red Phase Confirmed — Named-Key Bypass Test Fails as Expected
876 " 🔄 Single-Trait Model Implemented — Store, Service, and Manager Updated
877 " 🔄 Overrides Tab UI Simplified — Two Trait Inputs Collapsed to One
878 8:25a 🔄 CSS and i18n Updated for Single-Trait UI Model
879 " 🔴 Old Field Names Confirmed Removed from All Production Code
880 " 🔄 Single-Trait Model Refactor Green — 10/10 Focused Tests Pass
881 " 🔄 Single-Trait Model Refactor Complete — 155/155 Tests Green, Lint Clean
882 " 🟣 New Red Test: Affliction Keys as Tag UI Instead of Textarea
883 8:26a 🟣 New Feature Request: GM Chat Immunity Bypass Indicator
884 8:42a 🔵 AfflictionChatService Immunity Notice Architecture
885 8:43a 🟣 RED Tests: GM Chat Bypass Immunity Indicator
886 " 🔵 RED Tests Confirmed: Bypass Chat Indicator Missing
887 " 🔄 AfflictionService: getEffectiveActorAfflictionImmunities Refactored to Return Bypass Data
888 " 🟣 AfflictionChatService.postImmunityBypassNotice Implemented
889 " 🟣 i18n Keys Added for Immunity Bypass Chat Message
890 " 🔵 Test i18n Mock Missing New Bypass Keys — Raw Key Strings in Content
891 8:44a 🔵 Test Assertion String Mismatch — "bypassed poison immunity" Not Contiguous in Message
892 " 🔴 Test Assertions Updated to Match Actual Bypass Message Format
893 " 🟣 GM Immunity Bypass Chat Indicator — GREEN, All 9 Tests Pass
894 8:45a 🟣 Full Suite GREEN: 159 Tests Pass, Lint Clean — GM Bypass Indicator Complete
895 " ⚖️ Decision: Simplify Trait Options — Restrict to Affliction Immunity Categories Only
896 8:49a 🔄 Simplification: Trait Options Reduced to ['curse', 'disease', 'poison'] Hardcoded Set
897 " 🔵 RED Test Confirmed: _getTraitOptions Returns 15 Values, Target is 3
898 " 🔄 _getTraitOptions Simplified to 3-Item Static Array
959 2:30p 🔵 pf2e-afflictioner Module Architecture Mapped
960 " 🔵 WeaponCoatingService and FeatsService Internals Mapped for Double Poison Implementation
961 2:31p 🔵 Full Coating Hit Pipeline and UI Anatomy Confirmed for Double Poison Design
967 " ⚖️ Double Poison Expiration Mode: Lenient (end-next-turn)
968 " 🔵 Double Poison merge dialog not triggering in live Foundry — second poison replaces first
969 3:43p 🔵 Root cause: Flayleaf is effect-only (no stages) — _isDoublePoisonCandidate must exclude isEffectOnly afflictions
970 " 🟣 Defensive validation: "Add Second Poison" warns instead of replacing when selected item is invalid merge candidate
971 3:44p 🔴 _isDoublePoisonCandidate now excludes stage-less afflictions; _getPreparedCoatingAfflictionData extracted
972 " 🔵 RTK stale cache served identical failing test results (chunk 1f377d) after patches applied
973 3:45p 🔴 AfflictionManagerDoublePoisonInvalid test: actor.items must be array not Map — FeatsService.hasFeat calls .some()
974 3:46p 🔴 AfflictionManagerDoublePoisonInvalid test fixed: actor.items uses Object.assign array pattern for dual .some()/.get() support
975 " 🟣 Test coverage: componentPoisons array on merged double poison now asserted with sourceItemUuid
976 " 🟣 New UI: componentPoisonLinks — info buttons for each component poison in double-poison coating display
977 " 🔵 Test run confirms: componentPoisons assertion passes; componentPoisonLinks template block missing
978 3:47p 🟣 componentPoisonLinks implemented: context builder + HBS template block for per-component info buttons
979 " 🟣 Double Poison / Poisoner's Twist implementation complete: 21/21 tests pass, ESLint pending
980 " 🟣 New PF2e rule: Double Poison requires both poisons be at least 2 levels below actor level

Access 716k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>