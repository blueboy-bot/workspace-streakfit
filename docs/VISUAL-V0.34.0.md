# STREAKFIT v0.34.0 visual preview

The existing v0.33.0 Chinese and English site remains at its current URLs. This release is an independent preview at `preview/visual-v0.34.0/`, with English at `preview/visual-v0.34.0/en/`. The existing source checkout and its unfinished changes are preserved.

## Changes

- Keep the four light/dark green/blue themes. Use calmer card surfaces, consistent borders, rounded corners and stroke icons.
- Compact the phone header to brand, experience mode and settings. Color, language, plan settings and account access remain available in the settings dialog.
- Reserve the main accent button for starting, recording and completing training. Pause and body feedback remain accessible as secondary controls.
- Align load and repetitions side by side. Keep load conventions below the inputs, readable numeric values and 44px or larger touch targets.
- Reduce the idle rest timer, simplify recorded-set rows and collapse backup reminder detail without removing backup access.
- Preserve safety messages, blank-load validation, actual additional sets, draft retention and optional body records.
- Correct the finish button to say Return to Today, matching the existing behavior.

## Version and data isolation

The preview uses `streakfit-visual-v034:` local-storage keys. On first use it may read the original anonymous records and presentation preferences as a starting point, but all preview writes and removals use the preview namespace. Original account sessions are not inherited. Restoring a backup in the preview also stays within this namespace. Download JSON backups before moving records between versions. This is browser-local isolation, not cloud synchronization.

Service-worker caches include their app scope, so the preview and its English scope do not delete the original application's cache. The manifest uses a separate scope and preview name.

## Verification

26 regression tests pass. Real browser clicks cover 32 combinations of 320/360/390/430px width, two modes, two color families and two languages. Weight and repetition inputs align with a measured 0px top difference in every combination. Required screening, pause/resume, pain blocking, five-set recording, remove/undo, guided training and recovery, drafts, preferences, navigation, backup downloads and root/English offline reloads pass. A separate browser flow confirms original data and language remain unchanged after preview recording and preference changes, and preview changes survive reload.

These checks use Chromium mobile emulation, not a physical iPhone. Account registration remains disabled while email/SMS services are not configured. Training algorithms and videos are unchanged.

## Build

```sh
python3 scripts/build-pages.py --output /tmp/streakfit-visual --language zh
python3 scripts/build-pages.py --output /tmp/streakfit-visual/en --language en
```

See `VISUAL-V0.34.0-VERIFICATION.json` for measured browser checks.
