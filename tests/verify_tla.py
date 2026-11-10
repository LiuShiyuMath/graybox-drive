"""Run exhaustive TLC models and require known regressions to fail."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
JAR = ROOT / '.cache/tools/tla2tools.jar'
VERSION = '1.7.4'
SHA256 = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88'
OUT = Path(os.environ.get('DRIVE_VERIFY_DIR', ROOT / 'verification/latest')) / 'tla'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    JAR.parent.mkdir(parents=True, exist_ok=True)
    if not JAR.exists():
        subprocess.run(['curl', '--fail', '--location', '--max-time', '120',
                        f'https://github.com/tlaplus/tlaplus/releases/download/v{VERSION}/tla2tools.jar',
                        '-o', str(JAR)], check=True)
    if hashlib.sha256(JAR.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError('TLC jar checksum mismatch; do not execute it')
    rows = []
    cases = [(name, None, None) for name in ['Race', 'Input', 'Hazards', 'Persistence', 'Mountain', 'Courses', 'Rendering', 'VehicleWorld', 'Competitors', 'CompetitorsRace', 'CameraFeedback', 'Presentation']]
    cases += [('Mountain', ('BuggyFinish = FALSE', 'BuggyFinish = TRUE'), 'SummitRequiresCheckpoints'),
              ('Courses', ('BuggyFinish = FALSE', 'BuggyFinish = TRUE'), 'FinishedHasCheckpoints'),
              ('Courses', ('BuggyCheckpoint = FALSE', 'BuggyCheckpoint = TRUE'), 'EveryLapRequiresCheckpoints'),
              ('Input', ('BuggyRelease = FALSE', 'BuggyRelease = TRUE'), 'ActiveMatchesHeld'),
              ('Hazards', ('AutoPenalty = 5', 'AutoPenalty = 10'), 'ExactRecoveryPenalty'),
              ('Race', ('BuggyReverse = FALSE', 'BuggyReverse = TRUE'), 'ReverseCannotAddLap'),
              ('Hazards', ('BuggyCooldown = FALSE', 'BuggyCooldown = TRUE'), 'CooldownSuppressesFeedback'),
              ('Rendering', ('BuggyLoss = FALSE', 'BuggyLoss = TRUE'), 'NoStaleFrame'),
              ('Rendering', ('BuggyRestore = FALSE', 'BuggyRestore = TRUE'), 'NoStaleFrame'),
              ('Rendering', ('BuggyMesh = FALSE', 'BuggyMesh = TRUE'), 'CurrentMeshPresented'),
              ('Rendering', ('BuggyBoot = FALSE', 'BuggyBoot = TRUE'), 'DependenciesBeforeDrawing'),
              ('Rendering', ('BuggyCamera = FALSE', 'BuggyCamera = TRUE'), 'NearCameraKeepsCar'),
              ('VehicleWorld', ('BuggyRecovery = FALSE', 'BuggyRecovery = TRUE'), 'RecoveryClearsFlightAndSlip'),
              ('VehicleWorld', ('BuggyCrossing = FALSE', 'BuggyCrossing = TRUE'), 'CrossingRequiresNegativeSide'),
              ('VehicleWorld', ('BuggyFeedback = FALSE', 'BuggyFeedback = TRUE'), 'FallDominatesImpact'),
              ('VehicleWorld', ('BuggyToast = FALSE', 'BuggyToast = TRUE'), 'NewToastOwnsTimeout'),
              ('VehicleWorld', ('BuggyCollection = FALSE', 'BuggyCollection = TRUE'), 'CollectionNeverShrinks'),
              ('Competitors', ('BuggyPause = FALSE', 'BuggyPause = TRUE'), 'PausedCompetitorsFrozen'),
              ('Competitors', ('BuggyRecovery = FALSE', 'BuggyRecovery = TRUE'), 'RecoveryCannotAdvanceProgress'),
              ('Competitors', ('BuggyYield = FALSE', 'BuggyYield = TRUE'), 'AllyYieldsToPlayer'),
              ('Competitors', ('BuggyContact = FALSE', 'BuggyContact = TRUE'), 'CooldownSuppressesContact'),
              ('CompetitorsRace', ('BuggyFinish = FALSE', 'BuggyFinish = TRUE'), 'FinishRequiresCheckpoints'),
              ('CompetitorsRace', ('BuggyReset = FALSE', 'BuggyReset = TRUE'), 'ResetClearsResults'),
              ('CompetitorsRace', ('BuggyRank = FALSE', 'BuggyRank = TRUE'), 'EveryRankUnique'),
              ('CameraFeedback', ('BuggyJump = FALSE', 'BuggyJump = TRUE'), 'CameraFollowsSupport'),
              ('CameraFeedback', ('BuggyShake = FALSE', 'BuggyShake = TRUE'), 'WorldRemainsStable'),
              ('CameraFeedback', ('BuggyBody = FALSE', 'BuggyBody = TRUE'), 'BodyPresentsFeedback'),
              ('Presentation', ('BuggyToggle = FALSE', 'BuggyToggle = TRUE'), 'TogglePreservesScore'),
              ('Presentation', ('BuggyAudio = FALSE', 'BuggyAudio = TRUE'), 'QuietOutsideRace'),
              ('Presentation', ('BuggyBound = FALSE', 'BuggyBound = TRUE'), 'BoundedParticles'),
              ('Presentation', ('BuggyTrail = FALSE', 'BuggyTrail = TRUE'), 'BoundedTrails')]
    for name, mutation, expected in cases:
        label = name if not mutation else name + '-regression-' + expected
        if mutation and name == 'Rendering':
            label += '-' + mutation[0].split()[0]
        with tempfile.TemporaryDirectory(prefix='graybox-tlc-') as temp:
            config = Path(temp) / (name + '.cfg')
            text = (ROOT / 'specs' / (name + '.cfg')).read_text()
            if mutation:
                assert text.count(mutation[0]) == 1
                text = text.replace(*mutation)
            config.write_text(text)
            cmd = ['java', '-XX:+UseParallelGC', '-Xmx1g', '-cp', str(JAR),
                   'tlc2.TLC', '-workers', '1', '-seed', '1', '-fp', '0',
                   '-metadir', str(Path(temp) / 'states'), '-config', str(config), name + '.tla']
            result = subprocess.run(cmd, cwd=ROOT / 'specs', text=True, capture_output=True, timeout=180)
            log = result.stdout + result.stderr
            (OUT / (label + '.log')).write_text(log)
            if expected:
                passed = result.returncode != 0 and (f'Invariant {expected} is violated' in log or
                         f'Action property {expected} is violated' in log)
            else:
                passed = result.returncode == 0 and 'Model checking completed. No error has been found.' in log
            counts = re.search(r'([\d,]+) states generated, ([\d,]+) distinct states found', log)
            rows.append({'model': label, 'passed': passed, 'expectedViolation': expected,
                         'exitCode': result.returncode,
                         'generated': int(counts[1].replace(',', '')) if counts else None,
                         'distinct': int(counts[2].replace(',', '')) if counts else None})
            print(('PASS ' if passed else 'FAIL ') + label, flush=True)
            if not passed:
                print(log[-6000:], flush=True)
    summary = {'createdAt': datetime.now(timezone.utc).isoformat(), 'tlcVersion': VERSION,
               'jarSha256': SHA256, 'mode': 'exhaustive BFS, no state constraints, one worker',
               'passed': all(row['passed'] for row in rows), 'models': rows}
    (OUT / 'results.json').write_text(json.dumps(summary, indent=2) + '\n')
    if not summary['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
