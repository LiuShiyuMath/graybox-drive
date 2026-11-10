"""Project /verify: fail closed and retain each command's real output."""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

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
    mountain_url = urlsplit(os.environ.get('DRIVE_URL', (ROOT / 'dist/index.html').as_uri()))
    query = dict(parse_qsl(mountain_url.query), map='mountain')
    mountain_url = urlunsplit(mountain_url._replace(query=urlencode(query)))
    env = dict(os.environ, DRIVE_MOUNTAIN_URL=mountain_url, DRIVE_MOUNTAIN_EVIDENCE=str(OUT / 'mountain'),
               DRIVE_CAPTURE='1', DRIVE_VERIFY_DIR=str(OUT),
               DRIVE_EVIDENCE_DIR=str(OUT / 'browser-states'))
    commands = [['node', '--check', 'dist/' + p] for p in ['maps.js', 'course-pack.js', 'course-world.js', 'racers.js', 'game.js', 'perspective.js']] + [
                ['node', 'tests/drive.cjs'], ['node', 'tests/mountain.cjs'],
                ['node', 'tests/course-pack.cjs'], ['node', 'tests/courses.cjs'], ['node', 'tests/state-contract.cjs'],
                ['node', 'tests/hidden-state-contract.cjs'], ['node', 'tests/racers.cjs'],
                [sys.executable, 'tests/verify_tla.py'], ['node', 'tests/browser-states.cjs'],
                ['node', 'tests/browser-mountain.cjs'], ['node', 'tests/browser-courses.cjs'], ['node', 'tests/browser-effects.cjs'],
                ['node', 'tests/browser-flicker.cjs'], ['node', 'tests/browser-camera.cjs'],
                [sys.executable, 'tests/browser_e2e.py'], ['node', 'tests/browser-racers.cjs']]
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
        assert len(list((OUT / 'python-e2e').glob('*.png'))) == 40
        courses = json.loads((OUT / 'courses/results.json').read_text())
        assert courses['passed'] and len(courses['screenshots']) >= 52
        mountain = json.loads((OUT / 'mountain/results.json').read_text())
        assert len(mountain['pictures']) == 42 and all(row['passed'] for row in mountain['checks'])
        assert all(row['file'] and (OUT / 'mountain' / row['file']).is_file() for row in mountain['pictures'])
        assert (OUT / 'mountain/canvas-fallback.jpg').is_file()
        summary['mountainChecks'] = len(mountain['checks'])
        summary['screenshots'] = len(matrix['cases']) + 40 + len(courses['screenshots']) + len(list((OUT / 'mountain').glob('*.jpg')))
        effects = json.loads((OUT / 'effects/results.json').read_text())
        assert effects['passed'] and len(effects['videos']) == 6
        assert all((OUT / 'effects' / name).is_file() for name in effects['videos'])
        summary['videos'] = len(effects['videos'])
        summary['screenshots'] += len(effects['pictures'])
        summary['vehicleRegions'] = sum(row.get('vehicleRegions', 0) for row in effects['checks'])
        flicker = json.loads((OUT / 'flicker/results.json').read_text())
        assert flicker['passed'] and flicker['temporalFrames'] == 540
        assert len(flicker['checks']) == 27
        assert all((OUT / 'flicker' / name).is_file() for name in flicker['pictures'])
        summary['temporalFrames'] = flicker['temporalFrames']
        summary['flickerChecks'] = len(flicker['checks'])
        summary['screenshots'] += len(flicker['pictures'])
        camera = json.loads((OUT / 'camera/results.json').read_text())
        assert camera['passed'] and camera['fixtureFrames'] == 450 and len(camera['checks']) == 6
        assert all((OUT / 'camera' / name).is_file() for name in camera['pictures'])
        summary['cameraFrames'] = camera['fixtureFrames']
        summary['screenshots'] += len(camera['pictures'])
        summary['courseChecks'] = len(courses['checks'])
        summary['matrixChecks'] = len(matrix['checks'])
        racers = json.loads((OUT / 'racers-browser/results.json').read_text())
        assert racers['passed'] and racers['normalAnimation']
        assert racers['checks'] and all(row['passed'] for row in racers['checks'])
        assert racers['screenshots'] and racers['videos']
        assert all((OUT / 'racers-browser' / name).is_file()
                   for name in racers['screenshots'] + racers['videos'])
        summary['racerChecks'] = len(racers['checks'])
        summary['screenshots'] += len(racers['screenshots'])
        summary['videos'] += len(racers['videos'])
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
