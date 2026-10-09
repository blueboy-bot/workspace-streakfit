# STREAKFIT v0.32.1 — English interface

English entry: https://blueboy-bot.github.io/workspace-streakfit/en/?lang=en

The existing Chinese Pages root is retained. This release is published in `/en/` with its own scoped service worker. English/Chinese, Guided/Advanced and Green/Blue are separate controls. Language changes do not reload the page or change training goals, exercise IDs, equipment values, weight units or the `streakfit-v1` storage format. Both entries share origin-local records; there is no enabled cloud account service in this release.

## Translation scope

- First-use questions, pre-exercise screening, plan settings and validation.
- Daily tasks, four-week route, logging, pause/resume and rest timer.
- 138 exercise names and 414 cues, variations, guidance and substitutions.
- Learning checks, recovery, calendar, optional measurements and progress.
- Backup/restore, CSV headings and exercise names, reminder text and share cards.
- User-authored names, notes and exercise setups are preserved. Full JSON backups retain canonical data and remain compatible with the Chinese version.

English does not select pounds automatically. Users keep control of kg/lb; stored masses remain in kg. English phone statistics fit within their cards. A language selection also updates the URL without reloading, so a refresh retains that selection. English weight/repetition labels align at the bottom to accommodate longer text. Existing mobile audit findings, such as overly prominent pause controls, are otherwise retained for the user's separate review.

## Build and verification

```
python scripts/build-pages.py --language en --output /workspace/streakfit-preview/english-pages/en
python scripts/build-preview.py
npm test
npm start
node scripts/verify-localization-browser.cjs
node scripts/verify-pwa.cjs
```

`modules/localization.js` translates display text and accessible labels. Original text is retained for reversible switching. Implicit option values are made explicit before translating their labels. Mutation observers cover dynamic messages. Training algorithms continue using canonical fields; translation must never be applied to saved profile values.

Source translations are in `modules/locales/en-ui.js` and `en-movements.js`. Browser-based missing-text collection is diagnostic, not a fallback that hides unrecognized content.

Validation: 191 existing tests passed; 4 localization tests passed. Real Chromium phone flows checked English onboarding, canonical values, pounds conversion, five logged sets, input preservation while switching language, field alignment, pause/resume, pain blocking, JSON backup/restore and reload. 315 generated goal/experience/time/focus cases had no untranslated text. All exercise-guide screens were visited independently in Chromium. Offline checks passed at 320/390/430 pixels, with all locale modules cached in the English scope; the standalone HTML was served over HTTP without external JavaScript modules.

These are browser-emulation checks, not physical iPhone/Safari, VoiceOver or lock-screen tests. The managed browser blocks direct `file://` navigation, so direct opening of the standalone HTML from disk was not verified. Browser notifications still cannot guarantee background or lock-screen timing. Linked videos are not translated or replaced in this release.
