#!/usr/bin/env bash
# Every step of .github/workflows/ci.yml, run locally before a push.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "workflow yaml ok"
(cd chain && cargo test -q -p siroclimb --lib 2>&1 | grep "test result")
for f in js/*.js js/chain/*.js api/*.js ops/*.mjs ops/lib/*.mjs ops/test/*.mjs; do node --check "$f"; done && echo "syntax ok"
# the inline scripts of the workflow, extracted and run as CI runs them
python3 - <<'PY' > /tmp/siroclimb-ci-steps.sh
import yaml
wf = yaml.safe_load(open('.github/workflows/ci.yml'))
for step in wf['jobs']['client']['steps']:
    run = step.get('run', '')
    if run.startswith('node --no-deprecation -e') or run.startswith('node -e'):
        print(run.strip())
PY
bash /tmp/siroclimb-ci-steps.sh
echo "local CI passed"
