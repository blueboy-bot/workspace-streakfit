# STREAKFIT v0.34.2 — compact exercise cards

Independent visual preview; v0.33.0, v0.34.0 and v0.34.1 remain available unchanged.

The shared strength card now shows target sets/reps, actual recorded sets, rest and reps in reserve. Empty history panels and repeated suggested-input summaries are omitted. Notes contain cues, load advice, movement classification and the explanation of reps in reserve. Reordering, substitutions, targets and removal are inside Adjust exercise. Focused recording provides notes and a separate Edit plan action.

A real previous session displays its date. After logging, the previous set and undo appear; fifth and later sets remain recordable. Unknown loads remain blank. Stale or ambiguous historical weight warnings stay visible. Per-dumbbell, total-load, assisted, bodyweight, band and per-side conventions are retained. Pain, safety screening, pause and save-failure behavior are unchanged. All four themes and Chinese/English remain available.

The card renderer was extracted from the page template. This is a presentation update, not a change to prescriptions, data schema, units or rewards. Preview storage retains the existing isolated visual-preview namespace; production records are not written by the preview.

Validation: 26 existing automated tests; Chromium mobile emulation at 320/360/390/430 pixels in both modes, both palettes and both languages (32 combinations); real clicks for drafts, pause, pain, fifth set, remove/undo, settings, navigation, backup and offline reload. Additional card tests cover collapsed notes/sorting, actual reorder, all recording conventions, English disclosures, stale/ambiguous history and focused notes. Physical iPhone/Safari testing remains to be done.

Build: `python3 scripts/build-pages.py --output <site> --language zh`; repeat with `<site>/en --language en`. Standalone exports: `python3 scripts/build-preview.py`. Serve the build with a normal static HTTP server for internal validation; GitHub Pages is the public preview.
