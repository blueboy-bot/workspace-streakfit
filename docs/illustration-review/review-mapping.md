# STREAKFIT v0.38.0 image mapping and illustration audit

Scope: read-only source review and visual inspection of **all 34 actual selected gallery card crops**, using three montage sheets, plus full-size inspection of pulldown, facepull, cablerowSingle, barhip, deadlift, and dbcalf. Inspected both panels of `pulldown-reviewed.png` and **only the bottom row** of `teaching-keyframes.png` for teaching judgments. Retired atlas cells were not evaluated as displayed images. No application files changed.

## Findings

| Severity | Confidence | Finding and evidence |
|---|---|---|
| P2, visual defect | High | **`barhip` crop includes a second person's head.** `crops/barhip.png`: the intended hip-thrust scene ends at the horizontal white divider about 408 px into its 468 px art region, followed by approximately 60 px of the lower atlas cell, including a blue head. The reviewed mapping assumes equal 2×2 cells (`modules/daily-overview.js`, `barhip`, row 0 / column 0); the illustrated panel boundary does not coincide with that crop. Export an isolated intended panel or set measured crop bounds. |
| P2, visual defect | High | **`deadlift` crop includes another blue head at its bottom.** `crops/deadlift.png`: a horizontal scene boundary appears approximately 420 px into its 468 px art region, followed by part of the next atlas row's head. `overviewArtwork.deadlift:24` and the equal 4×4 crop in `app.js:1296` select the right general exercise but fail to isolate its scene. Export the intended cell or correct measured crop bounds. |
| P3, composition | High | **`dbcalf` clips the entire head.** `crops/dbcalf.png`: the upper art boundary passes through the neck while the calf raise, wall support, dumbbell, and feet remain visible. The adjacent `barhip` crop containing a lower-row head supports a shared panel-boundary problem in `posture-reviewed.png`. Fix panel extraction so the complete person fits the crop. This does not obscure the actual calf action. |

No P0/P1 finding established. These are visible composition defects, not evidence of unsafe joint angles or a different exercise being shown.

## Verified mapping, counts, and loading

- Runtime catalog contains **138 entries**; `catalog.json` contains 138 records. `overviewArtwork` has **33 exact exercise IDs**, including curl and altcurl sharing one appropriate curl image. Gallery manifest has **34 unique IDs**, matching **34 existing PNG crops**: all 33 exact IDs plus the withheld `legcurl` placeholder.
- Actual gallery has **34 cards / 34 art nodes**. Browser `Image` loads succeeded for all **8 distinct selected overview assets**: three overview atlases plus pulldown-reviewed, equipment-reviewed, posture-reviewed, positions-reviewed, and setups-reviewed. Atlas dimensions are 1254×1254; pulldown-reviewed is 1774×887. No failed selected overview image load observed.
- Reviewed mapping overrides are applied for the exact 10 specified IDs. No variant-wide reuse of those reviewed grips/attachments was found. Square grid crop aspect calculations are internally consistent; the two visible bleed defects show that equal nominal grid cells are insufficient for those particular drawn panel boundaries.
- The `legcurl` card deliberately uses a standing neutral figure labeled **动作图待更新**. It is not a seated-leg-curl demonstration and is disclosed as unavailable. It is included in 34 gallery cards, not in the 33 exact illustrated IDs.

## Name, phase, cue, and equipment review

