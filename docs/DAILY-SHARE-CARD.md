# Daily training share cards

The end-session flow opens a local PNG preview. Today and the selected recorded workout date also expose a manual generation entry. Completion is derived from that date's recorded plan; partial sessions are labelled as records, not completed plans. Cards use submitted logs only, never target reps or target loads. Card generation does not write training data or upload images.

- Feed: 1080 × 1350; Story: 1080 × 1920. Four performed movements per page; all remaining movements continue on additional PNGs.
- Recorded sets/reps, per-side dose, cardio minutes and mobility sets use their own units. Variable reps remain visible; weights are opt-in and retain per-dumbbell and kg/lb semantics.
- No account information, name, body measurements, photos, notes or calorie estimates are included.
- Native file sharing is user initiated; unsupported browsers offer PNG download. Each page has its own download link, avoiding blocked multiple automatic downloads.
- New same-origin artwork: blue 3D models with black tank tops and shorts for push-up, dumbbell row, dumbbell shoulder press, dead bug, bodyweight squat, glute bridge, hip hinge and forearm plank. Exact IDs only; other movements have labelled data tiles. Images are static AI-generated illustrations, not technique certification or a claim of actual user form. No runtime image-generation API is used.
- Existing account configuration, storage namespaces and prior preview URLs remain unchanged. The service worker cache revision includes the new module and image files.

## Validation

- Three new unit tests cover actual vs prescribed values, variable repetitions, per-side records, units, privacy, invalid/empty records and exact artwork mapping.
- Chromium at 390 × 844: preview, PNG download, 4:5 and Story dimensions, optional weights, unsupported-share fallback, auto-open after end-session, seven movements over two pages, and unchanged local records. No page errors.
- Regression comparison excluding the large unrelated matrix stress test: the same 56 pre-existing failures on the original source and modified source; no newly failing test names. Existing fixtures/helpers were not modified. Full matrix run was stopped; no all-tests-passing claim.
- Mobile preview and sample actual PNG are in this directory. Sample data is synthetic.

Close all Streakfit tabs and reopen the URL if an installed older service worker is still active. Do not clear browser storage to update.
