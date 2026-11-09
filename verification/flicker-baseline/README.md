# Baseline and fixed-frame evidence

Baseline source is main commit b5900c057928f1a41bd9106495e4631b7f5978bb.
Its dist/perspective.js SHA-256 is baf473e9a3490f260cac4307af63d850793b6f8ae08d66980b52c457a13e523b.

beam-before.json/png and beam-after.json/png use identical actual physics inputs and a 390×844 viewport. Step59 is the 60th tick, elapsed1.20s. The only production difference is perspective rendering/camera resource handling.

The old baseline fails the committed browser-camera regression at step59 with88 car-only pixels. The fixed frame has6785 pixels, camera distance95.7088, with the beam still in the mesh.

mountain-844-loss.json stores car-only change sensitivity before and after official WebGL context loss. A zero differential indicates an unresponsive/stale renderer, not a measurement that all car-colored pixels vanished. context-stale-canvas.png retains that readback. mountain-844-before.png is the browser view before loss; Chromium can retain the same composite while lost.

All images are actual Chromium output. No generated imagery is used.