- All 33 exact cards depict the named exercise category. Distinctions checked include wall versus floor push-up; dumbbell floor versus bench press; barbell versus dumbbell RDL; a rear foot on the floor in split squat; chest support in chest-supported row; D-handle in single-arm cable row; close neutral attachment in neutral pulldown; cable fly versus dumbbell fly; leg extension versus the intentionally withheld leg curl.
- `deadbug` and `bird` display **准备姿势**, correctly describing their bilateral tabletop and four-point support images. Their text describes the subsequent opposite-limb movement; neither setup image is presented as that movement's endpoint.
- Pulldown teaching uses the reviewed two-panel source: arms elevated at **起始位置**, bar at upper-chest/front-of-body height at **下拉位置**. The overview uses its second panel. Facing the machine, thigh restraint, forward bar path and broadly maintained hand placement agree with the cues. No behind-neck pull is depicted.
- Chest-supported teaching uses the bottom atlas row only: dumbbells hang at the start, elbows pull back in the second frame, and the torso remains on the inclined pad. Labels and movement progression agree. Hand anatomy and thumb wrapping cannot be certified from the illustration.
- Equipment shown is broadly recognizable and plausible: selectorized pulldown/cable stations with seats and thigh pads where expected, common cable handles, bench-supported dumbbell work, sled leg press, seated leg-extension roller, free-weight bench/rack, chair squat, mat exercises, and a supported calf raise. The images do not establish actual machine adjustment or hardware safety.
- No conspicuous trunk collapse, behind-neck pull, rear-foot-elevated split squat mismatch, or contradiction of the main posture cues was established in the selected images. Static stylized 2D scenes cannot establish precise angles, movement control, individual suitability, or professional approval.

## Recommendation

Correct the `barhip` and `deadlift` cell bleed before visual sign-off, and repair `dbcalf` framing with the same extraction work. Preserve the explicit setup and unavailable-image labels. Mapping coverage and asset loading pass within the reviewed gallery scope.

## Candidate-fix recheck — supersedes the findings above

Inspected regenerated full-size actual crops for **barhip, deadlift, rdl, dbcalf, bird, pushup**, followed by **bench, incline, pulldown**. Reviewed the changed crop metadata and `overviewGraphic` calculation. Application files remained unchanged by this audit.

| Previous finding / changed area | Outcome | Confidence and evidence |
|---|---|---|
| P2 barhip neighboring head | **Resolved** | High. Regenerated `crops/barhip.png` contains only the intended hip-thrust scene; no divider or lower-cell head. Full figure and equipment remain visible. |
| P2 deadlift neighboring head | **Resolved** | High. Regenerated `crops/deadlift.png` contains only its intended scene; no next-row head or scene strip. Head, feet, hands, and barbell are visible. |
| P3 dbcalf head clipping | **Resolved** | High. Regenerated `crops/dbcalf.png` includes the full head, supporting hand, dumbbell, and raised heels. No neighboring-cell content. |
| rdl, bird, pushup extraction | **Pass** | High. All three inspected regenerated crops isolate their intended person/scene with complete heads and action landmarks. Bird retains its preparation label. No neighboring tile bleed observed. |
| Proportions and letterboxing | **Pass within reviewed scope** | High for calculation; medium-high visually. The crop uses `l=max(width,height)` and scales both source dimensions by the same `1/l` factor, preserving source-pixel proportions. Symmetric `clip-path` insets isolate the requested rectangle while its remaining axis is letterboxed. The six rendered crops show no obvious stretch. This preserves the original artwork's proportions, without certifying its anatomy. |
| bench and incline | **Disclosed withheld placeholders** | High. Both regenerated crops show the neutral standing figure and **动作图待更新**; neither claims to demonstrate the named press. Their names/cues remain present as text. |
| pulldown phase | **Correct setup labeling** | High. Regenerated pulldown crop uses the first reviewed panel, with arms elevated, and **准备姿势**. Runtime `keyframeTeaching('pulldown')` returns an empty string; only chest-supported row remains in `teachingKeyframes`. No old pulldown phase pair is selected. |

Updated runtime counts: **138 catalog entries**, **31 exact overview IDs**, **12 reviewed overrides**, **3 withheld IDs** (`legcurl`, `bench`, `incline`). The 34-card gallery now comprises those 31 exact IDs plus the three disclosed placeholders. The prior 33-exact count and pulldown teaching description are historical observations of the pre-fix candidate.

**Recheck result:** all three original crop findings are resolved. No new blocking mapping, framing, or aspect issue established in the changed crops. Coverage is reduced by the two additional disclosed press placeholders; these are unavailable illustrations, not validated exercise demonstrations.
