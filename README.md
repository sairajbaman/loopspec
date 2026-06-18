# LoopSpec — The Compound Intelligence Engine for AI Development

> **One idea in. Production-ready AI brain out. Gets smarter every time you ship.**

[![CI](https://github.com/sairajbaman/loopspec/actions/workflows/ci.yml/badge.svg)](https://github.com/sairajbaman/loopspec/actions)
[![npm version](https://img.shields.io/npm/v/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## ❌ Without LoopSpec

- AI forgets conventions between sessions
- No drift detection — spec says X, code does Y
- No goal tracking — AI loses focus mid-task
- No quality gates — ships untested, un-validated code
- Repeats same mistakes every time

## ✅ With LoopSpec

- **Persistent memory** — learns from every session, never forgets
- **Real-time drift detection** — catches spec violations on every file save
- **Active goal tracking** — auto-decomposes tasks, verifies progress
- **Quality gates** — test enforcement, score tracking, guardrails
- **Graph-of-Thought** — knows what depends on what, shows impact
- **Model profiler** — detects your AI's blind spots, auto-compensates
- **Self-healing specs** — keeps spec in sync with reality

---

## Quick Start (30 seconds)

### One Command Setup

```bash
npx loopspec-mcp setup
```

Auto-detects Cursor, VS Code, Windsurf, Claude Code, Kiro, Gemini, Codebuff — configures all of them.

### Or One-Liner for Specific Tools

```bash
# Claude Code
claude mcp add loopspec -- npx -y loopspec-mcp

# Cursor — paste in .cursor/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Kiro — paste in .kiro/settings/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Windows (any tool) — use cmd wrapper
{"mcpServers":{"loopspec":{"command":"cmd","args":["/c","npx","-y","loopspec-mcp"]}}}
```

### Initialize a Project

Tell your AI: *"use loopspec"* or:

```
Use loopspec_init with idea: "I want to build an app where freelancers track invoices"
```

---

## How It Works

```
STATUS → SESSION → PREFLIGHT → CONTEXT → WORK → CHECKPOINT → COMPOUND → REPEAT
  ↑                                                                │
  └──────────── system gets smarter every cycle ───────────────────┘
```

Every session:
1. `loopspec_status` — AI learns how to use LoopSpec (self-bootstrapping)
2. `loopspec_session start` — creates goal checklist from spec
3. `loopspec_preflight` — injects constraints before coding
4. `loopspec_context` — routes only relevant spec sections (saves tokens)
5. AI writes code
6. `loopspec_checkpoint` — scores, checks tests, updates goals
7. `loopspec_compound` — extracts patterns for future sessions

---

## 41 Tools Reference

### Orientation
| Tool | Purpose |
|------|---------|
| `loopspec_status` | **Call first** — returns project state, goals, and behavioral guidance |

### Session & Goals
| Tool | Purpose |
|------|---------|
| `loopspec_session` | Start/end tracked sessions with progress restore |
| `loopspec_goal` | Create/check/update active goal checklists |
| `loopspec_checkpoint` | Score + test gate + goal progress (all-in-one) |
| `loopspec_decision` | Log decisions with rationale (persists across sessions) |

### Core Spec
| Tool | Purpose |
|------|---------|
| `loopspec_init` | Generate specs from idea |
| `loopspec_vibe` | Quick setup (auto-fills defaults) |
| `loopspec_context` | Route task-relevant context |
| `loopspec_plan` | Break into subtasks |
| `loopspec_design` | Design system generation |
| `loopspec_detect` | Auto-generate SKILL.md from existing repo |

### Quality & Guardrails
| Tool | Purpose |
|------|---------|
| `loopspec_preflight` | Inject constraints before work |
| `loopspec_guardrails_add` | Install rule packs |
| `loopspec_drift` | Check file for spec drift |
| `loopspec_watch` | Scan recent changes for drift |
| `loopspec_score` | Quality scorecard |
| `loopspec_verify` | Adversarial code review |

### Neural Intelligence
| Tool | Purpose |
|------|---------|
| `loopspec_graph` | Build dependency graph + impact analysis |
| `loopspec_profile` | View/update model blind-spot profile |
| `loopspec_autocomplete` | Get spec-derived code snippets |
| `loopspec_heal` | Accept or revert drift (self-healing specs) |
| `loopspec_contracts` | Verify frontend/backend API match |
| `loopspec_guidance` | Smart help when stuck (spec + playbook + common mistakes) |

### Learning & Memory
| Tool | Purpose |
|------|---------|
| `loopspec_compound` | Extract patterns from work |
| `loopspec_playbook` | Search past learnings |
| `loopspec_feedback` | Record quality signals |
| `loopspec_infer` | Predict best approach |

### Loop Engineering
| Tool | Purpose |
|------|---------|
| `loopspec_maker_prompt` | Optimized builder prompt |
| `loopspec_checker_prompt` | Adversarial reviewer |
| `loopspec_retry` | Smart retry with error context |
| `loopspec_escalate` | Flag for human review |
| `loopspec_decompose` | Split into parallel tasks |
| `loopspec_merge_review` | Reconcile parallel outputs |

### Extensibility
| Tool | Purpose |
|------|---------|
| `loopspec_plugin` | Install/remove/list plugins |
| `loopspec_sandbox` | Execute JS snippets in isolation |
| `loopspec_template` | Customize doc generation |

---

## CLI Mode

LoopSpec also works standalone from your terminal:

```bash
# Sessions
loopspec session start "add payments"   # → Auto-decomposes into 11 goals
loopspec session status                  # → Goals, score, files
loopspec session end                     # → Report with score delta

# Analysis
loopspec check src/app/page.tsx          # → Drift + guardrails + score
loopspec watch --continuous              # → Real-time file monitoring
loopspec watch --continuous --tui        # → Dashboard mode
loopspec review --pr main                # → Score all changed files

# Intelligence
loopspec graph build                     # → Map all dependencies
loopspec graph impact "src/types.ts"     # → "affects 12 files"
loopspec suggest "stripe webhook"        # → Common mistakes + spec context

# Tools
loopspec profile                         # → Blind spot visualization
loopspec plugin install drift-react      # → Add React-specific rules
loopspec connect --status                # → Show configured AI tools
```

---

## The Self-Bootstrapping Pattern

LoopSpec teaches your AI how to use it — no configuration needed:

1. AI calls `loopspec_status` (zero params)
2. Gets back: project state + workflow instructions + adaptive checklist
3. Automatically follows the preflight → context → checkpoint loop
4. Each session makes the next session better

The AI's response includes a persistence hint:
> *"Add to your CLAUDE.md: Always call loopspec_status first. Follow the LoopSpec workflow."*

Once persisted, the behavior survives across all future sessions.

---

## Graph-of-Thought

LoopSpec builds a live dependency graph of your project:

```
$ loopspec graph build
✓ Graph built: 339 nodes, 316 edges
  Files: 105 | Functions: 169 | Types: 55 | Components: 8 | Routes: 2

$ loopspec graph impact "src/context.ts"
src/context.ts affects 49 file(s):
  • src/engines/session/index.ts (references)
  • src/engines/graph/index.ts (references)
  • src/tools/session-tool.ts (references)
  ...
```

When you change a type, LoopSpec tells you what else needs updating.

---

## Model Profiler

Tracks what your AI forgets most:

```
$ loopspec profile

### Blind Spots
  █████░░░░░ 50% Loading states (5✓ 5✗)
  ██░░░░░░░░ 20% Accessibility (2✓ 8✗)
  ████████░░ 80% Error handling (8✓ 2✗)

### Adaptive Checklist (auto-injected into preflight)
  ⚠ ALWAYS include: Accessibility (you miss this 80% of the time)
  ⛔ STOP using: any types (10 occurrences recorded)
```

---

## Plugin System

```bash
loopspec plugin list
# Available: drift-react, drift-next, drift-vue, security-advanced, testing-enforce

loopspec plugin install drift-react
# ✓ Installed: 3 rules (no-index-key, useEffect-deps, no-nested-components)
```

---

## Architecture

```
loopspec/
├── src/
│   ├── server.ts              ← MCP server entry (41 tools)
│   ├── cli/                   ← CLI entry + 9 commands
│   ├── tools/                 ← MCP tool handlers
│   └── engines/               ← Core logic
│       ├── session/           ← Session lifecycle + restore
│       ├── goals/             ← Goal decomposition + verification
│       ├── graph/             ← Dependency graph + impact analysis
│       ├── profiler/          ← Blind spot tracking
│       ├── autocomplete/      ← Spec-derived code injection
│       ├── self-heal/         ← Drift accept/revert
│       ├── contracts/         ← API contract verification
│       ├── plugins/           ← Extensible rule system
│       ├── sandbox/           ← Isolated JS execution
│       ├── watcher/           ← chokidar file watcher
│       ├── test-gate/         ← Test enforcement
│       ├── decisions/         ← Decision log (SQLite + md)
│       ├── guidance/          ← Smart help (spec + mistakes DB)
│       ├── guardrails/        ← Rule packs + preventive mode
│       ├── live-sync/         ← Drift detection (7 categories)
│       ├── scorecard/         ← Quality scoring
│       ├── memory/            ← Bayesian learning
│       ├── context-router/    ← Task-relevant routing
│       ├── design-engine/     ← Design system matching
│       └── spec-engine/       ← Analyzer + generator + templates
├── server.json                ← Smithery registry
├── gemini-extension.json      ← Gemini CLI discovery
└── tests/                     ← 125 tests
```

---

## Development

```bash
npm install          # Install dependencies
npm run build        # tsup → 344KB ESM bundle
npm test             # 125 tests, ~900ms
npx tsc --noEmit     # Type check
npm run dev          # Watch mode
```

---

## FAQ

**Q: Does LoopSpec call any LLM APIs?**
No. All intelligence is structural/heuristic. Zero network calls. Everything runs locally.

**Q: How do I use it?**
Just say "use loopspec" in your AI tool. Or call `loopspec_status` — it teaches the AI everything.

**Q: What's the token overhead?**
~2-4K tokens per task. Context is routed (not dumped), with a 15K token budget.

**Q: Does it work on Windows?**
Yes. Auto-detects Windows and writes `cmd /c npx` config. Zero manual fixup needed.

---

## License

MIT
