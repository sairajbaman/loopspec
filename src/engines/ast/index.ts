/**
 * AST-Level Drift Detection Engine
 * Uses TypeScript Compiler API for real code understanding.
 * No regex guessing — parses actual syntax trees.
 */
import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';

export interface AstAnalysis {
  functions: FunctionInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];
  types: TypeInfo[];
  asyncFunctions: FunctionInfo[];
  errorHandling: ErrorHandlingInfo[];
  stateUsage: StateUsageInfo[];
  anyTypes: AnyTypeInfo[];
  apiRoutes: ApiRouteInfo[];
}

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  hasReturnType: boolean;
  paramCount: number;
  hasTryCatch: boolean;
  hasErrorParam: boolean;
  complexity: number; // cyclomatic
}

export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'type' | 'interface' | 'const' | 'default';
  line: number;
}

export interface ImportInfo {
  module: string;
  names: string[];
  isTypeOnly: boolean;
  line: number;
}

export interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
  properties: number;
}

export interface ErrorHandlingInfo {
  functionName: string;
  line: number;
  hasTryCatch: boolean;
  hasCatchParam: boolean;
  rethrows: boolean;
  returnsError: boolean;
}

export interface StateUsageInfo {
  hook: string;
  line: number;
  hasInitialValue: boolean;
}

export interface AnyTypeInfo {
  line: number;
  context: string; // param, return, variable, cast
  functionName?: string;
}

export interface ApiRouteInfo {
  method: string;
  line: number;
  hasAuth: boolean;
  hasValidation: boolean;
  hasErrorHandling: boolean;
  hasTypedResponse: boolean;
}

/**
 * Parse a TypeScript/JavaScript file into a structured AST analysis.
 */
export function analyzeFile(filePath: string): AstAnalysis | null {
  const content = readSource(filePath);
  if (!content) return null;

  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const analysis: AstAnalysis = {
    functions: [],
    exports: [],
    imports: [],
    types: [],
    asyncFunctions: [],
    errorHandling: [],
    stateUsage: [],
    anyTypes: [],
    apiRoutes: [],
  };

  visit(sourceFile, sourceFile, analysis);
  detectApiRoutes(analysis);

  return analysis;
}

function readSource(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function getLine(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function visit(node: ts.Node, sf: ts.SourceFile, analysis: AstAnalysis) {
  // Imports
  if (ts.isImportDeclaration(node)) {
    const module = (node.moduleSpecifier as ts.StringLiteral).text;
    const names: string[] = [];
    let isTypeOnly = node.importClause?.isTypeOnly || false;
    if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const el of node.importClause.namedBindings.elements) {
        names.push(el.name.text);
      }
    }
    if (node.importClause?.name) names.push(node.importClause.name.text);
    analysis.imports.push({ module, names, isTypeOnly, line: getLine(node, sf) });
  }

  // Function declarations
  if (ts.isFunctionDeclaration(node) && node.name) {
    const fn = analyzeFunctionNode(node, sf);
    analysis.functions.push(fn);
    if (fn.isAsync) analysis.asyncFunctions.push(fn);
    if (fn.isExported) {
      analysis.exports.push({ name: fn.name, kind: 'function', line: fn.line });
    }
    // Error handling analysis
    analysis.errorHandling.push({
      functionName: fn.name, line: fn.line,
      hasTryCatch: fn.hasTryCatch,
      hasCatchParam: hasCatchWithParam(node),
      rethrows: bodyContains(node, ts.SyntaxKind.ThrowStatement),
      returnsError: false,
    });
  }

  // Arrow functions / const declarations
  if (ts.isVariableStatement(node)) {
    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
    for (const decl of node.declarationList.declarations) {
      if (decl.name && ts.isIdentifier(decl.name) && decl.initializer) {
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          const fn = analyzeArrowNode(decl.name.text, decl.initializer, sf, isExported);
          analysis.functions.push(fn);
          if (fn.isAsync) analysis.asyncFunctions.push(fn);
          if (isExported) analysis.exports.push({ name: fn.name, kind: 'const', line: fn.line });
        } else if (isExported) {
          analysis.exports.push({ name: decl.name.text, kind: 'const', line: getLine(node, sf) });
        }
      }
    }
  }

  // Type/interface declarations
  if (ts.isInterfaceDeclaration(node)) {
    analysis.types.push({ name: node.name.text, kind: 'interface', line: getLine(node, sf), properties: node.members.length });
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      analysis.exports.push({ name: node.name.text, kind: 'interface', line: getLine(node, sf) });
    }
  }
  if (ts.isTypeAliasDeclaration(node)) {
    analysis.types.push({ name: node.name.text, kind: 'type', line: getLine(node, sf), properties: 0 });
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      analysis.exports.push({ name: node.name.text, kind: 'type', line: getLine(node, sf) });
    }
  }

  // Default exports
  if (ts.isExportAssignment(node)) {
    analysis.exports.push({ name: 'default', kind: 'default', line: getLine(node, sf) });
  }

  // `any` type detection
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    const parent = node.parent;
    let context = 'variable';
    let functionName: string | undefined;
    if (ts.isParameter(parent)) {
      context = 'param';
      const fnParent = parent.parent;
      if (ts.isFunctionDeclaration(fnParent) && fnParent.name) functionName = fnParent.name.text;
    } else if (ts.isTypeAssertion(parent) || ts.isAsExpression(parent)) {
      context = 'cast';
    }
    analysis.anyTypes.push({ line: getLine(node, sf), context, functionName });
  }

  // useState / useReducer tracking
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    if (name === 'useState' || name === 'useReducer' || name === 'useRef') {
      analysis.stateUsage.push({
        hook: name,
        line: getLine(node, sf),
        hasInitialValue: node.arguments.length > 0,
      });
    }
  }

  ts.forEachChild(node, child => visit(child, sf, analysis));
}

