"""Real animation and input acceptance using Python Playwright and Chromium."""
import json
import hashlib
import os
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('DRIVE_VERIFY_DIR', ROOT / 'verification/latest')) / 'python-e2e'
URL = os.environ.get('DRIVE_URL', (ROOT / 'dist/index.html').as_uri())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    checks, errors = [], []
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']}
        if os.environ.get('DRIVE_CHROMIUM_PATH'):
            options['executable_path'] = os.environ['DRIVE_CHROMIUM_PATH']
        browser = p.chromium.launch(**options)
        try:
            for map_id in ['circuit', 'mountain', 'proving', 'city', 'offroad']:
                for width, height in [(844, 390), (390, 844)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True)
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    page.goto(URL.split('?')[0] + '?map=' + map_id)
                    if URL.startswith(('http://', 'https://')):
                        for asset in [p.name for p in (ROOT / 'dist').iterdir() if p.is_file()]:
                            local = ROOT / 'dist' / asset
                            if not local.exists():
                                continue
                            response = page.request.get(urljoin(URL, asset))
                            assert response.ok, f'Cannot fetch deployed {asset}'
                            assert hashlib.sha256(response.body()).digest() == hashlib.sha256(local.read_bytes()).digest(), f'Deployed {asset} differs from this checkout'
                    assert page.evaluate('gameSnapshot().state') == 'ready'
                    page.locator('#start').click()
                    page.keyboard.down('w')
                    page.wait_for_function('gameSnapshot().speed > 100')
                    page.keyboard.up('w')
                    if map_id == 'mountain':
                        assert page.evaluate('gameSnapshot().elevation') > 0
                    page.locator('#pause').click()
                    frozen = page.evaluate('gameSnapshot()')
                    assert frozen['state'] == 'paused'
                    page.wait_for_timeout(200)
                    assert page.evaluate('gameSnapshot()') == frozen
                    checks.append(f'{map_id} {width}x{height}: real animation accelerates; pause freezes full snapshot')
                    page.screenshot(path=str(OUT / f'{map_id}-{width}-paused.png'))
                    page.locator('#start').click()
                    for view in ['first', 'chase', 'top']:
                        page.locator('#reset').click()
                        page.locator(f'[data-view={view}]').click()
                        page.wait_for_function('(view) => gameSnapshot().view === view', arg=view)
                        # At rest at the start line; capture only after an actual animation frame.
                        page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                        page.screenshot(path=str(OUT / f'{map_id}-{width}-{view}.png'))
                        assert page.evaluate('gameSnapshot().view') == view
                    page.keyboard.down('w')
                    page.keyboard.down('ArrowUp')
                    page.keyboard.up('w')
                    assert page.evaluate('gameSnapshot().input.gas') is True
                    page.keyboard.up('ArrowUp')
                    assert page.evaluate('gameSnapshot().input.gas') is False
                    checks.append(f'{map_id} {width}x{height}: three cameras and independent keyboard releases')
                    page.locator('#reset').click()
                    page.locator('[data-view=chase]').click()
                    page.reload()
                    assert page.evaluate('gameSnapshot().view') == 'chase'
                    checks.append(f'{map_id} {width}x{height}: camera persists after reload')
                    context.close()
            assert not errors, errors
            result = {'passed': True, 'source': URL, 'browser': browser.version,
                      'animation': 'normal requestAnimationFrame; no clock stubs',
                      'checks': checks, 'consoleErrors': errors, 'physicalPhone': False}
            (OUT / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
            print(f'PASS: Python Playwright real-animation E2E, {len(checks)} checks, 40 screenshots')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
