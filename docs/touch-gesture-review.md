The mobile gesture fallback supplements `touch-action: manipulation`. A second stationary single-finger tap within 350 ms and 30 CSS pixels cancels the browser's default zoom gesture. Because cancelling `touchend` also suppresses its compatibility click, the control receives one synchronous click. Controls replaced by a render are supported.

Movement over 10 pixels, long presses over 300 ms, cancelled touches, multi-touch sequences, and native text/select inputs retain their default behavior. No viewport zoom limits or pinch-blocking listeners are added. The share-card renderer and artwork are unchanged.

Validation:
- Six unit tests cover tap activation, delays/distances, scrolling, long presses, pinch/cancellation, editing, detached/replaced controls and teardown.
- Chromium with mobile/touch emulation and trusted CDP touch events, with `touch-action` forced to `auto`: the second tap is default-prevented and the viewport scale stays at 1; two rapid button taps activate exactly twice despite DOM replacement; input focus and taps retain native behavior; a one-finger drag scrolls; an actual two-finger spread increases the viewport scale from 1 to 5 without being cancelled.
- The real workout flow still saves fourth, fifth and sixth sets, honors pause, preserves records after reload and generates the current share card after ending.

An actual iPhone/Safari device is not available in this workspace; the browser checks above use Chromium mobile emulation.
