# Technical Requirements — art marketplace with storefronts and secure purchasing

## Stack Decision
- **Framework:** nextjs-supabase-shadcn
- **Hosting:** Vercel
- **Scale target:** 100-1000 users
- **Real-time:** true

## Stack DNA
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

## File Structure

```
├── src/
│   ├── app/  # App Router pages
│   │   ├── (auth)/  # Auth group layout
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/  # Protected group layout
│   │   │   ├── layout.tsx  # Auth-gated layout
│   │   │   └── page.tsx  # Dashboard home
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── route.ts
│   │   ├── layout.tsx  # Root layout
│   │   └── page.tsx  # Landing/home
│   ├── components/
│   │   ├── ui/  # Reusable primitives
│   │   ├── forms/  # Form components
│   │   └── layout/  # Layout shells
│   ├── lib/
│   │   ├── db.ts  # Database client
│   │   ├── auth.ts  # Auth helpers
│   │   └── validations.ts  # Zod schemas
│   ├── hooks/  # Custom React hooks
│   └── types/  # Shared TypeScript types
├── public/
└── tests/
```

## Non-Functional Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | < 2.5s | Lighthouse CI |
| JS Bundle | < 250KB gzipped | Build output |
| API Response (p95) | < 500ms | Server logs |
| Uptime | 99% | Monitoring |
| Error Rate | < 0.1% | Error tracking |

## Security
- Auth: email/password
- Tokens: httpOnly cookies, short-lived access + refresh
- Input validation: Zod on API boundary
- Rate limiting: per-IP on auth routes (5/min)
- CSP headers: strict, no inline scripts

## Constraints
- Node >= 20, TypeScript strict mode
- Browser: last 2 versions + Safari 15+
- Mobile: responsive, touch targets >= 44px

---

> **AI Instructions:** When implementing:
> - Follow the file structure above exactly
> - Create files as you encounter new features
> - Keep the NFR targets as your performance budget
> - Add integrations under `src/lib/` with typed clients