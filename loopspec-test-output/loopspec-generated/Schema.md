# Schema — art marketplace with storefronts and secure purchasing

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

## Data Models

### Table: `users`

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | uuid | PK, default: gen_random_uuid() |  |
| email | text | UNIQUE, NOT NULL |  |
| name | text | NOT NULL |  |
| avatar_url | text | NULLABLE |  |
| role | text | NOT NULL, default: 'user' | user | admin |
| created_at | timestamptz | NOT NULL, default: now() |  |
| updated_at | timestamptz | NOT NULL, default: now() |  |

**Indexes:** idx_users_email ON users(email)
**RLS:** Users can read own row. Admins can read all.

### Table: `products`

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | uuid | PK |  |
| seller_id | uuid | FK → users.id |  |
| title | text | NOT NULL |  |
| description | text |  |  |
| price | numeric(10,2) | NOT NULL |  |
| stock | integer | NOT NULL, default: 0 |  |
| status | text |  | active | draft | archived |
| created_at | timestamptz | default: now() |  |
| updated_at | timestamptz | default: now() |  |

**Indexes:** idx_products_seller ON products(seller_id)
**RLS:** Public read. Seller can write own.

### Table: `orders`

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| id | uuid | PK |  |
| buyer_id | uuid | FK → users.id |  |
| total | numeric(12,2) | NOT NULL |  |
| status | text |  | pending | paid | shipped | delivered |
| created_at | timestamptz | default: now() |  |
| updated_at | timestamptz | default: now() |  |
**RLS:** Buyers can read own orders.


## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Authenticate |
| POST | `/api/auth/logout` | ✓ | End session |
| GET | `/api/auth/me` | ✓ | Get current user |
| GET | `/api/products` | ✓ | List products |
| GET | `/api/products/:id` | ✓ | Get product |
| POST | `/api/products` | ✓ | Create product |
| PATCH | `/api/products/:id` | ✓ | Update product |
| DELETE | `/api/products/:id` | ✓ | Delete product |
| GET | `/api/orders` | ✓ | List orders |
| GET | `/api/orders/:id` | ✓ | Get order |
| POST | `/api/orders` | ✓ | Create order |
| PATCH | `/api/orders/:id` | ✓ | Update order |
| DELETE | `/api/orders/:id` | ✓ | Delete order |


## Authentication
- Provider: email/password
- Strategy: JWT via httpOnly cookie
- Session: 7-day refresh token rotation

## Authorization
- Model: Row-Level Security (Supabase) or middleware checks
- Default: deny-all, explicitly allow per table above

---

> **AI Instructions:** Expand this schema as you build features. Add:
> - Additional fields discovered during implementation
> - New tables for features not yet designed
> - Webhook/integration endpoints
> - Storage bucket policies if file uploads are needed
> Keep field types consistent with the patterns above.