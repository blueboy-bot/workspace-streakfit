# One complete workout card

A completed session now exports one PNG containing every recorded movement. The former four-movement pagination and page numbers are removed. Saving and sharing use the same single image.

The white/blue editorial style remains. One to six movements use a one- or two-column layout; seven or more use three columns. Remaining movements are spread across the final rows, with each row filling the card width. All rows in a three-column layout use the same text/image arrangement, including wider final cells, so equipment cannot sit behind labels. The canvas grows vertically to retain readable row heights. Displaying weights or varying repetitions reserves extra space.

The full-card format keeps 1080×1350 for up to four simple movement records and extends for larger sessions. Story adds top/bottom space, using at least 1080×1920 and extending when necessary. Format labels no longer promise a fixed ratio when content needs a longer image. Actual logged totals, additional sets, privacy defaults, exercise art and planning targets are unchanged.

Validation:
- 19 related tests passed, including render coverage for 1, 4, 5, 6, 7, 8, 9, 20 and 138 movements in both formats: one canvas, each movement drawn once, no pagination, no model mutation.
- Geometry checks cover every count from 1 through 138, readable row heights and Story padding.
- Chromium checked real-image exports for 1, 3, 4, 5, 6, 7, 8, 9, 12 and 20 movements, plus varying reps and weights in Story. All movements were rendered once, with no runtime errors.
- The mobile dialog showed one preview; PNG download succeeded and switching formats still produced one preview.
- Visual review: 6.png, 7.png, 9.png and weighted-story.png.
