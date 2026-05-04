<claude-mem-context>
# Memory Context

# [pf2e-afflictioner] recent context, 2026-05-04 3:27pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,946t read) | 812,189t work | 98% savings

### Apr 23, 2026
152 8:31a 🔴 Full test suite and lint pass after drag-cancel fix — 107 tests green, 0 lint errors
### May 4, 2026
854 8:00a ⚖️ Immunity Override Feature Design — Open Questions
855 8:01a 🔵 pf2e-afflictioner Immunity Check Architecture
856 " 🔵 originActorUuid Already Exists on afflictionData; Toxicologist Swap Lives in WeaponCoatingService
857 " ⚖️ Affliction Immunity Override Feature Design Discussion
858 8:06a 🔵 pf2e-afflictioner Affliction Editor + Definition Store Architecture
860 " ⚖️ Immunity Bypass Rule Owned by Source Actor, Not Affliction Definition
859 " 🔵 AfflictionEditorDialog Save Flow + Live Affliction Propagation
861 8:08a ⚖️ Immunity Bypass Rule Configured in Affliction Manager UI
862 " ⚖️ Immunity Bypass Rule Scope: Selectable Traits AND Named Afflictions
863 " ⚖️ Bypass Rule Matching Uses OR Logic Between Traits and Named Afflictions
864 " 🔵 DEFAULT_SETTINGS Structure — New immunityBypassRules Setting Needed
865 8:10a 🟣 Immunity Bypass Feature Implementation Plan Formalized
866 " 🔵 AfflictionParser Returns traits Array — Bypass Check Can Match Directly
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

Access 812k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>