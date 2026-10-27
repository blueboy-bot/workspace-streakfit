# Body-part training selection

Restores explicit chest, back, legs, shoulders and arms choices on every strength-training date. Previously `focusOptions` filtered choices by the automatic push/pull/leg or upper/lower day and converted a saved choice to balanced when the date's automatic split differed. The route now has a visible body-part entry; the editor shows its selector above the workout rather than inside nested details. Tabs preview a choice; Apply saves it only for the selected date.

Legs covers quads, hamstrings, glutes and calves, with complementary groups selected before repeated variations. Hypertrophy specialization filters each slot's alternatives to the selected muscles before choosing equipment-compatible movements. Existing submitted sets are retained when changing the plan. Historical days remain read-only; cardio and mobility keep their own planning controls. This does not impose a new recurring five-day schedule.

Validation: body-focus, focus-context, lift-days and localization tests; Chromium at 390 × 844 checks route navigation, all five tabs, unsaved previews, applying legs and persistence after reload. Existing fixtures/helpers were not changed. The two prior focus-context expectations that deliberately hid other body parts now assert the requested explicit choice behavior.
