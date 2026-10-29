# Supplemental exercise illustrations

Adds explicit art for 97 formerly unpictured catalog movements: 95 entries in `modules/supplemental-artwork.js` and two back-squat timing variants using the existing squat poses. All 138 current catalog IDs now resolve to illustrations. Equipment and grip variants have separate crop mappings; timing-only variants keep their own written cues.

The added assets use blue 3D models, black workout clothing and deep green backgrounds. Nine atlases serve plan thumbnails, the lesson image viewer and exported share cards. Bench press has two positions; single-position illustrations are labelled as such. Superseded draft poses are documented in `assets/exercises/REVIEW-supplemental.json`. Images are static illustrations, not movement videos.

The share card keeps its white/blue grid and actual logged sets. Long labels are constrained and horizontal artwork leaves clearance for text. The four-set planning minimum, extra-set logging and touch gesture handling remain in place.

Validation: 33 tests passed across supplemental artwork, existing artwork review, Today overview, share cards, minimum sets, extra sets and touch gestures. Browser checks confirmed illustrated Today rows, both bench positions in the viewer, share export, all nine atlases loading, and no runtime or asset errors. Crop bounds are checked against each PNG's actual dimensions.

Review captures: `supplement-art-mobile.png`, `supplement-art-card.png`, `supplement-art-gallery.png`.
