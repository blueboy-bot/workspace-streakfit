# Clean thumbnails and reliable artwork updates

Thumbnail overlays such as 准备姿势, 动作图待更新 and 部位示意 are removed from the shared thumbnail renderer. Lesson captions and teaching cues remain in the lesson view. All 138 current catalog movements already have mapped illustrations, including bench press and pec-deck fly; no extra artwork was needed for this fix.

The reported stale placeholders were reproduced with the minimum-four9 worker and two open app tabs. The old worker ignored module query versions and waited for every existing app window to close before activating an update. A new app link could consequently keep displaying the old art mappings.

The worker now activates after its full shell has downloaded, even with other tabs open. Explicit module versions are matched exactly; a different query version uses the network rather than another version's cached file. Existing windows are not force reloaded. The uncached `update.html` entry waits for the current worker to activate before opening the app, so an old controlled window can reliably enter the latest version. Registration bypasses HTTP worker caches. No user storage is cleared.

Validation: 25 related tests passed, including full catalog caption/art coverage, complete versus failed worker installation, exact version routing, share-card exports and the four-set minimum. Chromium reproduced bench and pec-deck placeholders in two old tabs, upgraded through the new entry, verified real art and absent captions, and reloaded offline successfully. The other tab's unsaved input and the actual logged set were preserved. A fresh browser context also opened successfully through the update entry. No runtime errors occurred. Desktop and mobile captures are included here.
