Generate a SKILL.md — the AI agent memory file for this project.

## Context
- Stack: nextjs-supabase-shadcn
- Industry: ecommerce

## Stack Conventions (from DNA preset)
Framework: Next.js 15 (App Router)
ORM: Supabase (Postgres + PostgREST)
Auth: Supabase Auth (email/password + social)
UI: shadcn/ui + Tailwind CSS 4

Conventions:
- TypeScript strict mode, no `any`
- Server Components by default, 'use client' only when needed
- File-based routing with app/ directory
- Named exports for components
- Colocate components with their routes
- Use Supabase RLS for all data access policies
- Environment variables prefixed with NEXT_PUBLIC_ for client-side

Anti-Patterns:
- Never use getServerSideProps (use Server Components)
- Never access Supabase client-side without RLS
- Never store secrets in NEXT_PUBLIC_ variables
- Never use useEffect for data fetching (use Server Components)
- Never skip loading/error states in async components
- Avoid client components for static content
- Never disable TypeScript strict mode

## Sections Required
### Project Overview
One paragraph summary.

### Tech Stack
Exact framework, DB, ORM, auth, UI lib.

### Coding Conventions
- Strictness, naming, imports, component patterns

### Commands
- install, dev, build, test, lint, deploy

### Architecture Decisions
Key choices with one-line rationale.

### File Structure
Where code types live.

### Common Patterns
How to add page, endpoint, table.

### Anti-Patterns (at least 5)
Things to NEVER do.

### Lessons Learned
(empty — auto-populated by compound engine)