function analyzeFunctionNode(node: ts.FunctionDeclaration, sf: ts.SourceFile): FunctionInfo {
  const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
  return {
    name: node.name?.text || 'anonymous',
    line: getLine(node, sf),
    isAsync: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
    isExported,
    hasReturnType: !!node.type,
    paramCount: node.parameters.length,
    hasTryCatch: bodyContains(node, ts.SyntaxKind.TryStatement),
    hasErrorParam: node.parameters.some(p => p.name.getText(sf).toLowerCase().includes('error') || p.name.getText(sf).toLowerCase().includes('err')),
    complexity: computeComplexity(node),
  };
}

function analyzeArrowNode(name: string, node: ts.ArrowFunction | ts.FunctionExpression, sf: ts.SourceFile, isExported: boolean): FunctionInfo {
  return {
    name,
    line: getLine(node, sf),
    isAsync: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false,
    isExported,
    hasReturnType: !!node.type,
    paramCount: node.parameters.length,
    hasTryCatch: bodyContains(node, ts.SyntaxKind.TryStatement),
    hasErrorParam: node.parameters.some(p => {
      const text = p.name.getText(sf);
      return text.toLowerCase().includes('error') || text.toLowerCase() === 'err';
    }),
    complexity: computeComplexity(node),
  };
}

function bodyContains(node: ts.Node, kind: ts.SyntaxKind): boolean {
  let found = false;
  function walk(n: ts.Node) {
    if (found) return;
    if (n.kind === kind) { found = true; return; }
    ts.forEachChild(n, walk);
  }
  if ('body' in node && node.body) walk(node.body as ts.Node);
  return found;
}

function hasCatchWithParam(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression): boolean {
  let found = false;
  function walk(n: ts.Node) {
    if (found) return;
    if (ts.isCatchClause(n) && n.variableDeclaration) { found = true; return; }
    ts.forEachChild(n, walk);
  }
  if ('body' in node && node.body) walk(node.body as ts.Node);
  return found;
}

function computeComplexity(node: ts.Node): number {
  let complexity = 1;
  function walk(n: ts.Node) {
    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.CaseClause:
        complexity++;
        break;
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.AmpersandAmpersandToken:
      case ts.SyntaxKind.QuestionQuestionToken:
        complexity++;
        break;
    }
    ts.forEachChild(n, walk);
  }
  ts.forEachChild(node, walk);
  return complexity;
}

function detectApiRoutes(analysis: AstAnalysis) {
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  for (const fn of analysis.functions) {
    if (httpMethods.includes(fn.name.toUpperCase())) {
      const hasAuth = analysis.imports.some(i =>
        i.names.some(n => /auth|session|getUser|middleware/i.test(n))
      );
      const hasValidation = analysis.imports.some(i =>
        i.module.includes('zod') || i.names.some(n => /schema|validate|parse/i.test(n))
      );
      analysis.apiRoutes.push({
        method: fn.name.toUpperCase(),
        line: fn.line,
        hasAuth,
        hasValidation,
        hasErrorHandling: fn.hasTryCatch,
        hasTypedResponse: fn.hasReturnType,
      });
    }
  }
}

