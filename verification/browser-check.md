# Browser verification 2026-11-09

Computer Use controlled Chrome at the local preview through real mouse and keyboard input. The production URL displayed the ChatGPT sign-in gate; no production sign-in or access-policy change was performed.

Base published commit: d200e14ceab8d8691cf0b67513db431969280a09.

Observed scenarios:
- First-person straight-line driving: road speed climbed above 100 km/h; leaving the road showed 驶出赛道 / 抓地力下降 and stopped the car when throttle was released.
- Continued throttle off the outside of the bend: 车辆掉落 rendered with the dark drop area; the car subsequently returned to the road at zero speed. A previous straight-line run showed 已回到赛道 · 用时 +5 秒.
- Throttle plus Right for approximately 3.2 seconds after restart: vehicle contacted an infield building. The first-person screenshot shows 发生撞击 and 车辆已反弹 · 松油调整方向. Top view also showed contact at the building and the impact toast.
- Curb status appeared during driving toward the infield.

Issues found and fixed during browser testing:
- Capping every rendered frame at 35 ms caused slow motion in the low-frame-rate browser. The loop now consumes elapsed time through stable 20 ms physics steps (maximum catch-up 1 second per frame).
- Brief impact feedback could disappear between rendered frames. The visible impact duration is now longer.
- Reduced perspective mesh sampling from 240 to 80 segments, retaining the full physics track.

Evidence: drive-offroad.png, drive-edge-or-fall.png, drive-recovery.png, drive-impact-final.png.

Limits: cloud desktop browser, not a physical Android phone. Yellow edge-warning flash and the full transient shake/fade sequences were not individually captured frame by frame. Timing, penalty count, collision separation and projection also passed node tests/drive.cjs. Production authentication remains unverified.


## Public GitHub Pages verification

Opened https://liushiyumath.github.io/graybox-drive/ in the cloud browser without signing in. The game loaded directly. Clicking Start and holding the throttle advanced the timer and reached 99 km/h. Screenshot: github-pages.png. This verifies the public hosting entry and playable runtime; physical Android/iPhone testing remains open in issue #2.
