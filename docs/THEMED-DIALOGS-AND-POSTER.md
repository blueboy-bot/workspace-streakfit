# Unified dialogs and poster polish

All application-owned HTML dialogs use the selected paper, text, accent, border and control palette. Shared corner radius, spacing, overlay blur and button hierarchy cover settings, accounts, safety/comfort, help/recovery, history editing, illustration viewers and sharing. Browser/OS permission prompts and file pickers remain system UI.

Replaced all three native confirm calls: incomplete session ending, removing a recorded movement from the plan and deleting recovery copies. The common accessible alertdialog uses explicit action labels, cancellation on Escape/dismissal and focus restoration. Duplicate confirmations are declined. The workout handler now waits for the result; only a successful end dispatches a dated session-ended event that opens the share card. Cancelling leaves the session and submitted logs intact. The original date is captured before awaiting confirmation.

The exported card retains the six illustrated cells and real counts. A tighter header places the date opposite the wordmark, gives more space to illustrations, adds rounded panels and fine borders, aligns the data baselines and finishes with a restrained footer. Weight inclusion, feed/story formats, image download and privacy behavior are unchanged.

Validation: 10 related model/planning tests pass. Chromium at 390 × 844 checks all three themed confirmation flows, Escape and Cancel with unchanged submitted logs, accepting a partial end followed by automatic sharing, no native browser dialogs, and matching surfaces across dark-green/light-blue themes. Six-image PNG and Story exports pass with no runtime errors. The screenshot and poster contain synthetic records. Final spacing was inspected in the actual exported PNG.
