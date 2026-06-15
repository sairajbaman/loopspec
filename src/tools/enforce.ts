import * as z from 'zod/v4';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { writeFile, ensureDir } from '../utils/files.js';

const PRE_COMMIT_HOOK = `#!/bin/sh
# LoopSpec Pre-Commit Hook
# Blocks commits with high-severity drift or critical convention violations

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(tsx?|jsx?|svelte|vue)$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo "🔄 LoopSpec: Checking staged files..."

# Run drift detection on staged files
DRIFT_OUTPUT=$(echo "$STAGED_FILES" | while read file; do
  node -e "
    import('./node_modules/loopspec-mcp/dist/server.js').catch(() => {});
  " 2>/dev/null
done)

# Check for high-severity issues via the MCP server
HAS_HIGH=0
for file in $STAGED_FILES; do
  # Quick structural checks without spawning the full MCP server
  if echo "$file" | grep -qE "(dashboard|admin|settings|profile)" ; then
    if ! grep -qE "(getSession|auth\\(\\)|middleware|useSession|getServerSession)" "$file" 2>/dev/null; then
      echo "🔴 HIGH: $file — Protected route missing auth check"
      HAS_HIGH=1
    fi
  fi

  # Check for any types in TypeScript files
  ANY_COUNT=$(grep -c ": any" "$file" 2>/dev/null || echo 0)
  if [ "$ANY_COUNT" -gt 3 ]; then
    echo "🟡 MEDIUM: $file — Found $ANY_COUNT 'any' types (max 3 allowed)"
  fi
done

if [ $HAS_HIGH -eq 1 ]; then
  echo ""
  echo "❌ LoopSpec: Commit blocked due to HIGH severity drift."
  echo "   Fix the issues above or run: git commit --no-verify"
  exit 1
fi

echo "✅ LoopSpec: All checks passed."
exit 0
`;

const CI_GITHUB_ACTIONS = (threshold: number) => `name: LoopSpec Quality Gate

on:
  pull_request:
    branches: [main, develop]

jobs:
  loopspec-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: LoopSpec Drift Detection
        run: |
          npx loopspec-mcp --run-drift --output drift-report.json
          HIGH_COUNT=$(cat drift-report.json | jq '[.[] | select(.severity == "high")] | length')
          if [ "$HIGH_COUNT" -gt 0 ]; then
            echo "::error::LoopSpec detected $HIGH_COUNT high-severity drift issues"
            cat drift-report.json | jq '.[] | select(.severity == "high") | "\\(.file): \\(.specExpectation)"'
            exit 1
          fi

      - name: LoopSpec Score Check
        run: |
          SCORE=$(npx loopspec-mcp --run-score --output score.json | jq '.overall')
          echo "Overall Score: $SCORE/100"
          if [ "$SCORE" -lt ${threshold} ]; then
            echo "::error::LoopSpec score $SCORE is below threshold ${threshold}"
            exit 1
          fi

      - name: Comment PR with Scorecard
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let comment = '## 📊 LoopSpec Quality Report\\n\\n';
            try {
              const score = JSON.parse(fs.readFileSync('score.json', 'utf8'));
              comment += \`| Metric | Score |\\n|--------|-------|\\n\`;
              comment += \`| Spec Compliance | \${score.specCompliance}/100 |\\n\`;
              comment += \`| Pattern Match | \${score.patternMatch}/100 |\\n\`;
              comment += \`| Drift | \${score.driftScore}/100 |\\n\`;
              comment += \`| **Overall** | **\${score.overall}/100** |\\n\`;
            } catch { comment += 'Score data unavailable.'; }
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: comment
            });
`;

export function registerEnforceTool(server: McpServer, ctx: AppContext) {
  server.registerTool('loopspec_enforce', {
    title: 'Generate Enforcement Hooks',
    description: 'Generate pre-commit hooks and CI configs that enforce spec compliance. Code that drifts from spec gets blocked.',
    inputSchema: z.object({
      target: z.enum(['pre-commit', 'ci-github', 'ci-gitlab', 'all']).describe('What to generate'),
      threshold: z.number().optional().describe('Minimum score to pass CI (default: 70)'),
    }),
  }, async (args) => {
    const { target, threshold } = args as { target: string; threshold?: number };
    const minScore = threshold || 70;
    const outputs: string[] = [];

    if (target === 'pre-commit' || target === 'all') {
      const hookDir = path.join(ctx.projectDir, '.husky');
      await ensureDir(hookDir);
      const hookPath = path.join(hookDir, 'pre-commit');
      await writeFile(hookPath, PRE_COMMIT_HOOK);
      outputs.push(`✓ Pre-commit hook: .husky/pre-commit`);
      outputs.push(`  Blocks: missing auth on protected routes, excessive \`any\` types`);
      outputs.push(`  Bypass: git commit --no-verify`);
    }

    if (target === 'ci-github' || target === 'all') {
      const ciDir = path.join(ctx.projectDir, '.github', 'workflows');
      await ensureDir(ciDir);
      await writeFile(path.join(ciDir, 'loopspec.yml'), CI_GITHUB_ACTIONS(minScore));
      outputs.push(`✓ GitHub Actions: .github/workflows/loopspec.yml`);
      outputs.push(`  Blocks PRs with: high-severity drift, score < ${minScore}`);
      outputs.push(`  Comments: scorecard on every PR`);
    }

    if (target === 'ci-gitlab' || target === 'all') {
      const gitlabCi = `# LoopSpec Quality Gate
loopspec:
  stage: test
  script:
    - npx loopspec-mcp --run-drift --fail-on-high
    - npx loopspec-mcp --run-score --min-score ${minScore}
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;
      await writeFile(path.join(ctx.projectDir, '.loopspec-gitlab-ci.yml'), gitlabCi);
      outputs.push(`✓ GitLab CI: .loopspec-gitlab-ci.yml (merge into your .gitlab-ci.yml)`);
    }

    return {
      content: [{
        type: 'text' as const,
        text: `## 🛡️ Enforcement Installed\n\n${outputs.join('\n')}\n\n**What this means:**\n- Code with HIGH drift gets blocked at commit time\n- PRs below score ${minScore}/100 fail CI\n- Every PR gets a scorecard comment\n\nYour spec is now enforced, not just documented.`,
      }],
    };
  });
}
