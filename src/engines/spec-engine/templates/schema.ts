import type { ProjectAnalysis } from '../analyzer.js';

interface SchemaTable {
  name: string;
  fields: { name: string; type: string; constraints: string; desc?: string }[];
  indexes?: string[];
  rls?: string;
}

interface ApiEndpoint {
  method: string;
  path: string;
  auth: boolean;
  desc: string;
}

function generateCoreModels(analysis: ProjectAnalysis, answers: Record<string, string>): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const auth = answers.auth || 'email/password';
  const hasAuth = auth !== 'none';

  // User table (always, if auth)
  if (hasAuth) {
    tables.push({
      name: 'users',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK, default: gen_random_uuid()' },
        { name: 'email', type: 'text', constraints: 'UNIQUE, NOT NULL' },
        { name: 'name', type: 'text', constraints: 'NOT NULL' },
        { name: 'avatar_url', type: 'text', constraints: 'NULLABLE' },
        { name: 'role', type: 'text', constraints: "NOT NULL, default: 'user'", desc: 'user | admin' },
        { name: 'created_at', type: 'timestamptz', constraints: 'NOT NULL, default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'NOT NULL, default: now()' },
      ],
      indexes: ['idx_users_email ON users(email)'],
      rls: 'Users can read own row. Admins can read all.',
    });
  }

  // Industry-specific models
  if (analysis.industry === 'fintech') {
    tables.push({
      name: 'invoices',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'user_id', type: 'uuid', constraints: 'FK → users.id, NOT NULL' },
        { name: 'client_name', type: 'text', constraints: 'NOT NULL' },
        { name: 'amount', type: 'numeric(12,2)', constraints: 'NOT NULL' },
        { name: 'currency', type: 'text', constraints: "NOT NULL, default: 'USD'" },
        { name: 'status', type: 'text', constraints: 'NOT NULL', desc: 'draft | sent | paid | overdue' },
        { name: 'due_date', type: 'date', constraints: 'NOT NULL' },
        { name: 'paid_at', type: 'timestamptz', constraints: 'NULLABLE' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      indexes: ['idx_invoices_user ON invoices(user_id)', 'idx_invoices_status ON invoices(status)'],
      rls: 'Users can only access own invoices.',
    });
  } else if (analysis.industry === 'ecommerce') {
    tables.push(
      {
        name: 'products',
        fields: [
          { name: 'id', type: 'uuid', constraints: 'PK' },
          { name: 'seller_id', type: 'uuid', constraints: 'FK → users.id' },
          { name: 'title', type: 'text', constraints: 'NOT NULL' },
          { name: 'description', type: 'text', constraints: '' },
          { name: 'price', type: 'numeric(10,2)', constraints: 'NOT NULL' },
          { name: 'stock', type: 'integer', constraints: 'NOT NULL, default: 0' },
          { name: 'status', type: 'text', constraints: '', desc: 'active | draft | archived' },
          { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
          { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
        ],
        indexes: ['idx_products_seller ON products(seller_id)'],
        rls: 'Public read. Seller can write own.',
      },
      {
        name: 'orders',
        fields: [
          { name: 'id', type: 'uuid', constraints: 'PK' },
          { name: 'buyer_id', type: 'uuid', constraints: 'FK → users.id' },
          { name: 'total', type: 'numeric(12,2)', constraints: 'NOT NULL' },
          { name: 'status', type: 'text', constraints: '', desc: 'pending | paid | shipped | delivered' },
          { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
          { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
        ],
        rls: 'Buyers can read own orders.',
      }
    );
  } else if (analysis.industry === 'healthcare') {
    tables.push({
      name: 'appointments',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'patient_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'provider_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'starts_at', type: 'timestamptz', constraints: 'NOT NULL' },
        { name: 'ends_at', type: 'timestamptz', constraints: 'NOT NULL' },
        { name: 'status', type: 'text', constraints: '', desc: 'scheduled | confirmed | completed | cancelled' },
        { name: 'notes', type: 'text', constraints: 'NULLABLE' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      rls: 'Patients see own. Providers see assigned.',
    });
  } else if (analysis.industry === 'education') {
    tables.push({
      name: 'courses',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'instructor_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'title', type: 'text', constraints: 'NOT NULL' },
        { name: 'description', type: 'text', constraints: '' },
        { name: 'published', type: 'boolean', constraints: 'default: false' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      rls: 'Public read when published. Instructor full access.',
    });
  } else {
    // Generic primary resource
    const resourceName = analysis.keywords.find(k => k.length > 4 && !['build', 'create', 'where', 'users', 'with'].includes(k)) || 'items';
    tables.push({
      name: resourceName,
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'user_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'title', type: 'text', constraints: 'NOT NULL' },
        { name: 'status', type: 'text', constraints: "default: 'active'" },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      rls: 'Owner-only access.',
    });
  }

  return tables;
}

function generateApiRoutes(analysis: ProjectAnalysis, answers: Record<string, string>, tables: SchemaTable[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const hasAuth = (answers.auth || 'email/password') !== 'none';

  if (hasAuth) {
    endpoints.push(
      { method: 'POST', path: '/api/auth/signup', auth: false, desc: 'Create account' },
      { method: 'POST', path: '/api/auth/login', auth: false, desc: 'Authenticate' },
      { method: 'POST', path: '/api/auth/logout', auth: true, desc: 'End session' },
      { method: 'GET', path: '/api/auth/me', auth: true, desc: 'Get current user' },
    );
  }

  // CRUD for each non-user table
  for (const table of tables) {
    if (table.name === 'users') continue;
    const singular = table.name.replace(/s$/, '');
    endpoints.push(
      { method: 'GET', path: `/api/${table.name}`, auth: hasAuth, desc: `List ${table.name}` },
      { method: 'GET', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Get ${singular}` },
      { method: 'POST', path: `/api/${table.name}`, auth: hasAuth, desc: `Create ${singular}` },
      { method: 'PATCH', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Update ${singular}` },
      { method: 'DELETE', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Delete ${singular}` },
    );
  }

  return endpoints;
}

function formatTable(t: SchemaTable): string {
  let out = `### Table: \`${t.name}\`\n\n`;
  out += '| Field | Type | Constraints | Description |\n|-------|------|------------|-------------|\n';
  for (const f of t.fields) {
    out += `| ${f.name} | ${f.type} | ${f.constraints} | ${f.desc || ''} |\n`;
  }
  if (t.indexes?.length) out += `\n**Indexes:** ${t.indexes.join(', ')}\n`;
  if (t.rls) out += `**RLS:** ${t.rls}\n`;
  return out;
}

function formatEndpoints(endpoints: ApiEndpoint[]): string {
  let out = '| Method | Path | Auth | Description |\n|--------|------|------|-------------|\n';
  for (const e of endpoints) {
    out += `| ${e.method} | \`${e.path}\` | ${e.auth ? '✓' : '—'} | ${e.desc} |\n`;
  }
  return out;
}

export function generateSchemaPrompt(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): string {
  const tables = generateCoreModels(analysis, answers);
  const endpoints = generateApiRoutes(analysis, answers, tables);
  const stackContext = stackDna ? `\n## Stack DNA\n${stackDna}\n` : '';

  const tablesSection = tables.map(formatTable).join('\n');
  const endpointsSection = formatEndpoints(endpoints);

  return `# Schema — ${answers.core_feature || analysis.productType}
${stackContext}
## Data Models

${tablesSection}

## API Endpoints

${endpointsSection}

## Authentication
- Provider: ${answers.auth || 'email/password'}
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
> Keep field types consistent with the patterns above.`;
}
