import type { ProjectAnalysis } from '../analyzer.js';

interface SchemaTable {
  name: string;
  fields: { name: string; type: string; constraints: string; desc?: string }[];
  indexes?: string[];
  rls?: string;
  validationRules?: string[];
}

interface ApiEndpoint {
  method: string;
  path: string;
  auth: boolean;
  desc: string;
  requestBody?: string;
  responseType?: string;
  errorCodes?: string[];
  rateLimit?: string;
}

function generateCoreModels(analysis: ProjectAnalysis, answers: Record<string, string>): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const auth = answers.auth || 'email/password';
  const hasAuth = auth !== 'none';

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
      validationRules: [
        'email: z.string().email().max(255)',
        'name: z.string().min(2).max(100)',
        'role: z.enum(["user", "admin"])',
      ],
    });
  }

  if (analysis.industry === 'fintech') {
    tables.push({
      name: 'invoices',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'user_id', type: 'uuid', constraints: 'FK → users.id, NOT NULL' },
        { name: 'client_name', type: 'text', constraints: 'NOT NULL' },
        { name: 'client_email', type: 'text', constraints: 'NULLABLE' },
        { name: 'amount', type: 'numeric(12,2)', constraints: 'NOT NULL, CHECK > 0' },
        { name: 'currency', type: 'text', constraints: "NOT NULL, default: 'USD'" },
        { name: 'status', type: 'text', constraints: 'NOT NULL', desc: 'draft | sent | paid | overdue | cancelled' },
        { name: 'due_date', type: 'date', constraints: 'NOT NULL' },
        { name: 'paid_at', type: 'timestamptz', constraints: 'NULLABLE' },
        { name: 'notes', type: 'text', constraints: 'NULLABLE' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      indexes: ['idx_invoices_user ON invoices(user_id)', 'idx_invoices_status ON invoices(status)', 'idx_invoices_due ON invoices(due_date) WHERE status != \'paid\''],
      rls: 'Users can only CRUD own invoices. No cross-user access.',
      validationRules: [
        'client_name: z.string().min(1).max(200)',
        'client_email: z.string().email().optional()',
        'amount: z.number().positive().max(999999999.99)',
        'currency: z.enum(["USD","EUR","GBP","INR","AUD","CAD"])',
        'status: z.enum(["draft","sent","paid","overdue","cancelled"])',
        'due_date: z.string().date() (must be today or future for new invoices)',
      ],
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
          { name: 'price', type: 'numeric(10,2)', constraints: 'NOT NULL, CHECK >= 0' },
          { name: 'compare_price', type: 'numeric(10,2)', constraints: 'NULLABLE' },
          { name: 'stock', type: 'integer', constraints: 'NOT NULL, default: 0, CHECK >= 0' },
          { name: 'sku', type: 'text', constraints: 'UNIQUE, NULLABLE' },
          { name: 'status', type: 'text', constraints: '', desc: 'active | draft | archived' },
          { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
          { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
        ],
        indexes: ['idx_products_seller ON products(seller_id)', 'idx_products_sku ON products(sku) WHERE sku IS NOT NULL'],
        rls: 'Public read when active. Seller can write own.',
        validationRules: [
          'title: z.string().min(3).max(200)',
          'price: z.number().nonnegative().max(99999.99)',
          'stock: z.number().int().nonnegative()',
          'sku: z.string().regex(/^[A-Z0-9-]+$/).optional()',
          'status: z.enum(["active","draft","archived"])',
        ],
      },
      {
        name: 'orders',
        fields: [
          { name: 'id', type: 'uuid', constraints: 'PK' },
          { name: 'buyer_id', type: 'uuid', constraints: 'FK → users.id' },
          { name: 'total', type: 'numeric(12,2)', constraints: 'NOT NULL, CHECK > 0' },
          { name: 'status', type: 'text', constraints: '', desc: 'pending | paid | shipped | delivered | refunded' },
          { name: 'shipping_address', type: 'jsonb', constraints: 'NOT NULL' },
          { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
          { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
        ],
        rls: 'Buyers can read own orders. Sellers can read orders containing their products.',
        validationRules: [
          'status: z.enum(["pending","paid","shipped","delivered","refunded"])',
          'shipping_address: z.object({ line1: z.string(), city: z.string(), country: z.string().length(2), postal: z.string() })',
        ],
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
        { name: 'ends_at', type: 'timestamptz', constraints: 'NOT NULL, CHECK > starts_at' },
        { name: 'status', type: 'text', constraints: '', desc: 'scheduled | confirmed | completed | cancelled | no-show' },
        { name: 'reason', type: 'text', constraints: 'NOT NULL' },
        { name: 'notes', type: 'text', constraints: 'NULLABLE' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      indexes: ['idx_appointments_patient ON appointments(patient_id)', 'idx_appointments_provider ON appointments(provider_id, starts_at)'],
      rls: 'Patients see own. Providers see assigned. No cross-patient access (HIPAA).',
      validationRules: [
        'starts_at: z.string().datetime() (must be future)',
        'ends_at: z.string().datetime() (must be after starts_at)',
        'reason: z.string().min(5).max(500)',
        'status: z.enum(["scheduled","confirmed","completed","cancelled","no-show"])',
      ],
    });
  } else if (analysis.industry === 'education') {
    tables.push({
      name: 'courses',
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'instructor_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'title', type: 'text', constraints: 'NOT NULL' },
        { name: 'description', type: 'text', constraints: '' },
        { name: 'price', type: 'numeric(8,2)', constraints: 'default: 0' },
        { name: 'published', type: 'boolean', constraints: 'default: false' },
        { name: 'max_students', type: 'integer', constraints: 'NULLABLE' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      indexes: ['idx_courses_instructor ON courses(instructor_id)'],
      rls: 'Public read when published. Instructor full access to own.',
      validationRules: [
        'title: z.string().min(5).max(150)',
        'description: z.string().max(5000).optional()',
        'price: z.number().nonnegative()',
        'max_students: z.number().int().positive().optional()',
      ],
    });
  } else {
    const resourceName = analysis.keywords.find(k => k.length > 4 && !['build', 'create', 'where', 'users', 'with'].includes(k)) || 'items';
    tables.push({
      name: resourceName,
      fields: [
        { name: 'id', type: 'uuid', constraints: 'PK' },
        { name: 'user_id', type: 'uuid', constraints: 'FK → users.id' },
        { name: 'title', type: 'text', constraints: 'NOT NULL' },
        { name: 'description', type: 'text', constraints: 'NULLABLE' },
        { name: 'status', type: 'text', constraints: "default: 'active'", desc: 'active | archived' },
        { name: 'metadata', type: 'jsonb', constraints: 'default: {}' },
        { name: 'created_at', type: 'timestamptz', constraints: 'default: now()' },
        { name: 'updated_at', type: 'timestamptz', constraints: 'default: now()' },
      ],
      rls: 'Owner-only access.',
      validationRules: [
        'title: z.string().min(1).max(200)',
        'status: z.enum(["active","archived"])',
        'metadata: z.record(z.unknown()).optional()',
      ],
    });
  }

  return tables;
}

function generateApiRoutes(analysis: ProjectAnalysis, answers: Record<string, string>, tables: SchemaTable[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const hasAuth = (answers.auth || 'email/password') !== 'none';

  if (hasAuth) {
    endpoints.push(
      { method: 'POST', path: '/api/auth/signup', auth: false, desc: 'Create account', requestBody: '{ email, password, name }', responseType: '{ user, token }', errorCodes: ['400 Validation', '409 Email exists'], rateLimit: '5/min' },
      { method: 'POST', path: '/api/auth/login', auth: false, desc: 'Authenticate', requestBody: '{ email, password }', responseType: '{ user, token }', errorCodes: ['401 Invalid credentials', '429 Too many attempts'], rateLimit: '10/min' },
      { method: 'POST', path: '/api/auth/logout', auth: true, desc: 'End session', responseType: '{ success: true }', errorCodes: ['401 Unauthorized'] },
      { method: 'GET', path: '/api/auth/me', auth: true, desc: 'Get current user', responseType: '{ user }', errorCodes: ['401 Unauthorized'] },
      { method: 'POST', path: '/api/auth/forgot-password', auth: false, desc: 'Request password reset', requestBody: '{ email }', responseType: '{ message }', errorCodes: ['404 User not found'], rateLimit: '3/hour' },
    );
  }

  for (const table of tables) {
    if (table.name === 'users') continue;
    const singular = table.name.replace(/s$/, '');
    const Title = singular.charAt(0).toUpperCase() + singular.slice(1);

    endpoints.push(
      { method: 'GET', path: `/api/${table.name}`, auth: hasAuth, desc: `List ${table.name}`, responseType: `{ data: ${Title}[], total, page, limit }`, errorCodes: ['401 Unauthorized'] },
      { method: 'GET', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Get ${singular}`, responseType: `{ data: ${Title} }`, errorCodes: ['401 Unauthorized', '404 Not found', '403 Forbidden'] },
      { method: 'POST', path: `/api/${table.name}`, auth: hasAuth, desc: `Create ${singular}`, requestBody: `Create${Title}Input`, responseType: `{ data: ${Title} }`, errorCodes: ['400 Validation error', '401 Unauthorized'], rateLimit: '30/min' },
      { method: 'PATCH', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Update ${singular}`, requestBody: `Update${Title}Input (partial)`, responseType: `{ data: ${Title} }`, errorCodes: ['400 Validation', '401 Unauthorized', '403 Forbidden', '404 Not found'] },
      { method: 'DELETE', path: `/api/${table.name}/:id`, auth: hasAuth, desc: `Delete ${singular}`, responseType: '{ success: true }', errorCodes: ['401 Unauthorized', '403 Forbidden', '404 Not found'] },
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
  if (t.rls) out += `\n**RLS Policy:** ${t.rls}\n`;
  if (t.validationRules?.length) {
    out += `\n**Validation (Zod):**\n`;
    for (const rule of t.validationRules) {
      out += `- \`${rule}\`\n`;
    }
  }
  return out;
}

function formatEndpoints(endpoints: ApiEndpoint[]): string {
  let out = '| Method | Path | Auth | Rate Limit | Description |\n|--------|------|------|-----------|-------------|\n';
  for (const e of endpoints) {
    out += `| ${e.method} | \`${e.path}\` | ${e.auth ? '✓' : '—'} | ${e.rateLimit || '—'} | ${e.desc} |\n`;
  }

  // Detailed endpoint specs
  out += '\n### Endpoint Details\n\n';
  for (const e of endpoints) {
    if (e.requestBody || e.errorCodes) {
      out += `#### \`${e.method} ${e.path}\`\n`;
      if (e.requestBody) out += `- **Request:** \`${e.requestBody}\`\n`;
      if (e.responseType) out += `- **Response:** \`${e.responseType}\`\n`;
      if (e.errorCodes?.length) out += `- **Errors:** ${e.errorCodes.join(', ')}\n`;
      if (e.rateLimit) out += `- **Rate Limit:** ${e.rateLimit}\n`;
      out += '\n';
    }
  }

  return out;
}

function generateErrorTypes(analysis: ProjectAnalysis): string {
  return `## Error Response Format

All errors follow this structure:

\`\`\`typescript
interface ApiError {
  error: {
    code: string;         // Machine-readable: "VALIDATION_ERROR"
    message: string;      // Human-readable: "Email is required"
    details?: Record<string, string[]>; // Per-field errors
    requestId: string;    // For support/debugging
  }
}
\`\`\`

### Standard Error Codes

| HTTP | Code | When |
|------|------|------|
| 400 | \`VALIDATION_ERROR\` | Request body fails schema validation |
| 401 | \`UNAUTHORIZED\` | Missing or expired auth token |
| 403 | \`FORBIDDEN\` | Valid auth but insufficient permissions |
| 404 | \`NOT_FOUND\` | Resource doesn't exist or not accessible |
| 409 | \`CONFLICT\` | Duplicate resource (e.g., email already registered) |
| 422 | \`UNPROCESSABLE\` | Valid schema but business logic rejection |
| 429 | \`RATE_LIMITED\` | Too many requests, retry after header |
| 500 | \`INTERNAL_ERROR\` | Unexpected server error (alert ops) |
`;
}

export function generateSchemaPrompt(analysis: ProjectAnalysis, answers: Record<string, string>, stackDna?: string): string {
  const tables = generateCoreModels(analysis, answers);
  const endpoints = generateApiRoutes(analysis, answers, tables);
  const stackContext = stackDna ? `\n## Stack DNA\n${stackDna}\n` : '';

  const tablesSection = tables.map(formatTable).join('\n');
  const endpointsSection = formatEndpoints(endpoints);
  const errorTypes = generateErrorTypes(analysis);

  return `# Schema — ${answers.core_feature || analysis.productType}
${stackContext}
## Data Models

${tablesSection}

## API Endpoints

${endpointsSection}

${errorTypes}

## Authentication
- Provider: ${answers.auth || 'email/password'}
- Strategy: JWT via httpOnly cookie (access: 15min, refresh: 7d)
- Session: Refresh token rotation with reuse detection
- Password: bcrypt (cost 12), minimum 8 chars

## Authorization
- Model: Row-Level Security (Supabase) or middleware checks
- Default: deny-all, explicitly allow per table above
- Admin override: role-based escalation with audit log

## Pagination
- Strategy: cursor-based for lists (offset for admin)
- Default limit: 20, max: 100
- Response: \`{ data: T[], nextCursor?: string, total: number }\`

---

> **AI Instructions:** Expand this schema as you build features. Add:
> - Additional fields discovered during implementation
> - New tables for features not yet designed
> - Webhook/integration endpoints
> - Storage bucket policies if file uploads are needed
> Keep field types consistent with the patterns above.`;
}
