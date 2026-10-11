# STREAKFIT v0.34.1 professional typography preview

Publish under `preview/visual-v0.34.1/`, with English at `preview/visual-v0.34.1/en/`. Production v0.33.0 and visual preview v0.34.0 remain unchanged.

## Typography

- Chinese: a subset of Noto Sans SC, the Google counterpart of the Source Han Sans family. Medium title weight and explicit sans-serif fallbacks replace inconsistent system fallback.
- English titles and the wordmark: Barlow SemiBold.
- Latin body text and numeric readouts: Inter with tabular figures, fixed optical size and restrained weights.
- Text fields, dropdown options and textareas explicitly use the same typography system. Chinese headings avoid negative letter spacing. Body text stays 16px; recording numbers stay 26px.
- The English load placeholder is shortened to Enter weight so it fits narrow phone fields. Actual-load guidance and validation remain unchanged.

The three self-hosted WOFF2 files total about 2.0 MiB. They are cached by the scope-specific service worker for offline use. The Chinese subset covers all 941 Chinese characters present in current UI source, plus common GB2312 characters. Rare user-authored characters use PingFang SC or Microsoft YaHei where available. Font files and derivatives remain licensed under SIL OFL; licenses and pinned source URLs/hashes are bundled in assets/fonts.

No external font server is required. Shared standalone HTML exports also embed their font data and licenses.

## Preservation and data

The v0.34.0 visual preview is retained. This typography preview keeps its v034 local-storage namespace, so existing visual-preview records are available and edits are shared between the two visual previews. The production site's original keys remain independent. No training algorithms, account-service configuration or safety logic changed.

## Verification

32 mobile combinations of width, language, mode and color family pass the existing real-click flows. Tests cover aligned inputs, pause/resume, drafts, actual additional sets, pain blocking and guided/recovery flows. Four localization tests pass. Real Chromium font inspection identifies the bundled Chinese font on Chinese headings, Barlow on English headings and Inter on numeric text at 390px and 1366px. Numeric digits 1111 and 8888 have equal tabular widths. Offline reload retains custom fonts, and the nested English scope retains offline settings and translation. No page errors were observed.

Tests use desktop Chromium and mobile viewport emulation, not a physical iPhone. See TYPOGRAPHY-V0.34.1-VERIFICATION.json.

## Rebuild fonts

Font assets are committed, so normal app builds need no font toolchain. To regenerate them, install fonttools with Brotli support, download the pinned originals and licenses listed in assets/fonts/SOURCES.json into a directory with the same names and a sources.json manifest, then run:

```sh
python3 scripts/build-fonts.py --source /path/to/downloaded-fonts
```

Subsetting preserves layout features and variable weights 400–700. Modified font names are Streakfit Han, Streakfit UI and Streakfit Display.
