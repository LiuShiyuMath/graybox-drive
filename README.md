# 灰盒车场 Graybox Drive

一个免费、免登录、无需安装的手机浏览器驾驶小游戏。所有游戏逻辑在浏览器本地运行，没有 API 或服务器费用。

## 免费游玩

[打开游戏](https://liushiyumath.github.io/graybox-drive/) · [直接玩 Mountain Road](https://liushiyumath.github.io/graybox-drive/?map=mountain)

手机建议横屏。左手控制方向，右手控制油门和刹车。支持第一视角、车后追尾和俯视视角，可以在驾驶中切换。

| 操作 | 手机 | 电脑 |
| --- | --- | --- |
| 转向 | ◀ / ▶ | A / D 或方向键 |
| 加速 | 油门 | W 或 ↑ |
| 刹车和倒车 | 刹车 | S / ↓ / Space |
| 切换视角 | 顶部视角按钮 | V |
| 回到赛道 | 回赛道按钮 | R |
| 暂停 | 暂停按钮 | Escape |

## 地图

| 地图 | 路线 | 挑战 |
| --- | --- | --- |
| Map 01 — Concrete Loop | 原有环形赛道，三圈计时 | 路肩、缓冲区、建筑碰撞和外侧掉落 |
| Map 02 — Mountain Road | 约 716 m 山脚至山顶，实际爬升 102 m | 连续 S 弯、坡道、左侧山壁、右侧悬崖及 5 个检查点 |

开始界面可选地图。驾驶中点左上角地图名称可暂停并换图。换图会开始新一局，两张地图分别保存最佳成绩。

Mountain Road 的坡度影响加速，镜头跟随实际高度。临崖有黄黑边缘和警告，掉落后回到最近已通过的检查点；左侧山壁会阻挡并反弹车辆。山路使用 WebGL 深度检测处理坡道、地形与车辆遮挡，不能使用 WebGL 时自动回退到 Canvas。

[Mountain Road 验收截图与规则](verification/mountain-road.md)

## 规则

- Map 01 完成三圈；Map 02 通过 5 个检查点后到达山顶。最佳成绩保存在当前浏览器。
- 压路肩会颠簸；驶入缓冲区会起尘并减速。
- 撞到建筑或路边桩会反弹，并出现撞击反馈。
- 外侧黄黑边缘是落差区，掉落后自动回赛道，加时 5 秒。
- 手动回赛道加时 3 秒。

## 项目进度

[ChatGPT 项目 Page](https://chatgpt.com/space/page_b7e95e0e62948191a47974d9feeddc87) · [开发任务与验收清单](docs/ROADMAP.md)

本项目只使用 `main` 分支直接提交。需求、任务和结论写在 ChatGPT Page 与项目文档；不再创建 GitHub PR 或 Issue。

## 开发与验证

用任意静态服务器运行 dist，例如 `python3 -m http.server 8080 --directory dist`，然后打开 http://localhost:8080。

```sh
node --check dist/maps.js
node --check dist/game.js
node --check dist/perspective.js
node tests/drive.cjs
node tests/mountain.cjs
```

main 每次更新会先运行验证，通过后自动发布 GitHub Pages。部署内容只有 dist。

[浏览器验收记录](verification/browser-check.md)包含真实鼠标和键盘驾驶截图。手机真机操作和不同浏览器的性能仍需持续验证。成绩和视角选择只存储在玩家自己的设备上，不会上传。

## 状态机与截图验收

[状态清单与转换规则](verification/state-machines.md)列出比赛、输入、运动、路面、碰撞、恢复、视角、反馈和本地保存九组状态。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements-verify.txt
npm ci
.venv/bin/python -m playwright install --only-shell chromium
.venv/bin/python tests/verify.py
```

浏览器测试生成210张横竖屏场景截图及30项转换和像素检查。测试设置场景起点，再运行真实游戏逻辑与 Canvas；键盘、指针和多点触控另有事件检查。它不等同于手机真机验收。CI 执行同一套检查，通过后才发布。

截图与数值保存在 `verification/state-machines/`。安装 Pillow 后，运行 `python3 tests/build-state-report.py` 可生成自带全部图片、可筛选与放大的 HTML 报告。

Mountain Road 另含 42 个横竖屏场景、全线 240 个车后视角像素检查、地图切换、键盘与多指触控检查。`node tests/mountain.cjs` 还用连续物理更新自动驾驶全程，验证可通过所有检查点并登顶。

## TLA+ 与项目 /verify

[项目 /verify](.agents/skills/verify/SKILL.md)是提交前及部署后的完整验证入口。Java 17+ 用于运行固定版本 TLC；模型工具首次运行时自动下载并核对 SHA-256。

[状态机和形式化边界](docs/STATE-MACHINES.md)将九组状态映射到五个 TLA+ 模型、真实 JavaScript 的 4,096 次输入转换检查、浏览器场景矩阵和 Python Playwright 正常动画验收。五种故障注入必须产生指定的反例，防止验证器只会报成功。

每次运行的源码版本、文件哈希、日志、TLC 状态数及截图都保存在 `verification/latest/` 的独立运行目录。GitHub Actions 先运行完整 `/verify`，通过后部署，再对正式站执行同一套验证并核对实际部署源码；两轮证据均作为 Actions artifact 保留。TLA+ 检查有限状态抽象，不代替碰撞几何、Canvas 画面和手机真机验收。

完整验证现已覆盖两张地图，运行 4,096 次输入来源转换、5 个 TLA+ 模型与 5 个指定反例，保留 269 张真实浏览器截图。山路的检查点状态、坡道物理和三视角均属于发布前及发布后的检查范围。
