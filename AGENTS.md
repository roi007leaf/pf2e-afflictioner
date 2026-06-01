<claude-mem-context>
# Memory Context

# [pf2e-afflictioner] recent context, 2026-06-01 2:45pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,955t read) | 231,471t work | 92% savings

### May 10, 2026
1605 9:30a ✅ Full Test Suite and Lint Pass Clean After Hero Point Reroll Fix
1608 9:37a ✅ CHANGELOG.md Updated for Patch 3.2.4
1609 " ✅ Patch 3.2.4 Contains Two Bugfixes in CHANGELOG.md
1610 " ✅ Patch Incremented from 3.2.4 to 3.2.5; Changelog Entries Split Across Two Patches
1611 9:52a 🔴 Shift-Click Afflictioner Button Broken When Dialogue Hidden by Default
1612 " 🔵 Root Cause Traced: eventToRollParams skipDialog Toggle Mechanism
1613 " 🔴 Fixed Shift-Click Dialog Toggle: saveButtons.js Now Forwards Click Event to roll()
1614 9:53a 🔴 All Tests Green: Shift-Click Event Fix Verified and Changelogged
1615 " ✅ Full Test Suite and Linter Pass Clean After Shift-Click Fix
1616 10:06a 🔵 Shift Key Roll Dialog Skip Feature Not Working in saveButtons.js
1617 " 🔵 PF2e System eventToRollParams Function: Shift Key Inverts Dialog Skip
1618 10:07a 🔵 saveButtons.js Already Passes event to PF2e roll() — Root Cause Is Elsewhere
1619 " 🔵 SaveButtonsRollMode Tests: Event Pass-Through is the Explicit Contract Being Tested
1620 " 🔴 Fixed Shift-Click Roll Dialog Skip in pf2e-afflictioner Save Buttons
1621 10:08a 🔴 Full Test Suite and Lint Pass After Shift-Click Fix
1622 " 🔵 Other Roll Handlers in pf2e-afflictioner Also Missing skipDialog/event Pass-Through
1623 " 🔵 AfflictionManager.rollSave Routes Through Chat Prompt, Not Direct Roll — Shift-Click Fix Already Covers It
1624 10:09a ⚖️ Decided NOT to Pass Raw event to PF2e roll() — Only Explicit skipDialog Is Sent
1625 " 🔵 Tests Fail: saveButtons.js Still Passes event in rollOptions After Test Contract Change
1626 " 🔴 Removed event from rollOptions in All Three saveButtons.js Handlers
1627 " 🔴 pf2e-afflictioner Shift-Click Dialog Skip Fix: Final Confirmed State
1628 10:11a ✅ Shift-Click Fix Ships in pf2e-afflictioner v3.2.5 Alongside Hero Point Reroll Fix
1629 10:12a ✅ Shift-Click Fix Moved to New v3.2.6 Release, Separated from Hero Point Fix in v3.2.5
1630 " ✅ module.json Bumped to v3.2.6
1631 " ✅ pf2e-afflictioner v3.2.6 Committed to main (4b7bed2)
### Jun 1, 2026
7243 2:21p 🔵 Afflictioner Custom Disease: Stage Condition Application Bug
7244 2:22p 🔵 pf2e-afflictioner Stage Effect Architecture: ruleElements vs Conditions
7245 " 🔵 Root Cause Found: `stage.ruleElements` Never Processed by AfflictionEffectBuilder
7246 2:23p 🔵 Confirmed Fix Path: Append `stage.ruleElements` Directly in `_buildRulesFromStage`
7249 " 🔵 Complete Call Chain Confirmed: ruleElements Present at applyStageEffects but Dropped in Builder
7250 2:24p ✅ Failing Tests Added to Drive ruleElements Fix in AfflictionEffectBuilder
7251 " 🔵 Tests Fail as Expected, Confirming Bug and Revealing Label Nuance
7252 " 🔴 Fixed: AfflictionEffectBuilder Now Applies stage.ruleElements to PF2e Effect Rules
7253 " 🔵 Fix Fails in Tests: `foundry.utils.deepClone` Not Available in Jest Environment
7254 2:25p 🔴 All 5 Tests Pass: ruleElements Fix Complete with Environment-Safe Clone
7255 " ✅ New Test Added to Probe Stage 4 Stupefied GrantItem Rule Generation
7256 " 🔵 Stage 4 Stupefied Bug is NOT in AfflictionEffectBuilder — Condition Lookup Works Correctly
7257 " 🔴 Full Test Suite and Linter Pass: ruleElements Fix Ships Clean
7259 2:34p 🔵 Condition Array Construction in StageEditorDialog.updateFromForm()
7261 2:35p 🔵 Dual-Path Condition Parsing in StageEditorDialog.updateFromForm() — Potential Single-Condition Bug
7264 " 🔵 AfflictionEditorDialog Uses Index-Only Parsing for Onset Conditions — No Dual-Path Bug
7265 " 🔵 Test Confirms Multi-Condition Bug in StageEditorDialog — Conditions Silently Dropped to Empty Array
7266 2:36p 🔴 StageEditorDialog: collectIndexedFormEntries() Replaces Dual-Path Form Parsing for Conditions, Damage, Weakness
7268 " 🔴 collectIndexedFormEntries() Fix Verified — All Targeted Tests Pass
7269 " 🔴 AfflictionEffectBuilder: Rule Elements from Editor Now Included + FlatModifier Deduplication
7278 2:44p 🔵 Afflictioner Custom Disease: Stage Penalties Not Applying Despite Editor Configuration
7279 " 🔵 StageEditorDialog Correctly Builds FlatModifier Rule Elements for Stage Penalties
7280 " 🔄 Simplified FlatModifier Rule Element Labels to "AfflictionName - Stage N" Format
7281 " ✅ Tests Pass After buildRuleElementLabel Refactor
7282 " ✅ Full pf2e-afflictioner Test Suite Green After Label Refactor

Access 231k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>