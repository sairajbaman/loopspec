# LoopSpec — The Loop Engineering Engine for AI Development

[![CI](https://github.com/sairajbaman/loopspec/actions/workflows/ci.yml/badge.svg)](https://github.com/sairajbaman/loopspec/actions)
[![npm version](https://img.shields.io/npm/v/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![npm downloads](https://img.shields.io/npm/dm/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/sairajbaman/loopspec?style=social)](https://github.com/sairajbaman/loopspec/stargazers)

> **Stop prompting. Start looping.**
> The first MCP server that implements Loop Engineering — autonomous agents orchestrating agents, learning every cycle, shipping without you.
> Zero API calls. 164 tests. 47 tools. 232KB. Fully offline.

---

## The Shift: From Prompting to Loop Engineering

Silicon Valley's top builders (creator of Claude Code, Andrej Karpathy, creator of OpenClaw) are saying the same thing:

> *"You shouldn't be prompting coding agents anymore. You should be designing loops that prompt your agents."*

The engineering stack evolved: **Punch cards → Assembly → High-level languages → Autocomplete → Terminal agents → Loop Engineering.**

Each layer replaces the one before it. LoopSpec is the **first open-source implementation** of this new layer.

```
┌─────────────────────────────────────────────────────────┐
│  YOU (high-level goal)                                  │
│    ↓                                                    │
│  ORCHESTRATOR (spawns & manages sub-loops)              │
│    ↓                                                    │
│  SWARM (multiple agents: maker, checker, deployer)      │
│    ↓                                                    │
│  DAEMON (autonomous: security, drift, docs, tests)      │
│    ↓                                                    │
│  DEPLOY LOOP (build → test → lint → deploy → monitor)  │
│    ↓                                                    │
│  COMPOUND (learns, gets smarter, feeds next cycle)      │
└─────────────────────────────────────────────────────────┘
```

**You write the loop once. It runs forever. It gets smarter every cycle.**

---

## ⭐ Star this repo — it helps other builders find it.

---

## Why LoopSpec Changes How You Code

### Before LoopSpec (Prompting Era)
```
You → Write prompt → AI generates code → You review → You prompt again → Repeat
                                            ↑
                                     (YOU are the loop)
```
You are stuck in the loop. You're the orchestrator, the reviewer, the memory.

### After LoopSpec (Loop Engineering Era)
```
You → Define goal → LoopSpec orchestrates → Agents work → Verified → Deployed
                         ↑                                      │
                         └──── learns, adapts, repeats ─────────┘
                                  (LOOP runs itself)
```
You define the system. The system runs itself.

---

## What LoopSpec Does (That Nothing Else Can)

| Capability | What It Means |
|---|---|
| **🐝 Swarm Coordinator** | Multiple AI agents working in parallel/pipeline — one plans, one builds, one reviews, one deploys |
| **🤖 Autonomous Daemon** | Background loop that runs security scans, drift checks, docs updates, test runs — on schedule, no human needed |
| **🚀 Auto-Deploy Pipeline** | Full CI/CD: build → test → lint → security → deploy → verify → monitor. Auto-rollback on failure |
| **🔄 Cross-Agent Orchestrator** | Loops that spawn sub-loops. A tree of autonomous work. "Build a SaaS" spawns "design DB" + "build API" + "build UI" loops |
| **🧠 Persistent Memory** | Bayesian learning that compounds across sessions. Your AI never forgets conventions |
| **🎯 Prompt Amplifier** | Turns vague prompts into structured, research-backed instructions with thinking frames and success criteria |
| **🔍 Real-time Drift Detection** | 7 categories of drift caught live. Spec says X, code does Y? Caught instantly |
| **📊 Quality Scorecard** | 6-dimension scoring on every checkpoint. No more "it looks fine" |
| **🔮 Inverse Reasoning** | Predicts what code SHOULD look like before writing. Catches missing patterns |
| **🔗 Dependency Graph** | Knows what depends on what. Change a type? Shows you all 12 files that need updating |
| **🧪 Self-Healing Specs** | When code drifts from spec, choose: update the spec or fix the code. Ripple analysis included |
| **🎓 Model Profiler** | Tracks your AI's blind spots (accessibility? loading states?) and auto-compensates |

---

## Quick Start (30 seconds)

```bash
npx loopspec-mcp setup
```

Auto-detects Claude Code, Cursor, Windsurf, Kiro, VS Code, Gemini, Codebuff — configures all of them.

### Or manual one-liner:

```bash
# Claude Code
claude mcp add loopspec -- npx -y loopspec-mcp

# Cursor — .cursor/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Kiro — .kiro/settings/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Windows (any tool)
{"mcpServers":{"loopspec":{"command":"cmd","args":["/c","npx","-y","loopspec-mcp"]}}}
```

### First Use

Tell your AI: **"use loopspec"** — it self-bootstraps. Zero config needed.

---

## The Loop Engineering Workflow

```
STATUS → SESSION → PREFLIGHT → CONTEXT → WORK → CHECKPOINT → COMPOUND → REPEAT
  ↑                                                                │
  └──────── system gets smarter every cycle ───────────────────────┘
```

Every session:
1. **`loopspec_status`** — AI learns how to use LoopSpec (self-bootstrapping)
2. **`loopspec_session start`** — creates goal checklist from spec
3. **`loopspec_amplify`** — transforms vague prompts into structured instructions
4. **`loopspec_preflight`** — injects constraints before coding
5. **AI writes code** — with guardrails active
6. **`loopspec_checkpoint`** — scores, checks tests, updates goals
7. **`loopspec_compound`** — extracts patterns for future sessions

**For autonomous work:**
- **`loopspec_daemon enable`** → scheduled loops run without you
- **`loopspec_swarm init`** → multiple agents tackle sub-tasks in parallel
- **`loopspec_deploy start`** → full pipeline from code to production
- **`loopspec_orchestrate create`** → loops that spawn and manage sub-loops

---

## Real Examples

### 1. Prompt Amplifier — Makes Any Prompt 10x Better

**Input:** `"add stripe payments"`

**Output (auto-generated):**
```
## TASK
add stripe payments

## THINK STEP-BY-STEP
1. Understand EXACTLY what is being asked — restate the goal
2. Identify all pieces needed (files, functions, types, imports)
3. Determine the correct ORDER (dependencies first)
4. For each piece: edge cases, error states, validation
5. Before writing: "What could go wrong? What am I forgetting?"

## CONSTRAINTS
- OWASP: validate all inputs, no secrets in client code
- Always handle webhook signature verification

## AVOID THESE (learned from past sessions)
• Using parsed body instead of raw body for webhooks
• Missing idempotency key for retried events
• ⚠️ You tend to miss: Error handling (60% miss rate)

## SUCCESS CRITERIA
- [ ] Directly solves what was asked
- [ ] Input validated
- [ ] Auth/permissions checked
- [ ] Handles error/edge cases
- [ ] Code is complete and runnable
```

No more vague prompts. The AI thinks clearly because it gets structured constraints.

### 2. Multi-Agent Swarm — Build an App Without Touching the Keyboard

```bash
loopspec swarm init "build invoice tracking app"
# ✓ Swarm initialized: swarm_1750491234
#   Strategy: pipeline

loopspec swarm add --swarm swarm_1750491234 --role planner --id plan-agent
loopspec swarm add --swarm swarm_1750491234 --role maker --id build-agent
loopspec swarm add --swarm swarm_1750491234 --role checker --id review-agent
loopspec swarm add --swarm swarm_1750491234 --role deployer --id deploy-agent

loopspec swarm next swarm_1750491234
# Next actions (1):
#   • plan-agent: execute → design the schema and plan tasks
```

Each agent gets the output from the previous one. Pipeline flows automatically.

### 3. Autonomous Daemon — Never Forget Security Again

```bash
loopspec daemon enable
loopspec daemon tick
# Triggered 3 tasks:
#   • Security Scan (security-scan)
#   • Drift Check (drift-check)
#   • Compound Learn (compound-learn)
```

Runs daily. Catches security issues, spec drift, and extracts learnings — without you doing anything.

### 4. Deploy Loop — Code to Production in One Command

```bash
loopspec deploy start --env staging
# ✓ Deploy started: deploy_1750491234
#   Stages: build → test → lint → security → deploy → verify → monitor
```

Fails at lint? Remaining stages skipped. Verify fails in production? Auto-rollback. Human approval required for prod.

### 5. Cross-Agent Orchestrator — Loops Spawning Loops

```bash
loopspec orchestrate create "ship a new SaaS every week"
# ✓ Plan: orch_1750491234
#   Root loop → spawns: ideation, design, build, deploy, marketing
```

The orchestrator spawns sub-loops (max depth 3, max 10 loops). Each sub-loop can spawn its own children. A tree of autonomous work.

---

## 47 Tools Reference

### Orientation
| Tool | Purpose |
|---|---|
| `loopspec_status` | Project state + workflow guidance (self-bootstrapping) |
| `loopspec_amplify` | **NEW** — Transforms any prompt into structured, research-backed instructions |

### Session & Goals
| Tool | Purpose |
|---|---|
| `loopspec_session` | Start/end tracked sessions with progress restore |
| `loopspec_goal` | Create/check/update active goal checklists |
| `loopspec_checkpoint` | Score + test gate + goal progress (all-in-one) |
| `loopspec_decision` | Log decisions with rationale |

### Loop Engineering (Autonomous)
| Tool | Purpose |
|---|---|
| `loopspec_swarm` | Multi-agent swarm (parallel, pipeline, fan-out-fan-in, round-robin) |
| `loopspec_daemon` | Autonomous background loop — scheduled security, drift, docs, tests |
| `loopspec_deploy` | Auto-deploy: build → test → lint → security → deploy → verify → monitor |
| `loopspec_orchestrate` | Cross-agent orchestrator — loops that spawn and manage sub-loops |
| `loopspec_maker_prompt` | Optimized builder prompt with spec context |
| `loopspec_checker_prompt` | Adversarial reviewer prompt |
| `loopspec_retry` | Smart retry with error context |
| `loopspec_escalate` | Flag for human review |
| `loopspec_decompose` | Split into parallel tasks |
| `loopspec_merge_review` | Reconcile parallel outputs |

### Core Spec
| Tool | Purpose |
|---|---|
| `loopspec_init` | Generate 8 spec documents from one idea |
| `loopspec_vibe` | Quick setup (auto-fills defaults) |
| `loopspec_context` | Route task-relevant context (saves tokens) |
| `loopspec_plan` | Break into subtasks |
| `loopspec_design` | Design system (31 palettes, 21 fonts) |
| `loopspec_detect` | Auto-generate SKILL.md from existing repo |

### Quality & Guardrails
| Tool | Purpose |
|---|---|
| `loopspec_preflight` | Inject constraints before work |
| `loopspec_guardrails_add` | Install rule packs (security, a11y, perf) |
| `loopspec_drift` | Check file for spec drift (7 categories) |
| `loopspec_watch` | Real-time file monitoring |
| `loopspec_score` | Quality scorecard (6 dimensions) |
| `loopspec_verify` | Adversarial code review |
| `loopspec_typecheck` | TypeScript type checking |

### Neural Intelligence
| Tool | Purpose |
|---|---|
| `loopspec_graph` | Dependency graph + impact analysis |
| `loopspec_profile` | Model blind-spot tracking |
| `loopspec_autocomplete` | Spec-derived code snippets |
| `loopspec_heal` | Self-healing specs (accept/revert drift) |
| `loopspec_contracts` | Frontend/backend API match |
| `loopspec_guidance` | Smart help when stuck |
| `loopspec_predict` | Inverse reasoning — predict before write |

### Learning & Memory
| Tool | Purpose |
|---|---|
| `loopspec_compound` | Extract patterns (Bayesian NLP) |
| `loopspec_playbook` | Search past learnings across projects |
| `loopspec_feedback` | Record quality signals |
| `loopspec_infer` | Predict best approach |

### Extensibility
| Tool | Purpose |
|---|---|
| `loopspec_plugin` | Install/remove plugins |
| `loopspec_sandbox` | Execute JS in isolated VM |
| `loopspec_template` | Customize doc generation |
| `loopspec_enforce` | Pre-commit/CI hooks |
| `loopspec_suggest` | Implementation suggestions |

---

## CLI Mode

```bash
# Loop Engineering
loopspec swarm init "build e-commerce"     # Multi-agent swarm
loopspec swarm status                       # Agent states
loopspec daemon enable                      # Start autonomous loop
loopspec daemon tick                        # Trigger due tasks
loopspec deploy start --env staging         # Full deploy pipeline
loopspec orchestrate create "ship weekly"   # Loop-of-loops

# Sessions
loopspec session start "add payments"
loopspec session status
loopspec session end

# Analysis
loopspec check src/app/page.tsx
loopspec watch --continuous
loopspec review --pr main

# Intelligence
loopspec graph build
loopspec graph impact "src/types.ts"
loopspec predict "payment form"
loopspec suggest "stripe webhook"
loopspec profile
```

---

## Why Engineers Are Switching to LoopSpec

| Without LoopSpec | With LoopSpec |
|---|---|
| You ARE the loop (prompt → review → repeat) | Loops run themselves, you define the system |
| AI forgets everything between sessions | Persistent memory — compounds every session |
| No drift detection | 7 categories caught in real-time |
| Ship and pray | Deploy loop: build → test → verify → monitor → auto-rollback |
| One agent, one task | Swarm: multiple agents, parallel strategies |
| Manual security reviews | Daemon runs scans daily without you |
| Vague prompts, mediocre output | Amplifier turns prompts into structured instructions |
| AI repeats same mistakes | Profiler detects blind spots, auto-compensates |

---

## How It Compares

| Feature | LoopSpec | Raw AI | Other MCP Servers |
|---|---|---|---|
| Loop Engineering (swarm, daemon, deploy) | ✅ Full | ❌ | ❌ |
| Autonomous background loops | ✅ | ❌ | ❌ |
| Cross-agent orchestration | ✅ | ❌ | ❌ |
| Auto-deploy with rollback | ✅ | ❌ | ❌ |
| Prompt amplification | ✅ | ❌ | ❌ |
| Persistent memory | ✅ | ❌ | ❌ Rare |
| Drift detection | ✅ 7 categories | ❌ | ❌ |
| Dependency graph | ✅ 340+ nodes | ❌ | ❌ |
| Model profiler | ✅ 9 blind spots | ❌ | ❌ |
| Works offline | ✅ | ✅ | ❌ Most need APIs |
| LLM API calls | **Zero** | N/A | ❌ Most call LLMs |
| Bundle size | **232KB** | N/A | Varies |
| Tests | **164** | N/A | Usually < 20 |

---

## Architecture

```
loopspec/                            📦 232KB ESM bundle
├── src/
│   ├── server.ts                ← MCP server (47 tools)
│   ├── cli/                     ← CLI (17 commands)
│   ├── tools/                   ← 47 MCP tool handlers
│   └── engines/                 ← 21 intelligence engines
│       ├── swarm/               ← Multi-agent orchestration (4 strategies)
│       ├── daemon/              ← Autonomous scheduled loops
│       ├── deploy-loop/         ← CI/CD pipeline (7 stages)
│       ├── orchestrator/        ← Cross-agent loop tree
│       ├── prompt-amplifier/    ← Prompt research + structuring
│       ├── session/             ← Session lifecycle + restore
│       ├── goals/               ← Goal decomposition + verification
│       ├── graph/               ← Dependency graph + impact analysis
│       ├── profiler/            ← Blind spot tracking (9 categories)
│       ├── predict/             ← Inverse reasoning
│       ├── self-heal/           ← Drift accept/revert + ripple analysis
│       ├── memory/              ← Bayesian learning + cross-project playbook
│       ├── live-sync/           ← Drift detection (7 categories)
│       ├── scorecard/           ← 6-dimension quality scoring
│       ├── guardrails/          ← 5 rule packs + preventive mode
│       ├── context-router/      ← Task-relevant routing (token budget)
│       ├── contracts/           ← API contract verification
│       ├── plugins/             ← Extensible rule system
│       ├── sandbox/             ← Isolated JS execution
│       ├── guidance/            ← Smart help (spec + playbook)
│       └── spec-engine/         ← Multi-signal analyzer + 8 templates
├── data/
│   ├── guardrails/              ← 5 YAML rule packs
│   └── stacks/                  ← 11 stack DNA presets
└── tests/                       ← 164 tests, 14 suites
```

---

## Stats

| Metric | Value |
|---|---|
| **Tools** | 47 |
| **Tests** | 164 (all passing, ~1.5s) |
| **Bundle** | 232KB ESM |
| **Engines** | 21 |
| **Stack presets** | 11 |
| **Guardrail rules** | 40+ |
| **Drift categories** | 7 |
| **Swarm strategies** | 4 (parallel, pipeline, fan-out-fan-in, round-robin) |
| **Deploy stages** | 7 (build, test, lint, security, deploy, verify, monitor) |
| **Scorecard dimensions** | 6 |
| **Blind spot categories** | 9 |
| **API calls** | **Zero** (fully offline) |
| **Dependencies** | 6 runtime |

---

## Supported AI Tools

| Tool | Status |
|---|---|
| Claude Code | ✅ Auto-detected |
| Cursor | ✅ Auto-detected |
| Windsurf | ✅ Auto-detected |
| Kiro | ✅ Auto-detected |
| VS Code | ✅ Auto-detected |
| Gemini CLI | ✅ Manual |
| Amazon Q | ✅ Auto-detected |
| Codebuff | ✅ Auto-detected |
| Cline | ✅ Auto-detected |
| Continue | ✅ Auto-detected |

---

## Supported Stacks (11 Presets)

Next.js + Supabase + shadcn • T3 Stack • React Native + Expo • Python + FastAPI • Vue + Nuxt • SvelteKit + Drizzle • Flutter + Firebase • Django + HTMX • Go + Fiber • Rust + Axum • Spring Boot

Each preset includes convention rules and anti-patterns.

---

## Development

```bash
git clone https://github.com/sairajbaman/loopspec.git
cd loopspec
npm install
npm run build        # → 232KB ESM bundle
npm test             # → 164 tests, ~1.5s
npm run dev          # Watch mode
```

---

## The Future Is Loops

The engineering world moved from punch cards to assembly to Python to autocomplete to terminal agents. The next layer is **Loop Engineering** — systems that orchestrate systems.

LoopSpec is shipping this today:
- **Swarm** — multiple agents, coordinated strategies
- **Daemon** — autonomous background work
- **Deploy** — full pipeline with auto-rollback
- **Orchestrator** — loops spawning loops (loop tree)
- **Amplifier** — makes every prompt dramatically better
- **Memory** — compounds and learns across every session

**Your job is no longer to prompt an AI. Your job is to design the loops that prompt the AI.**

---

## Roadmap

- [x] 8 hybrid spec documents from one idea
- [x] Context router with token budgets
- [x] Drift detection (7 categories, real-time)
- [x] Quality scorecard (6 dimensions)
- [x] Guardrails (5 rule packs)
- [x] Session engine with goals
- [x] Graph-of-Thought (dependency graph)
- [x] Model profiler (blind spot tracking)
- [x] Inverse reasoning (predict)
- [x] Self-healing specs
- [x] Plugin system
- [x] CLI mode (17 commands)
- [x] Multi-agent swarm coordinator
- [x] Autonomous daemon loops
- [x] Auto-deploy pipeline
- [x] Cross-agent orchestrator (loop tree)
- [x] Prompt amplifier
- [ ] TUI dashboard
- [ ] VS Code extension
- [ ] GitHub Actions integration
- [ ] Persistent daemon process (cron-based)

---

## License

MIT. Use freely in personal and commercial projects.

---

<p align="center">
  <strong>Stop prompting. Start looping.</strong>
  <br><br>
  <a href="https://github.com/sairajbaman/loopspec/issues">Report Issue</a> ·
  <a href="https://github.com/sairajbaman/loopspec/discussions">Discussion</a> ·
  <a href="https://www.npmjs.com/package/loopspec-mcp">npm</a>
</p>
