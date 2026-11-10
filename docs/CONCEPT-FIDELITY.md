# Racing concept and playable implementation

The source is the original four generated images from November 10, 2026.
No new conceptual image was generated for this implementation.

[Originals and runtime comparison](https://chatgpt.com/space/page_250e5db70e1c8191906045b0cd11e64d)

| Original element | Runtime implementation | Verification |
| --- | --- | --- |
| Red sports coupe | Tapered red body, windshield, full-width tail lamp, spoiler, circular wheels and blue team stripe | Whole-mesh visibility tests, three cameras, all five maps |
| Sunset city and ring | Map 01 skyline, boulevard, distant ring, dusk sky and cyan/orange road palette | Runtime screenshots, WebGL and software fallback |
| Low chase camera | Map 01 rig exposes the horizon and a rear-quarter view | Whole-car regions over 240 headings and falling states |
| Cyan gates and road arrows | Directional chevrons, quarter-route gates, start/lap/finish labeling | Real geometry, collidable gate pillars and scene captures |
| Drift smoke and tire marks | Existing physical skid condition, bounded smoke and 96 trail faces, live duration | Pause/reset/bounds and actual render tests |
| Jump feedback | Existing Wild Trail ramp physics, live air time, landing feedback | Physics-generated jump and landing capture |
| Race HUD | Actual lap, elapsed/best time, rank out of four, team points and speed | 1280x720, 844x390, 390x844 and 320x740 control reachability |
| Finish | Existing legal three-lap finish, saved time, frozen ranking and confetti | Separate native-animation keyboard race |

The original sky pixels are reused in `dist/dusk-sky.webp`, a small crop of
`image-gen-1(9).png`. The complete image remains in the linked Page. Cars, roads,
gates and city are executable geometry. No generated screenshot is substituted
for gameplay.

## Remaining concept differences

The executable art is stylized geometry. The original depicts a photorealistic
car and reflections, an eight-car race, 300+ km/h, boost pickups, drift bonuses
and a large suspended jump track. This implementation retains the verified
four-car race, five existing course layouts and their physical speed limits.
Those original-image elements remain open differences. They are not claimed as implemented or PASS.

The viewport/state test proves the executed gameplay and presentation contracts.
It does not establish photorealistic material parity or physical-phone performance.
