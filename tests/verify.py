"""Project /verify: fail closed and retain each command's real output."""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = Path(os.environ.get('DRIVE_VERIFY_DIR', ROOT / 'verification/latest')).resolve()
OUT = OUT_ROOT / datetime.now(timezone.utc).strftime('run-%Y%m%dT%H%M%S%fZ')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = list((ROOT / 'dist').glob('*')) + list((ROOT / 'specs').glob('*')) + list((ROOT / 'tests').glob('*'))
    files += [ROOT / '.agents/skills/verify/SKILL.md', ROOT / '.github/workflows/pages.yml',
              ROOT / 'package.json', ROOT / 'package-lock.json']
    summary = {'createdAt': datetime.now(timezone.utc).isoformat(), 'passed': False, 'steps': [],
               'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
               'worktreeDirty': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
               'sourceSha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in sorted(files) if p.is_file()},
               'target': os.environ.get('DRIVE_URL', (ROOT / 'dist/index.html').as_uri()), 'evidence': str(OUT)}
    env = dict(os.environ, DRIVE_CAPTURE='1', DRIVE_VERIFY_DIR=str(OUT),
               DRIVE_EVIDENCE_DIR=str(OUT / 'browser-states'),
               DRIVE_MOUNTAIN_EVIDENCE=str(OUT / 'mountain'),
               DRIVE_MOUNTAIN_URL=os.environ.get('DRIVE_MOUNTAIN_URL', summary['target'].split('?')[0] + '?map=mountain'))
    commands = [['node', '--check', 'dist/maps.js'], ['node', '--check', 'dist/game.js'], ['node', '--check', 'dist/perspective.js'],
                ['node', 'tests/drive.cjs'], ['node', 'tests/mountain.cjs'], ['node', 'tests/state-contract.cjs'],
                [sys.executable, 'tests/verify_tla.py'], ['node', 'tests/browser-states.cjs'], ['node', 'tests/browser-mountain.cjs'],
                [sys.executable, 'tests/browser_e2e.py']]
    try:
        for index, command in enumerate(commands):
            print('RUN', ' '.join(command), flush=True)
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=300)
            text = result.stdout + result.stderr
            (OUT / f'{index+1:02d}.log').write_text(text)
            print(text, end='', flush=True)
            summary['steps'].append({'command': command, 'exitCode': result.returncode})
            if result.returncode:
                raise RuntimeError('Verification failed: ' + ' '.join(command))
        matrix = json.loads((OUT / 'browser-states/results.json').read_text())
        assert len(matrix['cases']) >= 210
        for row in matrix['cases']:
            assert row['passed'] and row['screenshot'] and (OUT / 'browser-states' / row['screenshot']).is_file()
        assert all(row['passed'] for row in matrix['checks'])
        mountain = json.loads((OUT / 'mountain/results.json').read_text())
        assert len(mountain['pictures']) == 42 and all(row['passed'] for row in mountain['checks'])
        assert all(row['file'] and (OUT / 'mountain' / row['file']).is_file() for row in mountain['pictures'])
        assert (OUT / 'mountain/canvas-fallback.jpg').is_file()
        assert len(list((OUT / 'python-e2e').glob('*.png'))) == 16
        summary['screenshots'] = len(matrix['cases']) + len(mountain['pictures']) + 1 + 16
        summary['mountainChecks'] = len(mountain['checks'])
        summary['matrixChecks'] = len(matrix['checks'])
        summary['passed'] = True
    except Exception as error:
        summary['error'] = str(error)
        print('FAIL', error, file=sys.stderr)
    finally:
        (OUT / 'results.json').write_text(json.dumps(summary, indent=2) + '\n')
        (OUT_ROOT / 'results.json').write_text(json.dumps(summary, indent=2) + '\n')
    print('VERIFY PASS' if summary['passed'] else 'VERIFY FAIL', flush=True)
    if not summary['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
