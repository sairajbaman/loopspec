import vm from 'node:vm';

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface TestCase {
  input: string;
  expected: string;
  description: string;
}

export async function runInSandbox(code: string, testCases?: TestCase[]): Promise<SandboxResult[]> {
  const results: SandboxResult[] = [];

  if (testCases && testCases.length > 0) {
    for (const tc of testCases) {
      const result = execute(`${code}\n\n${tc.input}`);
      const pass = result.output.trim() === tc.expected.trim();
      results.push({
        ...result,
        output: `${tc.description}: ${result.output} ${pass ? '✓' : `✗ (expected: ${tc.expected})`}`,
        success: pass && result.success,
      });
    }
  } else {
    results.push(execute(code));
  }

  return results;
}

function execute(code: string): SandboxResult {
  const start = Date.now();
  const logs: string[] = [];

  const sandbox = {
    console: { log: (...args: any[]) => logs.push(args.map(String).join(' ')) },
    result: undefined as any,
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    require: undefined,
  };

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code, { timeout: 3000 });
    const result = script.runInContext(context, { timeout: 3000 });

    return {
      success: true,
      output: logs.length > 0 ? logs.join('\n') : (result !== undefined ? String(result) : '(no output)'),
      duration: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      output: logs.join('\n'),
      error: err.message || String(err),
      duration: Date.now() - start,
    };
  }
}

export function generateTestCases(funcName: string, funcCode: string): TestCase[] {
  const cases: TestCase[] = [];

  // Simple heuristics for common patterns
  if (funcCode.includes('number') || funcCode.includes('amount') || funcCode.includes('price')) {
    cases.push(
      { input: `console.log(${funcName}(100))`, expected: '', description: 'Normal numeric input' },
      { input: `console.log(${funcName}(0))`, expected: '', description: 'Zero input' },
      { input: `console.log(${funcName}(-1))`, expected: '', description: 'Negative input' },
    );
  }

  if (funcCode.includes('string') || funcCode.includes('name') || funcCode.includes('text')) {
    cases.push(
      { input: `console.log(${funcName}("hello"))`, expected: '', description: 'Normal string' },
      { input: `console.log(${funcName}(""))`, expected: '', description: 'Empty string' },
    );
  }

  // Always add a basic call
  if (cases.length === 0) {
    cases.push({ input: `console.log(typeof ${funcName})`, expected: 'function', description: 'Is a function' });
  }

  return cases;
}
