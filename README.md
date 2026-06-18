# LoopSpec — The Compound Intelligence Engine for AI Development

[![CI](https://github.com/sairajbaman/loopspec/actions/workflows/ci.yml/badge.svg)](https://github.com/sairajbaman/loopspec/actions)
[![npm version](https://img.shields.io/npm/v/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![npm downloads](https://img.shields.io/npm/dm/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/sairajbaman/loopspec?style=social)](https://github.com/sairajbaman/loopspec/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/sairajbaman/loopspec)](https://github.com/sairajbaman/loopspec/commits/master)

> **One idea in. Production-ready AI brain out. Gets smarter every time you ship.**
> Zero API calls. 125 tests. 42 tools. 225KB. Fully offline.

LoopSpec is an **MCP server + CLI** that makes any AI coding assistant (Claude Code, Cursor, Windsurf, Gemini, Cline, Codebuff) dramatically better by giving it **persistent memory, real-time drift detection, active goal tracking, and a live dependency graph** — without a single external API call.

---

## ⭐ Like this project? Star it on GitHub — it helps others find it.

---

## The Problem LoopSpec Solves

Without LoopSpec, every AI coding session starts fresh — your AI forgets conventions, drifts from specs, repeats mistakes, and ships untested code.

| Without LoopSpec | With LoopSpec |
|---|---|
| AI forgets conventions between sessions | **Persistent memory** — learns from every session, never forgets |
| No drift detection — spec says X, code does Y | **Real-time drift detection** — catches spec violations on every file save |
| AI loses focus mid-task | **Active goal tracking** — auto-decomposes tasks, verifies progress |
| Ships untested, un-validated code | **Quality gates** — test enforcement, score tracking, guardrails |
| Can't see dependency impact | **Graph-of-Thought** — knows what depends on what, shows impact |
| Repeats same mistakes every session | **Model profiler** — detects AI blind spots, auto-compensates |
| Spec gets stale as code evolves | **Self-healing specs** — keeps spec in sync with reality |

---

## Features

| Category | Features |
|---|---|
| **🧠 Memory** | Bayesian learning, cross-project playbook, decision journal, compound patterns |
| **🎯 Goals** | Auto-decomposition, real-time verification, anti-pattern detection, progress tracking |
| **🔍 Drift Detection** | 7 categories (auth, UI states, validation, type-safety, API contract, route, conventions) |
| **📊 Scorecard** | 6 dimensions (spec compliance, accessibility, design match, drift, tests, patterns) |
| **🛡️ Guardrails** | 5 rule packs (OWASP security, WCAG accessibility, React patterns, performance budget, testing quality) |
| **🔗 Graph-of-Thought** | File/function/type/component/route nodes, import/reference edges, impact analysis |
| **📝 Spec Engine** | Idea analysis, hybrid generation (8 docs), stack presets (11 stacks), template customization |
| **🤖 Model Profiler** | 9 blind spot categories, adaptive checklist, anti-pattern frequency tracking |
| **⚡ Sandbox** | Isolated JS execution for inline testing |
| **🔧 Plugin System** | Extensible rules (drift-react, drift-next, drift-vue, security-advanced, testing-enforce) |
| **🔄 Session Engine** | Start/stop sessions, checkpoints, score delta tracking, progress restore |
| **🩹 Self-Healing** | Accept/revert/ignore drift, ripple effect analysis, spec auto-update |
| **🔮 Inverse Reasoning** | Predict expected code before writing, compare after for gaps |

---

## Quick Start (30 seconds)

### One Command Setup (auto-detects your AI tool)

```bash
npx loopspec-mcp setup
```

Auto-detects Cursor, VS Code, Windsurf, Claude Code, Kiro, Gemini, Codebuff — configures all of them.

### Or One-Liner for Your Specific Tool

```bash
# Claude Code
claude mcp add loopspec -- npx -y loopspec-mcp

# Cursor — paste in .cursor/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Kiro — paste in .kiro/settings/mcp.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}

# Windows (any tool) — use cmd wrapper
{"mcpServers":{"loopspec":{"command":"cmd","args":["/c","npx","-y","loopspec-mcp"]}}}

# Windsurf — paste in .codeium/windsurf.json
{"mcpServers":{"loopspec":{"command":"npx","args":["-y","loopspec-mcp"]}}}
```

### Initialize a Project

Tell your AI: **"use loopspec"** or:

```
Use loopspec_init with idea: "I want to build an app where freelancers track invoices"
```

LoopSpec generates 8 spec documents (PRD, TRD, AppFlow, Schema, Plan, SKILL, UIBrief, DesignSystem) from your idea in seconds.

---

## How It Works

```
STATUS → SESSION → PREFLIGHT → CONTEXT → WORK → CHECKPOINT → COMPOUND → REPEAT
  ↑                                                                │
  └──────────── system gets smarter every cycle ───────────────────┘
```

Every session:
1. **`loopspec_status`** — AI learns how to use LoopSpec (self-bootstrapping, zero config)
2. **`loopspec_session start`** — creates goal checklist from spec
3. **`loopspec_preflight`** — injects constraints before coding
4. **`loopspec_context`** — routes only relevant spec sections (saves tokens)
5. **AI writes code** — your AI tool of choice (Claude, GPT, Gemini, etc.)
6. **`loopspec_checkpoint`** — scores, checks tests, updates goals
7. **`loopspec_compound`** — extracts patterns for future sessions

---

## Use Cases

### Solo Developer Building an MVP
You tell Claude Code "use loopspec". It generates specs, tracks goals, catches drift. You ship in days, not weeks. Your AI remembers everything across sessions.

### Team Using Multiple AI Tools
Frontend team uses Cursor, backend uses Claude Code. LoopSpec synchronizes specs, conventions, and quality gates across both. **The AI brain outlasts any single model.**

### AI-Powered Code Review
`loopspec_review` scores every PR against spec compliance, accessibility, design match, and test coverage. No more manual "you forgot X" comments.

### Freelancer Shipping Production Apps
Start with a one-sentence idea → get complete spec → build with AI that never forgets conventions → verify with drift detection → ship with confidence.

---

## 42 Tools Reference

### Orientation (call first)
| Tool | Purpose |
|---|---|
| `loopspec_status` | Returns project state, goals, and workflow guidance — self-bootstrapping |

### Session & Goals
| Tool | Purpose |
|---|---|
| `loopspec_session` | Start/end tracked sessions with progress restore |
| `loopspec_goal` | Create/check/update active goal checklists |
| `loopspec_checkpoint` | Score + test gate + goal progress (all-in-one) |
| `loopspec_decision` | Log decisions with rationale (persists across sessions) |

### Core Spec
| Tool | Purpose |
|---|---|
| `loopspec_init` | Generate specs from idea |
| `loopspec_vibe` | Quick setup (auto-fills defaults) |
| `loopspec_context` | Route task-relevant context (saves tokens) |
| `loopspec_plan` | Break into subtasks |
| `loopspec_design` | Design system generation (31 palettes, 21 fonts) |
| `loopspec_detect` | Auto-generate SKILL.md from existing repo |

### Quality & Guardrails
| Tool | Purpose |
|---|---|
| `loopspec_preflight` | Inject constraints before work |
| `loopspec_guardrails_add` | Install rule packs (security, a11y, perf, etc.) |
| `loopspec_drift` | Check file for spec drift (7 categories) |
| `loopspec_watch` | Scan recent changes for drift (real-time) |
| `loopspec_score` | Quality scorecard (6 dimensions) |
| `loopspec_verify` | Adversarial code review |
| `loopspec_typecheck` | TypeScript type checking integration |

### Neural Intelligence (v2.0)
| Tool | Purpose |
|---|---|
| `loopspec_graph` | Build dependency graph + impact analysis |
| `loopspec_profile` | View/update model blind-spot profile |
| `loopspec_autocomplete` | Get spec-derived code snippets |
| `loopspec_heal` | Accept or revert drift (self-healing specs) |
| `loopspec_contracts` | Verify frontend/backend API match |
| `loopspec_guidance` | Smart help when stuck (spec + playbook + common mistakes) |
| `loopspec_predict` | Inverse reasoning — predict code before writing, compare after |

### Learning & Memory
| Tool | Purpose |
|---|---|
| `loopspec_compound` | Extract patterns from work (Bayesian NLP) |
| `loopspec_playbook` | Search past learnings across projects |
| `loopspec_feedback` | Record quality signals |
| `loopspec_infer` | Predict best approach (multi-signal weighted) |

### Loop Engineering
| Tool | Purpose |
|---|---|
| `loopspec_maker_prompt` | Optimized builder prompt with spec context + guardrails |
| `loopspec_checker_prompt` | Adversarial reviewer prompt |
| `loopspec_retry` | Smart retry with error context |
| `loopspec_escalate` | Flag for human review |
| `loopspec_decompose` | Split into parallel tasks |
| `loopspec_merge_review` | Reconcile parallel outputs |

### Extensibility
| Tool | Purpose |
|---|---|
| `loopspec_plugin` | Install/remove/list plugins (drift-react, etc.) |
| `loopspec_sandbox` | Execute JS snippets in isolated VM |
| `loopspec_template` | Customize doc generation (skip/add/replace sections) |
| `loopspec_enforce` | Add pre-commit or CI enforcement hooks |
| `loopspec_suggest` | Get implementation suggestions from spec + playbook |

---

## CLI Mode

LoopSpec works standalone from your terminal — no AI tool required:

```bash
# Sessions
loopspec session start "add payments"   # → Auto-decomposes into 11 goals
loopspec session status                  # → Goals, score, files changed
loopspec session end                     # → Report with score delta

# Analysis
loopspec check src/app/page.tsx          # → Drift + guardrails + score
loopspec watch --continuous              # → Real-time file monitoring
loopspec watch --continuous --tui        # → Dashboard mode
loopspec review --pr main                # → Score all changed files

# Intelligence
loopspec graph build                     # → Map all dependencies
loopspec graph impact "src/types.ts"     # → "affects 12 files"
loopspec graph query "payment"           # → Search graph
loopspec suggest "stripe webhook"        # → Common mistakes + spec context
loopspec predict "payment form"          # → Inverse reasoning

# Tools
loopspec profile                         # → Blind spot visualization
loopspec plugin install drift-react      # → Add React-specific rules
loopspec connect --status                # → Show configured AI tools
```

---

## What Makes LoopSpec Different

| Feature | LoopSpec | Raw AI (Claude/GPT/Gemini) | Other MCP Servers |
|---|---|---|---|
| Persistent memory | ✅ Bayesian learning | ❌ Forgets every session | ❌ Most are stateless |
| Drift detection | ✅ 7 categories, real-time | ❌ Manual review | ❌ Rare |
| Goal tracking | ✅ Auto-decompose + verify | ❌ None | ❌ None |
| Dependency graph | ✅ 340+ node graph | ❌ Can't see structure | ❌ None |
| Model profiler | ✅ 9 blind spots | ❌ None | ❌ None |
| Quality scorecard | ✅ 6 dimensions | ❌ None | ❌ None |
| Works offline | ✅ Yes | ✅ Yes | ❌ Most need APIs |
| LLM API calls | **Zero** | N/A | ❌ Most call LLMs |
| Bundle size | **225KB** | N/A | Varies |
| Tests | **125** | N/A | Usually < 20 |
| Stack presets | **11 stacks** | ❌ None | ❌ Rare |

---

## Graph-of-Thought

LoopSpec builds a live dependency graph of your project:

```
$ loopspec graph build
✓ Graph built: 340 nodes, 338 edges
  Files: 103 | Functions: 175 | Types: 57 | Components: 5 | Routes: 0

$ loopspec graph impact "src/context.ts"
src/context.ts affects 49 file(s):
  • src/engines/session/index.ts (references)
  • src/engines/graph/index.ts (references)
  • src/tools/session-tool.ts (references)

$ loopspec graph query "payment"
  • [type] PaymentMethod (src/payments/types.ts)
  • [function] processPayment (src/payments/handler.ts:42)
  • [file] payment-form.tsx (src/components/payments/)
```

When you change a type, LoopSpec tells you exactly what else needs updating — no more "I forgot to update X".

---

## Model Profiler

Tracks what your AI forgets most and auto-compensates:

```
$ loopspec profile

  Sessions: 12 | Updated: 2026-06-18

  █████░░░░░ 50% Loading states (5✓ 5✗)
  ██░░░░░░░░ 20% Accessibility (2✓ 8✗)
  ████████░░ 80% Error handling (8✓ 2✗)
  ⛔ STOP using: any types (10 occurrences recorded)

  Adaptive checklist (auto-injected into preflight):
  ⚠ ALWAYS include: Accessibility (you miss this 80% of the time)
  ⚠ ALWAYS include: Loading states (you miss this 50% of the time)
```

The profiler learns your specific AI model's weak points and automatically adjusts guardrails. Next session, your AI will be reminded before it makes the same mistakes.

---

## Inverse Reasoning (Predict)

Before your AI writes code, LoopSpec predicts what it **should** write:

```
$ loopspec predict "stripe webhook handler"

  Before coding, these are expected:
  ○ Signature verification
  ○ Idempotency/duplicate check
  ○ Event type routing
  ○ Quick 200 response
  ○ Async processing (don't block)

$ loopspec predict compare --files webhook.ts

  Completeness: 40/100
  ✓ Signature verification (100%)
  ✗ Idempotency/duplicate check (0%) ← MISSING
  ✗ Event type routing (0%)          ← MISSING
  ✓ Quick 200 response (100%)
  ✗ Async processing (0%)            ← MISSING
```

Catches missing patterns **before** they become bugs. No AI call needed — pure structural analysis.

---

## Plugin System

```bash
loopspec plugin list
# Available: drift-react, drift-next, drift-vue, security-advanced, testing-enforce

loopspec plugin install drift-react
# ✓ Installed: 3 rules (no-index-key, useEffect-deps, no-nested-components)

loopspec plugin install security-advanced
# ✓ Installed: 5 rules (CORS, CSP, SQL injection, XSS, SSRF)
```

---

## Self-Bootstrapping Pattern

LoopSpec teaches your AI how to use it — **zero configuration needed**:

1. AI calls `loopspec_status` (zero params)
2. Gets back: project state + workflow instructions + adaptive checklist
3. Automatically follows the preflight → context → checkpoint loop
4. Each session makes the next session better

The AI's response includes a persistence hint:

> *"Add to your CLAUDE.md: Always call loopspec_status first. Follow the LoopSpec workflow."*

Once persisted, the behavior survives across all future sessions.

---

## Supported AI Tools

| Tool | Config File | Status |
|---|---|---|
| **Claude Code** | .mcp.json | ✅ Auto-detected |
| **Cursor** | .cursor/mcp.json | ✅ Auto-detected |
| **Windsurf** | .codeium/windsurf/mcp_config.json | ✅ Auto-detected |
| **Gemini CLI** | gemini-extension.json | ✅ Manual (PATH) |
| **Kiro** | .kiro/settings/mcp.json | ✅ Auto-detected |
| **Amazon Q** | ~/.aws/amazonq/mcp.json | ✅ Auto-detected |
| **VS Code** | .vscode/mcp.json | ✅ Auto-detected |
| **Codebuff** | codebuff_config.json | ✅ Auto-detected |
| **Cline** | cline_mcp_settings.json | ✅ Auto-detected |
| **Continue** | .continue/config.json | ✅ Auto-detected |

---

## Supported Stacks (11 Stack DNA Presets)

| Stack | Convention Rules | Anti-Patterns |
|---|---|---|
| Next.js + Supabase + shadcn | ✅ Detailed | ✅ 8 anti-patterns |
| T3 Stack (tRPC, Prisma, NextAuth) | ✅ Detailed | ✅ 6 anti-patterns |
| React Native + Expo | ✅ Detailed | ✅ 5 anti-patterns |
| Python + FastAPI | ✅ Detailed | ✅ 5 anti-patterns |
| Vue + Nuxt + Pinia | ✅ Detailed | ✅ 5 anti-patterns |
| SvelteKit + Drizzle | ✅ Detailed | ✅ 5 anti-patterns |
| Flutter + Firebase | ✅ Detailed | ✅ 5 anti-patterns |
| Django + HTMX | ✅ Detailed | ✅ 5 anti-patterns |
| Go + Fiber | ✅ Detailed | ✅ 5 anti-patterns |
| Rust + Axum | ✅ Detailed | ✅ 5 anti-patterns |
| Spring Boot | ✅ Detailed | ✅ 5 anti-patterns |

---

## Architecture

```
loopspec/                          📦 225KB ESM bundle
├── src/
│   ├── server.ts              ← MCP server entry (42 tools)
│   ├── cli/                   ← CLI entry + 9 commands
│   ├── tools/                 ← 42 MCP tool handlers
│   └── engines/               ← Core intelligence (15 engines)
│       ├── session/           ← Session lifecycle + restore (305 lines)
│       ├── goals/             ← Goal decomposition + verification
│       ├── graph/             ← Dependency graph + impact analysis (160 lines)
│       ├── profiler/          ← Blind spot tracking (9 categories)
│       ├── predict/           ← Inverse reasoning (155 lines, 7 task categories)
│       ├── autocomplete/      ← Spec-derived code injection
│       ├── self-heal/         ← Drift accept/revert with ripple analysis
│       ├── contracts/         ← API contract verification
│       ├── plugins/           ← Extensible rule system (5 available)
│       ├── sandbox/           ← Isolated JS execution
│       ├── watcher/           ← chokidar file watcher
│       ├── test-gate/         ← Test enforcement (3 patterns, smart suggestions)
│       ├── decisions/         ← Decision log (SQLite + markdown)
│       ├── guidance/          ← Smart help (spec + playbook + mistakes DB)
│       ├── guardrails/        ← 5 rule packs + preventive mode
│       ├── live-sync/         ← Drift detection (7 categories)
│       ├── scorecard/         ← 6-dimension quality scoring (339 lines)
│       ├── memory/            ← Bayesian learning + cross-project playbook
│       ├── context-router/    ← Task-relevant routing (token budget)
│       ├── design-engine/     ← 31 palettes, 21 fonts, 16 styles
│       └── spec-engine/       ← Multi-signal analyzer + 8 templates
├── data/
│   ├── guardrails/            ← 5 YAML rule packs
│   └── stacks/                ← 11 stack DNA presets
├── server.json                ← Smithery registry
├── gemini-extension.json      ← Gemini CLI discovery
└── tests/                     ← 125 tests, 10 suites
```

---

## Stats

| Metric | Value |
|---|---|
| **Tools** | 42 |
| **Tests** | 125 (all passing, ~900ms) |
| **Bundle size** | 225KB ESM |
| **Engines** | 15 intelligence engines |
| **Stack presets** | 11 |
| **Guardrail rules** | 40+ |
| **Drift categories** | 7 |
| **Scorecard dimensions** | 6 |
| **Blind spot categories** | 9 |
| **Plugin packs** | 5 |
| **API calls** | **Zero** (fully offline) |
| **File watcher** | chokidar (real-time) |
| **Storage** | SQLite + JSON + Markdown |
| **Dependencies** | 6 runtime (minimal) |

---

## Development

```bash
git clone https://github.com/sairajbaman/loopspec.git
cd loopspec
npm install          # Install dependencies
npm run build        # tsup → 225KB ESM bundle
npm test             # 125 tests, ~900ms
npx tsc --noEmit     # Type check (strict mode)
npm run dev          # Watch mode
```

---

## FAQ

**Q: Does LoopSpec call any LLM APIs?**
No. All intelligence is structural/heuristic. Zero network calls. Everything runs locally. This means **zero cost, zero latency, zero data leaving your machine.**

**Q: How do I use it?**
Just say "use loopspec" in your AI tool. Or call `loopspec_status` — it teaches the AI everything. No config files to write.

**Q: What's the token overhead?**
~2-4K tokens per task. Context is routed (not dumped), with a 15K token budget. Compare to dumping entire specs (50K+).

**Q: Does it work on Windows?**
Yes. Auto-detects Windows and writes `cmd /c npx` config. Zero manual fixup needed.

> **PowerShell note:** Windows PowerShell 5.1 does not support `&&`. Use `;` to chain commands:
> ```powershell
> cd "my-project" ; npx loopspec-mcp status
> ```
> Or use PowerShell 7+ (`pwsh`) which supports `&&`.

**Q: Can I use it with existing projects?**
Yes. Use `loopspec_detect` to auto-generate SKILL.md from your existing codebase.

**Q: Does it work offline?**
Yes. No network calls. Everything runs locally via MCP stdio.

**Q: What AI tools are supported?**
Claude Code, Cursor, Windsurf, Gemini CLI, Kiro, Codebuff, VS Code, Cline, Continue — any MCP-compatible tool.

**Q: How is this different from just using prompt engineering?**
Prompt engineering is ephemeral — it lasts one message. LoopSpec persists across sessions, learns from outcomes, and catches drift that prompts can't prevent.

---

## Roadmap

- [x] Spec engine with 8 hybrid documents
- [x] Context router with token budgets
- [x] Drift detection (7 categories)
- [x] Quality scorecard (6 dimensions)
- [x] Guardrails (5 rule packs)
- [x] Session engine with goals
- [x] Graph-of-Thought (dependency graph)
- [x] Model profiler (blind spot tracking)
- [x] Inverse reasoning (predict)
- [x] Self-healing specs
- [x] Plugin system
- [x] CLI mode
- [x] Live sandbox
- [x] API contract verification
- [ ] Swarm coordinator (multi-model orchestration)
- [ ] TUI dashboard
- [ ] VS Code extension
- [ ] GitHub Actions integration

---

## Star History

If LoopSpec saves you time, **[star it on GitHub](https://github.com/sairajbaman/loopspec)** ⭐ — it helps other developers find it.

---

## License

MIT. Use it freely in personal and commercial projects.

---

<p align="center">
  Built with ❤️ for developers who ship with AI.
  <br>
  <a href="https://github.com/sairajbaman/loopspec/issues">Report Issue</a> ·
  <a href="https://github.com/sairajbaman/loopspec/discussions">Discussion</a> ·
  <a href="https://www.npmjs.com/package/loopspec-mcp">npm</a>
</p>
