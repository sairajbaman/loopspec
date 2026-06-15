# LoopSpec — The Compound Intelligence Engine for AI Development

> **One idea in. Production-ready AI brain out. Gets smarter every time you ship.**

[![CI](https://github.com/sairajbaman/loopspec/actions/workflows/ci.yml/badge.svg)](https://github.com/sairajbaman/loopspec/actions)
[![npm version](https://img.shields.io/npm/v/loopspec-mcp.svg)](https://www.npmjs.com/package/loopspec-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## What Is LoopSpec?

LoopSpec is an **MCP server** that transforms a one-sentence project idea into a living specification system. It doesn't generate code — it makes your AI code generator dramatically better by giving it:

- **Persistent memory** across sessions (SKILL.md conventions)
- **Structured context** routed per-task (not dump-everything)
- **Quality feedback loops** (score → learn → improve)
- **Drift detection** (spec says X, code does Y)
- **Guardrails** (prevent known bad patterns before they happen)

```
INIT → PLAN → PREFLIGHT → CONTEXT → WORK → VERIFY → SCORE → COMPOUND → REPEAT
         ↑                                                          │
         └──────────── system gets smarter each cycle ──────────────┘
```

---

## Quick Start

### 1. Add to Your AI Tool

Works with any MCP-compatible AI: Claude Code, Cursor, Windsurf, Cline, etc.

```json
{
  "mcpServers": {
    "loopspec": {
      "command": "npx",
      "args": ["-y", "loopspec-mcp"],
      "env": {
        "LOOPSPEC_PROJECT_DIR": "."
      }
    }
  }
}
```

### 2. Initialize a Project

Tell your AI:

```
Use loopspec_init with idea: "I want to build an app where freelancers track invoices and get paid faster"
```

LoopSpec will:
1. **Analyze** your idea → detects industry (fintech), product type (web-app), complexity (medium)
2. **Ask** 5-10 clarifying questions (auth? stack? scale?)
3. **Generate** 8 hybrid spec documents in `.loopspec/`

### 3. Start Building

```
Use loopspec_context for: "build the invoice creation form"
```

LoopSpec routes only the relevant spec sections to your AI — saving tokens and improving accuracy.

---

## How Hybrid Generation Works

LoopSpec v0.3.0 generates **real content** for deterministic sections and **structured prompts** for creative ones:

| Document | Deterministic Content | AI-Expanded Content |
|----------|----------------------|---------------------|
| Schema.md | Table definitions, API endpoints, RLS policies | Additional fields for new features |
| TRD.md | File structure tree, NFR targets, security rules | Architecture diagrams, rationale |
| AppFlow.md | Screen tables with routes/auth/states | Transition descriptions, edge cases |
| PRD.md | User stories, success metrics, non-goals | Problem statement, persona, risks |
| SKILL.md | — | Conventions (built from answers) |
| DesignSystem.md | — | Color/font/spacing tokens |

**Example Schema.md output (generated, not prompted):**

```markdown
### Table: `invoices`

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | uuid | PK, default: gen_random_uuid() | |
| user_id | uuid | FK → users.id, NOT NULL | |
| client_name | text | NOT NULL | |
| amount | numeric(12,2) | NOT NULL | |
| status | text | NOT NULL | draft | sent | paid | overdue |
| due_date | date | NOT NULL | |
| created_at | timestamptz | default: now() | |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/invoices` | ✓ | List invoices |
| POST | `/api/invoices` | ✓ | Create invoice |
| PATCH | `/api/invoices/:id` | ✓ | Update invoice |
| DELETE | `/api/invoices/:id` | ✓ | Delete invoice |
```

---

## 23 Tools Reference

### Core Spec

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `loopspec_init` | Generate specs from idea | Project start |
| `loopspec_vibe` | Same, auto-fills defaults | Quick prototyping |
| `loopspec_context` | Route task-relevant context | Before every task |
| `loopspec_plan` | Break into subtasks | Before complex features |
| `loopspec_design` | Design system generation | UI work |
| `loopspec_detect` | Auto-generate SKILL.md from existing repo | Adopting LoopSpec mid-project |

### Quality & Guardrails

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `loopspec_preflight` | Inject constraints before work | Before coding |
| `loopspec_guardrails_add` | Install rule packs | Project setup |
| `loopspec_drift` | Check file for spec drift | After changes |
| `loopspec_watch` | Scan recent changes for drift | Periodically |
| `loopspec_score` | Quality scorecard | After completing tasks |
| `loopspec_verify` | Adversarial code review | Before merging |

### Learning & Memory

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `loopspec_compound` | Extract patterns from work | After completing tasks |
| `loopspec_playbook` | Search past learnings | Before similar work |
| `loopspec_feedback` | Record quality signals | After outcomes |
| `loopspec_infer` | Predict best approach | Before complex decisions |

### Loop Engineering

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `loopspec_maker_prompt` | Optimized builder prompt | Complex implementations |
| `loopspec_checker_prompt` | Adversarial reviewer | Code review |
| `loopspec_retry` | Smart retry with error context | After failures |
| `loopspec_escalate` | Flag for human review | Blocked/uncertain |
| `loopspec_decompose` | Split into parallel tasks | Large features |
| `loopspec_merge_review` | Reconcile parallel outputs | After parallel work |

### Configuration

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `loopspec_template` | Customize doc generation | Project setup |
| `loopspec_update` | Sync spec with code changes | After significant changes |
| `loopspec_suggest` | Get improvement ideas | Anytime |

---

## Three Modes

| Mode | Questions | Best For |
|------|-----------|----------|
| **Vibe** | 5 (auto-fills rest) | Solo builders, quick starts |
| **Pro** | 10 (technical depth) | Developers who want control |
| **Team** | 12 (+ governance) | Teams sharing one spec |

---

## Drift Detection (7 Categories)

LoopSpec watches for structural patterns that indicate code has diverged from spec:

| Category | What It Detects | Severity |
|----------|----------------|----------|
| `auth` | Missing session/middleware on protected routes | High |
| `ui-states` | Missing loading/error/empty states on pages | Medium-High |
| `validation` | Missing Zod/Yup on API routes | High |
| `type-safety` | `any` types, @ts-ignore usage | Medium |
| `conventions` | Default exports when SKILL.md says named | Low |
| `api-contract` | Missing response types, no error handling | Medium-High |
| `route-drift` | Undocumented routes not in AppFlow | Low |
| `state-management` | Prop drilling without Context/store | Low |

**Usage:**
```
Use loopspec_watch with minutes: 10
```
→ Scans all files modified in the last 10 minutes, returns aggregated drift report.

---

## Scorecard (Real Analysis)

The scorecard performs actual code analysis, not placeholders:

| Dimension | What It Checks |
|-----------|---------------|
| **Spec Compliance** | Types defined (+), error handling (+), validation (+), TODOs (-), console.log (-), convention violations (-) |
| **Accessibility** | img alt, input labels, button aria-label, onClick on divs, color-only indicators |
| **Design Match** | Hardcoded hex colors, inline styles, magic pixel values, design token usage |
| **Drift Score** | Results from drift detection engine |
| **Test Coverage** | Presence of test files for changed code |
| **Pattern Match** | TypeScript strictness, @ts-ignore usage |

All scores are averaged per-file with detailed breakdown.

---

## Template Customization

Control exactly which documents get generated:

```
# Skip documents you don't need
loopspec_template action:skip document:UIBrief.md

# Add custom sections to any document
loopspec_template action:add_section document:PRD.md section_title:"Risk Matrix" section_prompt:"Generate a 3x3 risk matrix..."

# Position sections relative to existing ones
loopspec_template action:add_section document:TRD.md section_title:"Monitoring" section_anchor:"Security" section_position:after

# Replace a document entirely with your template
loopspec_template action:set_template document:PRD.md template_content:"# {{coreFeature}}\n..."

# Reset to defaults
loopspec_template action:reset
```

Config is persisted in `.loopspec/template-config.json`.

---

## Stack DNA Presets

Pre-loaded conventions, patterns, anti-patterns, and file structures for:

| Stack | Focus |
|-------|-------|
| `nextjs-supabase-shadcn` | App Router, RSC, RLS, shadcn/ui |
| `t3-stack` | tRPC, Prisma, NextAuth, Tailwind |
| `react-native-expo` | Expo Router, React Navigation |
| `python-fastapi` | Pydantic, SQLAlchemy, Alembic |
| `vue-nuxt-pinia` | Composition API, Nuxt 3, Pinia |
| `sveltekit-drizzle` | Runes, Drizzle ORM, SvelteKit |
| `flutter-firebase` | Provider, Riverpod, Firestore |
| `django-htmx` | Django REST, HTMX, Alpine.js |
| `go-fiber` | Fiber, GORM, Air |
| `rust-axum` | Axum, SQLx, Tower |
| `spring-boot` | Spring Security, JPA, Flyway |

Specify in init: `loopspec_init idea:"..." stack:"python-fastapi"`

---

## Architecture Honesty

| Engine | Depth | What It Actually Does |
|--------|-------|----------------------|
| Spec Generation | ★★★★☆ | Hybrid: deterministic tables/trees + prompts for narrative |
| Context Router | ★★★☆☆ | Domain classification + section extraction, token budgets |
| Design Engine | ★★★★☆ | 31 palettes, 21 fonts, 16 styles with matching algorithm |
| Guardrails | ★★★☆☆ | 4 packs (40 rules), spec-derived constraints |
| Drift Detection | ★★★★☆ | 7 categories, structural + API contract + validation |
| Scorecard | ★★★☆☆ | Real a11y/design/type analysis with per-file breakdown |
| Memory | ★★★☆☆ | Bayesian NLP extraction + confidence + cross-project playbook |
| Analyzer | ★★★☆☆ | Multi-signal weighted scoring, feature extraction, confidence |

**What it doesn't do:**
- No LLM calls internally — all intelligence is structural/heuristic
- No real-time file watching (MCP is request-response)
- No semantic drift detection (requires LLM — delegated to `loopspec_verify`)
- Scorecard is directional, not absolute measurement

---

## Project Structure

```
loopspec/
├── src/
│   ├── server.ts              ← MCP server entry
│   ├── context.ts             ← App context (project dir, DB)
│   ├── tools/                 ← 23 MCP tool handlers
│   │   ├── init.ts, vibe.ts, context.ts, plan.ts
│   │   ├── drift.ts, score.ts, watch.ts, template.ts
│   │   ├── compound.ts, detect.ts, enforce.ts
│   │   └── loop-engineering.ts
│   ├── engines/               ← Core logic
│   │   ├── spec-engine/       ← Analyzer + generator + templates
│   │   ├── scorecard/         ← Quality scoring
│   │   ├── live-sync/         ← Drift detection
│   │   ├── context-router/    ← Task-relevant routing
│   │   ├── design-engine/     ← Design system matching
│   │   ├── guardrails/        ← Rule packs
│   │   └── memory/            ← Bayesian learning
│   └── utils/                 ← Files, tokens, markdown, DB
├── tests/                     ← 106 tests across 8 files
├── data/                      ← Stack presets + guardrail packs
└── dist/                      ← Built output (192KB ESM)
```

---

## Development

```bash
npm install          # Install dependencies
npm run build        # tsup → 192KB ESM bundle
npm test             # 106 tests, ~700ms
npx tsc --noEmit     # Type check
npm run dev          # Watch mode
```

### Running Locally

```bash
# Build and test
npm run build && npm test

# Use with Claude Code (point to local build)
# In your project's .mcp.json:
{
  "loopspec": {
    "command": "node",
    "args": ["/path/to/loopspec/dist/server.js"],
    "env": { "LOOPSPEC_PROJECT_DIR": "." }
  }
}
```

---

## FAQ

**Q: Does LoopSpec call any LLM APIs?**
No. All analysis is structural/heuristic. The LLM calls come from your AI tool reading LoopSpec's outputs.

**Q: Can I use it with an existing project?**
Yes. Use `loopspec_detect` to auto-generate SKILL.md from your existing codebase, or run `loopspec_init` and answer questions based on your existing architecture.

**Q: What's the token overhead?**
`loopspec_context` uses a token budget (default 15K) and only routes relevant sections. A full SKILL.md is ~500 tokens. Total context injection is typically 2-4K tokens per task.

**Q: Does it work offline?**
Yes. No network calls. Everything runs locally via MCP stdio.

---

## License

MIT
