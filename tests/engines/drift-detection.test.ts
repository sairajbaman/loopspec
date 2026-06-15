import { describe, it, expect } from 'vitest';

// Test drift detection pattern matching logic directly

describe('Drift Detection Patterns', () => {
  const AUTH_PATTERNS = [
    /(?:getSession|getUser|auth\(\)|createClient|useSession|getServerSession|requireAuth|protect|middleware)/,
    /(?:redirect|throw|return).*(?:unauthorized|unauthenticated|401|login)/i,
  ];

  const VALIDATION_PATTERNS = [
    /(?:z\.\w+|zod|yup|joi|validate|safeParse|parse\()/i,
  ];

  const ERROR_PATTERNS = [
    /(?:try\s*\{|\.catch\(|onError|ErrorBoundary|error\.tsx|fallback)/,
    /(?:if\s*\(\s*(?:error|err|isError)|throw\s+new\s+\w*Error)/,
  ];

  const LOADING_PATTERNS = [
    /(?:loading|isLoading|isPending|Skeleton|Spinner|Suspense|fallback)/,
  ];

  describe('auth detection', () => {
    it('detects getSession pattern', () => {
      const code = 'const session = await getSession(req);';
      expect(AUTH_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects useSession hook', () => {
      const code = 'const { data: session } = useSession();';
      expect(AUTH_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects redirect to login', () => {
      const code = 'if (!session) return redirect("/login");';
      expect(AUTH_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('does not false-positive on unrelated code', () => {
      const code = 'const name = user.displayName;';
      expect(AUTH_PATTERNS.some(p => p.test(code))).toBe(false);
    });
  });

  describe('validation detection', () => {
    it('detects zod schema', () => {
      const code = 'const body = z.object({ email: z.string() }).parse(req.body);';
      expect(VALIDATION_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects safeParse', () => {
      const code = 'const result = schema.safeParse(input);';
      expect(VALIDATION_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects yup validation', () => {
      const code = 'await yup.object().validate(data);';
      expect(VALIDATION_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('does not false-positive on unrelated code', () => {
      const code = 'const data = await fetch("/api/users");';
      expect(VALIDATION_PATTERNS.some(p => p.test(code))).toBe(false);
    });
  });

  describe('error handling detection', () => {
    it('detects try/catch', () => {
      const code = 'try { await api.call() } catch (e) { setError(e) }';
      expect(ERROR_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects .catch()', () => {
      const code = 'fetch("/api").then(r => r.json()).catch(handleError);';
      expect(ERROR_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects ErrorBoundary', () => {
      const code = '<ErrorBoundary fallback={<Error />}>';
      expect(ERROR_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects throw new Error', () => {
      const code = 'if (!data) throw new NotFoundError("not found");';
      expect(ERROR_PATTERNS.some(p => p.test(code))).toBe(true);
    });
  });

  describe('loading state detection', () => {
    it('detects isLoading variable', () => {
      const code = 'const [isLoading, setIsLoading] = useState(false);';
      expect(LOADING_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects Skeleton component', () => {
      const code = 'if (loading) return <Skeleton className="h-20" />';
      expect(LOADING_PATTERNS.some(p => p.test(code))).toBe(true);
    });

    it('detects Suspense', () => {
      const code = '<Suspense fallback={<Loading />}>';
      expect(LOADING_PATTERNS.some(p => p.test(code))).toBe(true);
    });
  });

  describe('API contract checks', () => {
    it('detects missing response in API route', () => {
      const code = 'export async function POST(req) { const data = await getBody(req); }';
      const hasResponse = /(?:NextResponse|\.json\(|\.send\(|res\.status)/.test(code);
      expect(hasResponse).toBe(false);
    });

    it('passes API route with NextResponse', () => {
      const code = 'export async function POST(req) { return NextResponse.json({ ok: true }); }';
      const hasResponse = /(?:NextResponse|\.json\(|\.send\(|res\.status)/.test(code);
      expect(hasResponse).toBe(true);
    });

    it('passes API route with res.send', () => {
      const code = 'app.post("/api/items", (req, res) => { res.send({ ok: true }); })';
      const hasResponse = /(?:NextResponse|\.json\(|\.send\(|res\.status)/.test(code);
      expect(hasResponse).toBe(true);
    });
  });

  describe('type safety detection', () => {
    it('counts any type usages', () => {
      const code = 'const x: any = getData();\nconst y: any = {};';
      const anyPattern = /:\s*any(?:\s|;|,|\)|\])/g;
      const matches = code.match(anyPattern) || [];
      expect(matches.length).toBe(2);
    });

    it('counts @ts-ignore', () => {
      const code = '// @ts-ignore\nconst x = unsafeCall();\n// @ts-nocheck';
      const pattern = /@ts-ignore|@ts-nocheck/g;
      const matches = code.match(pattern) || [];
      expect(matches.length).toBe(2);
    });

    it('does not flag typed any in comments', () => {
      const code = '// This should not use any type\nconst x: string = "hello";';
      const anyPattern = /:\s*any(?:\s|;|,|\)|\])/g;
      const matches = code.match(anyPattern) || [];
      expect(matches.length).toBe(0);
    });
  });
});
