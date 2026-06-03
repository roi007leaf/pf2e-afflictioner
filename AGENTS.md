<claude-mem-context>
# Memory Context

# [pf2e-afflictioner] recent context, 2026-06-03 9:54am GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,908t read) | 194,347t work | 91% savings

### Jun 1, 2026
7278 2:44p 🔵 Afflictioner Custom Disease: Stage Penalties Not Applying Despite Editor Configuration
7279 " 🔵 StageEditorDialog Correctly Builds FlatModifier Rule Elements for Stage Penalties
7280 " 🔄 Simplified FlatModifier Rule Element Labels to "AfflictionName - Stage N" Format
7281 " ✅ Tests Pass After buildRuleElementLabel Refactor
7282 " ✅ Full pf2e-afflictioner Test Suite Green After Label Refactor
7283 2:45p 🔄 collectIndexedFormEntries Static Method Consolidates Form Data Parsing in StageEditorDialog
7284 " 🔴 AfflictionEffectBuilder Now Passes Editor ruleElements Through to Built Stage Rules
7285 " 🔵 pf2e-afflictioner Current Version is 3.3.3; Preparing Changelog for Editor Rule Element Fix
7286 " ✅ pf2e-afflictioner Bumped to v3.3.4 with Affliction Editor Stage Rules Fix
7287 2:46p ✅ v3.3.4 Release Ready: All Tests Pass, Lint Clean, Full Working Set Staged
### Jun 3, 2026
7492 9:30a 🔵 pf2e-afflictioner Condition Lifecycle and Cleanup Architecture
7494 9:31a 🔵 PERSISTENT_CONDITIONS Remain After Affliction Removal by Design
7496 9:32a 🔵 VALUELESS_CONDITIONS Constant and Confirmed Absence of removePersistentConditions
7509 9:39a 🔵 Audit of CHANGELOG.md for Conditions with Duration/Removal "Outlived" Status
7510 " 🔵 PF2e Afflictioner Module: Condition Constant Definitions in constants.js
7512 9:40a 🔵 pf2e-afflictioner Parser Locale Architecture and Condition Mapping System
7513 " 🔵 AfflictionEffectBuilder Condition UUID Resolution and Rule Building Tests
7514 9:41a 🔴 PERSISTENT_CONDITIONS Expanded to Include All Conditions with PF2e Removal Rules
7515 " 🟣 Test Added: PERSISTENT_CONDITIONS Excluded from GrantItem Rules in _buildRulesFromStage
7516 " 🔵 All 7 AfflictionEffectBuilderConditions Tests Pass After PERSISTENT_CONDITIONS Expansion
7517 " ✅ Full Test Suite (240 tests, 30 suites) and Lint Pass Clean After PERSISTENT_CONDITIONS Fix
7518 " 🔵 persistent-damage Has Its Own Special Handling Path, Excluded from Normal GrantItem Flow
7519 9:42a 🔵 AfflictionService Stage Transition Lifecycle: removePersistentDamage Called Before and After Stage Apply
7520 " 🔴 Removed Both removePersistentDamage Calls from AfflictionService Stage Lifecycle
7521 " 🔄 Removed Orphaned oldStage Variable from AfflictionService Stage Removal Path
7522 " 🔴 removePersistentDamage Now Scoped by damageType and Called Per-Type Before Applying New Damage
7524 " 🟣 Test Added: Per-Type Persistent Damage Replacement Leaves Other Types and Afflictions Untouched
7525 9:43a 🔵 All 8 AfflictionEffectBuilderConditions Tests Pass Including Per-Type Damage Replacement Test
7526 " ✅ Full Suite (241 tests, 30 suites) and Lint Pass Clean After All Persistent Condition Fixes
7534 9:47a 🔵 pf2e-afflictioner Repository Details: GitHub Remote, Version 3.3.6, Working on main Branch
7535 9:48a ✅ Version Bumped to 3.3.7 and CHANGELOG.md Updated for Condition/Persistent Damage Fixes
7536 " ✅ Committed 3.3.7 Fix: "Fix affliction condition cleanup lifetimes" (8482b56)
7537 " ✅ 3.3.7 Commit Pushed to GitHub main Branch (3baae7e→8482b56)
7538 " ✅ Git Tag 3.3.7 Created and Pushed to GitHub
7539 9:49a ✅ GitHub Release 3.3.7 Published at roi007leaf/pf2e-afflictioner
7540 " 🔵 AfflictionParser Stage Extraction: Three Parse Paths and Duration Detection Logic
7541 " 🔵 AfflictionParser Stage Duration vs Condition Duration: "for N unit" Pattern Applies to Stage, Not Condition
7542 9:50a 🟣 AfflictionParser Now Extracts Per-Condition Duration from "for N unit" Syntax in Stage Text
7543 " 🟣 AfflictionEffectBuilder Handles Conditions with Inline Duration as Timed Standalone Items
7544 " 🟣 Test Added: Per-Condition Inline Duration Parsed from "for N unit" Syntax
7545 " 🟣 Tests Updated: Inline-Duration Conditions Excluded from GrantItem Rules and Applied as Timed Standalone Items
7546 " 🔴 Test Failure: Existing Forbidden Cravings Test Needs duration:null Added to Expected Condition Shape
7548 " 🔴 Fixed Test Breakage: condition.duration Now Omitted (Not null) When No Inline Duration Present
7549 9:51a 🔵 All 112 AfflictionParser Tests Pass After Per-Condition Duration Fix
7550 " 🔴 AfflictionParser extractStages: Condition Extraction Changed from effects to rawContent in htmlParaRe Path
7551 " 🟣 Test Added: Per-Condition Duration Preserved Through extractStages Plain Semicolon Parse Path
7552 " 🔴 Wrong Line Changed: rawContent Substitution Applied to htmlInlineRe Path Instead of htmlParaRe Path
7554 " 🔴 All 113 AfflictionParser Tests Pass After Correcting rawContent/effects Substitution to htmlParaRe Path Only
7556 9:52a ✅ Full Suite (244 tests, 30 suites) and Lint Pass Clean — Per-Condition Duration Feature Complete
7557 " 🔵 Pre-Commit State for 3.3.8: 5 Files Modified, AGENTS.md Also Changed

Access 194k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>