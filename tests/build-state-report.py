import base64
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
evidence = root / 'verification/state-machines'
result = json.loads((evidence / 'results.json').read_text())
if any(not row['passed'] for row in result['cases'] + result['checks']):
    raise SystemExit('Verification failed; do not generate a passing report.')
out = root / 'verification'
font_path = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font = ImageFont.truetype(font_path, 19) if Path(font_path).exists() else ImageFont.load_default()
views = {'first': '第一视角', 'chase': '车后追尾', 'top': '俯视'}
groups = {'race': '比赛流程', 'motion': '车辆运动', 'input': '驾驶输入', 'surface': '路面区域', 'collision': '碰撞反馈', 'recovery': '掉落与恢复'}


def uri(path):
    mime = 'image/png' if path.suffix == '.png' else 'image/jpeg'
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()


for orientation in ['landscape', 'portrait']:
    for view in views:
        rows = [r for r in result['cases'] if r['viewport'] == orientation and r['view'] == view and not r['id'].startswith(('input-mask', 'keyboard-alias', 'multi-touch'))]
        tw, th = (420, 195) if orientation == 'landscape' else (195, 422)
        sheet = Image.new('RGB', (4 * tw, ((len(rows) + 3) // 4) * (th + 38)), '#f3f4ef')
        draw = ImageDraw.Draw(sheet)
        for i, row in enumerate(rows):
            x, y = i % 4 * tw, i // 4 * (th + 38)
            picture = Image.open(evidence / row['screenshot']).convert('RGB')
            picture.thumbnail((tw, th))
            sheet.paste(picture, (x, y + 38))
            draw.text((x + 5, y + 6), row['title'], fill='#17251e', font=font)
        sheet.save(out / f'contact-{orientation}-{view}.jpg', quality=90)

before = out / 'chase-before.png'
after = out / 'chase-after.png'
comparison = Image.new('RGB', (1364, 510), '#f4f5ef')
draw = ImageDraw.Draw(comparison)
for x, label, filename in [(0, '修复前：道路条纹穿过车身', before), (682, '修复后：车身完整，路面在车身下方', after)]:
    picture = Image.open(filename).convert('RGB')
    picture.thumbnail((682, 468))
    comparison.paste(picture, (x, 42))
    draw.text((x + 15, 10), label, fill='#17251e', font=font)
comparison.save(out / 'chase-before-after.jpg', quality=93)

states = [
 ('比赛流程', 'ready → running ⇄ paused；running → finished；重开 → running', '开始、暂停、继续、失焦、切后台、三圈结束、重开'),
 ('驾驶输入', '4 个动作，16 种按下组合；每个物理来源独立释放', '键盘别名、键盘与触点混用、双指同踏板、取消触点、暂停清空'),
 ('车辆运动', '静止、加速、滑行、刹车、倒车、倒车转前进、正反向转弯', '油门、刹车和左右转向；左右同时按下抵消'),
 ('路面区域', 'road → curb → runoff → edge → fall；可返回安全路面', '最近中心线距离；外侧才有 edge 与 fall'),
 ('碰撞反馈', '无接触 → 分离／反弹 → 撞击反馈 → 冷却 → 清除', '低速只分离；速度大于20且冷却结束时才触发撞击反馈'),
 ('掉落与恢复', '掉落初期 → 渐暗 → 自动恢复；也可暂停或手动恢复', '超过外侧210单位；掉落超过1.5秒自动 +5秒；手动 +3秒'),
 ('视角', 'first ⇄ chase ⇄ top；与比赛和车辆状态正交', '顶部按钮或 V；切换时保留位置、速度、圈数、计时和危险状态'),
 ('反馈显示', 'fall 优先于 impact，impact 优先于路面状态', '路面提示、黄框、尘土、撞击红色、掉落渐暗、恢复 toast'),
 ('本地保存', '无记录 → 首次成绩 → 更快成绩更新；更慢成绩保留', '保存最佳用时与视角；重载恢复；无效视角回退 first'),
]
table = ''.join('<tr><th>' + html.escape(a) + '</th><td>' + html.escape(b) + '</td><td>' + html.escape(c) + '</td><td class="pass">通过</td></tr>' for a, b, c in states)
cards = []
for r in result['cases']:
    s = r['snapshot']
    caption = f"{views[r['view']]} · {'横屏' if r['viewport'] == 'landscape' else '竖屏'} · {s['state']} · {s['hazard']['kind']} · {abs(s['speed']) * .36:.0f} km/h"
    cards.append(f'<article class="card" data-group="{r["group"]}" data-view="{r["view"]}" data-size="{r["viewport"]}"><button class="zoom" aria-label="放大{html.escape(r["title"])}"><img loading="lazy" src="{uri(evidence / r["screenshot"])}" alt="{html.escape(r["title"])}"></button><h3>{html.escape(r["title"])} <span class="pass">PASS</span></h3><p>{html.escape(caption)}</p><details><summary>查看状态数值</summary><pre>{html.escape(json.dumps(s, ensure_ascii=False, indent=2))}</pre></details></article>')
checks = ''.join('<li><span class="pass">PASS</span> ' + html.escape(c['id']) + '</li>' for c in result['checks'])
options = ''.join(f'<option value="{key}">{name}</option>' for key, name in groups.items())
document = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰盒车场 · 状态机截图验收</title><style>
*{box-sizing:border-box}body{margin:0;background:#eff1eb;color:#203329;font-family:system-ui,"Noto Sans CJK SC",sans-serif;line-height:1.65}main{max-width:1280px;margin:auto;padding:32px 20px}h1{font-size:clamp(28px,5vw,48px);line-height:1.2}h2{margin-top:40px;font-size:23px}a{color:#235f44}p{max-width:900px}.summary{display:flex;flex-wrap:wrap;gap:12px}.summary div{background:#20372b;color:white;border-radius:12px;padding:16px 22px}.summary strong{font-size:30px;display:block;color:#d2fa60}.note{border-left:4px solid #9f7c30;background:#fff8de;padding:14px 18px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px}.compare img{width:100%;border-radius:10px}.pass{color:#227341;font-weight:700}table{width:100%;border-collapse:collapse;background:#fff}td,th{border:1px solid #d4dcd2;padding:12px;text-align:left;vertical-align:top}th{white-space:nowrap}thead{background:#dbe4d4}.table-wrap{overflow:auto}.filters{display:flex;flex-wrap:wrap;gap:10px;position:sticky;top:0;background:#eff1ebf2;padding:12px 0;z-index:2}select{padding:10px;border:1px solid #a2b59e;border-radius:8px;background:white;font-size:15px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px}.card{background:white;border:1px solid #d6ded3;border-radius:12px;overflow:hidden}.card img{width:100%;display:block;max-height:460px;object-fit:contain;background:#17251e}.card h3,.card p,.card details{margin:10px 14px}.card h3{font-size:16px;display:flex;justify-content:space-between;gap:8px}.card p{font-size:12px;color:#55695a}.zoom{display:block;border:0;padding:0;width:100%;cursor:zoom-in;background:transparent}pre{font-size:11px;overflow:auto;max-height:280px}dialog{max-width:98vw;max-height:98vh;border:0;border-radius:10px;padding:12px;background:#203329;color:white}dialog img{max-width:94vw;max-height:85vh;object-fit:contain}dialog button{float:right;padding:8px 16px}dialog::backdrop{background:#000c}.muted{color:#647768}li{margin:8px 0}[hidden]{display:none!important}@media(max-width:600px){main{padding:24px 12px}.compare{grid-template-columns:1fr}.gallery{grid-template-columns:1fr}td,th{font-size:13px;padding:8px}.summary div{flex:1;padding:10px}.summary strong{font-size:25px}}
</style><main><p class="muted">GRAYBOX DRIVE · 2026-11-09</p><h1>每个状态，留一张证据。</h1><p>已检查车辆状态和状态转换。修复了道路穿过车身、多来源油门相互覆盖、追尾视角掉落时车身移出画面，以及恢复或重开后状态提示延迟四项问题。</p><div class="summary"><div><strong>9</strong>组状态</div><div><strong>COUNT</strong>张场景截图</div><div><strong>CHECKS</strong>项转换与像素检查</div><div><strong>0</strong>未通过</div></div><p class="note">截图由真实 Chromium 绘制。为逐项覆盖，测试会设置场景起点、圈数和时间，再执行游戏的真实逻辑与绘制。键盘、鼠标和多点触控另有事件测试。本报告是浏览器模拟验收；未使用 Android 或 iPhone 真机。</p><h2>你指出的车身重叠问题</h2><div class="compare"><div><h3>修复前</h3><img src="BEFORE" alt="修复前车身被起终点条纹切穿"></div><div><h3>修复后</h3><img src="AFTER" alt="修复后车身完整显示在路面上方"></div></div><p>原来使用一个面的平均深度决定绘制先后，路面大面会覆盖车身。现在先画地面，再按深度画立体物体。座舱从车身顶部开始。建筑仍能正确挡住车辆。车尾甲板已在赛道240个位置逐一取像素验证。</p><h2>完整状态清单</h2><p>比赛流程和视角使用显式状态值。运动、路面、反馈等状态由输入、速度与危险计时器共同派生。它们可以同时存在。</p><div class="table-wrap"><table><thead><tr><th>状态组</th><th>状态与转换</th><th>已验证触发条件</th><th>结果</th></tr></thead><tbody>TABLE</tbody></table></div><h2>全部截图</h2><p>32种代表场景 × 3种视角 × 横屏和竖屏，共192张。另有16种按键组合及2张输入事件证据。点图片可放大。</p><div class="filters"><select id="group"><option value="all">全部状态</option>OPTIONS</select><select id="view"><option value="all">全部视角</option><option value="first">第一视角</option><option value="chase">车后追尾</option><option value="top">俯视</option></select><select id="size"><option value="all">横屏和竖屏</option><option value="landscape">横屏 844 × 390</option><option value="portrait">竖屏 390 × 844</option></select><span id="count"></span></div><div class="gallery">CARDS</div><h2>独立转换与像素检查</h2><ul>CHECKLIST</ul><p class="muted">静态截图验证显示结果。计时冻结、处罚次数、冷却、输入释放、状态保存和瞬态反馈还需要上述逻辑与事件检查，不能只凭截图判断。</p></main><dialog id="lightbox"><button id="close">关闭</button><div><img alt="放大的游戏截图"></div></dialog><script>
const cards=[...document.querySelectorAll('.card')],filters=['group','view','size'];function apply(){let count=0;for(const card of cards){card.hidden=filters.some(id=>document.getElementById(id).value!=='all'&&card.dataset[id]!==document.getElementById(id).value);if(!card.hidden)count++}document.getElementById('count').textContent=count+' 张'}for(const id of filters)document.getElementById(id).onchange=apply;const box=document.getElementById('lightbox');for(const button of document.querySelectorAll('.zoom'))button.onclick=()=>{box.querySelector('img').src=button.querySelector('img').src;box.showModal()};document.getElementById('close').onclick=()=>box.close();box.onclick=e=>{if(e.target===box)box.close()};apply();
</script></html>'''
document = document.replace('COUNT', str(len(result['cases']))).replace('CHECKS', str(len(result['checks']))).replace('BEFORE', uri(before)).replace('AFTER', uri(after)).replace('TABLE', table).replace('OPTIONS', options).replace('CARDS', ''.join(cards)).replace('CHECKLIST', checks)
(out / 'driving-state-machine-report.html').write_text(document)
print(json.dumps({'screenshots': len(result['cases']), 'checks': len(result['checks']), 'html_bytes': len(document.encode())}))