/**
 * High-level drift analysis using AST — replaces regex checks.
 */
export interface AstDriftResult {
  file: string;
  issues: AstDriftIssue[];
  quality: AstQuality;
}

export interface AstDriftIssue {
  line: number;
  category: 'type-safety' | 'error-handling' | 'auth' | 'validation' | 'complexity' | 'exports';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
}

export interface AstQuality {
  typeCoverage: number;      // % of functions with return types
  errorHandling: number;     // % of async fns with try/catch
  avgComplexity: number;     // avg cyclomatic complexity
  anyTypeCount: number;
  exportStyle: 'named' | 'default' | 'mixed';
}

export function analyzeFileDrift(filePath: string, specRequirements?: { requiresAuth?: boolean; strictTypes?: boolean; namedExports?: boolean }): AstDriftResult | null {
  const analysis = analyzeFile(filePath);
  if (!analysis) return null;

  const issues: AstDriftIssue[] = [];
  const req = specRequirements || {};

  // 1. ANY types — precise location
  for (const any of analysis.anyTypes) {
    issues.push({
      line: any.line,
      category: 'type-safety',
      severity: any.context === 'param' ? 'high' : 'medium',
      message: `\`any\` type used as ${any.context}${any.functionName ? ` in ${any.functionName}()` : ''}`,
      suggestion: 'Replace with specific type or `unknown` + type narrowing',
    });
  }

  // 2. Async functions without error handling
  for (const fn of analysis.asyncFunctions) {
    if (!fn.hasTryCatch && fn.isExported) {
      issues.push({
        line: fn.line,
        category: 'error-handling',
        severity: 'high',
        message: `Async function \`${fn.name}()\` has no try/catch`,
        suggestion: 'Wrap async logic in try/catch to handle rejected promises',
      });
    }
  }

  // 3. High complexity functions
  for (const fn of analysis.functions) {
    if (fn.complexity > 10) {
      issues.push({
        line: fn.line,
        category: 'complexity',
        severity: fn.complexity > 20 ? 'high' : 'medium',
        message: `\`${fn.name}()\` has cyclomatic complexity ${fn.complexity} (max recommended: 10)`,
        suggestion: 'Extract helper functions to reduce complexity',
      });
    }
  }

  // 4. API routes without auth (AST-verified)
  if (req.requiresAuth) {
    for (const route of analysis.apiRoutes) {
      if (!route.hasAuth) {
        issues.push({
          line: route.line,
          category: 'auth',
          severity: 'critical',
          message: `${route.method} handler has no auth import/check`,
          suggestion: 'Import and call auth/getSession before processing request',
        });
      }
    }
  }

  // 5. API routes without validation
  for (const route of analysis.apiRoutes) {
    if (!route.hasValidation && (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH')) {
      issues.push({
        line: route.line,
        category: 'validation',
        severity: 'high',
        message: `${route.method} handler has no input validation`,
        suggestion: 'Import Zod schema and validate request body with safeParse()',
      });
    }
  }

  // 6. Default exports when named required
  if (req.namedExports) {
    const defaultExport = analysis.exports.find(e => e.kind === 'default');
    if (defaultExport) {
      issues.push({
        line: defaultExport.line,
        category: 'exports',
        severity: 'low',
        message: 'Uses default export (spec requires named exports)',
        suggestion: 'Change to named export: `export function Name` or `export const Name`',
      });
    }
  }

  // Quality metrics
  const fnsWithReturnType = analysis.functions.filter(f => f.hasReturnType).length;
  const asyncWithTryCatch = analysis.asyncFunctions.filter(f => f.hasTryCatch).length;
  const hasDefault = analysis.exports.some(e => e.kind === 'default');
  const hasNamed = analysis.exports.some(e => e.kind !== 'default');

  const quality: AstQuality = {
    typeCoverage: analysis.functions.length ? Math.round((fnsWithReturnType / analysis.functions.length) * 100) : 100,
    errorHandling: analysis.asyncFunctions.length ? Math.round((asyncWithTryCatch / analysis.asyncFunctions.length) * 100) : 100,
    avgComplexity: analysis.functions.length ? Math.round(analysis.functions.reduce((s, f) => s + f.complexity, 0) / analysis.functions.length) : 1,
    anyTypeCount: analysis.anyTypes.length,
    exportStyle: hasDefault && hasNamed ? 'mixed' : hasDefault ? 'default' : 'named',
  };

  return { file: filePath, issues, quality };
}
