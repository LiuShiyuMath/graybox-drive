# 灰盒车场 Graybox Drive

一个免费、免登录、无需安装的手机浏览器驾驶小游戏。所有游戏逻辑在浏览器本地运行，没有 API 或服务器费用。

## 免费游玩

[打开游戏](https://liushiyumath.github.io/graybox-drive/)

手机建议横屏。左手控制方向，右手控制油门和刹车。支持第一视角、车后追尾和俯视视角，可以在驾驶中切换。

| 操作 | 手机 | 电脑 |
| --- | --- | --- |
| 转向 | ◀ / ▶ | A / D 或方向键 |
| 加速 | 油门 | W 或 ↑ |
| 刹车和倒车 | 刹车 | S / ↓ / Space |
| 切换视角 | 顶部视角按钮 | V |
| 回到赛道 | 回赛道按钮 | R |
| 暂停 | 暂停按钮 | Escape |

## 规则

- 完成三圈计时挑战，最佳成绩保存在当前浏览器。
- 压路肩会颠簸；驶入缓冲区会起尘并减速。
- 撞到建筑或路边桩会反弹，并出现撞击反馈。
- 外侧黄黑边缘是落差区，掉落后自动回赛道，加时 5 秒。
- 手动回赛道加时 3 秒。

## 项目进度

[公开 GitHub Projects 看板](https://github.com/users/LiuShiyuMath/projects/1) · [问题与建议](https://github.com/LiuShiyuMath/graybox-drive/issues)

## 开发与验证

用任意静态服务器运行 dist，例如 `python3 -m http.server 8080 --directory dist`，然后打开 http://localhost:8080。

```sh
node --check dist/game.js
node --check dist/perspective.js
node tests/drive.cjs
```

main 每次更新会先运行验证，通过后自动发布 GitHub Pages。部署内容只有 dist。

[浏览器验收记录](verification/browser-check.md)包含真实鼠标和键盘驾驶截图。手机真机操作和不同浏览器的性能仍需持续验证。成绩和视角选择只存储在玩家自己的设备上，不会上传。

## 状态机与截图验收

[状态清单与转换规则](verification/state-machines.md)列出比赛、输入、运动、路面、碰撞、恢复、视角、反馈和本地保存九组状态。

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node tests/browser-states.cjs
```

浏览器测试生成210张横竖屏场景截图及29项转换和像素检查。测试设置场景起点，再运行真实游戏逻辑与 Canvas；键盘、指针和多点触控另有事件检查。它不等同于手机真机验收。CI 执行同一套检查，通过后才发布。

截图与数值保存在 `verification/state-machines/`。安装 Pillow 后，运行 `python3 tests/build-state-report.py` 可生成自带全部图片、可筛选与放大的 HTML 报告。
