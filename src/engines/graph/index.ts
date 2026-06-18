import path from 'node:path';
import fs from 'node:fs';
import type { AppContext } from '../../context.js';

export interface GraphNode {
  id: string;
  type: 'file' | 'function' | 'type' | 'route' | 'component' | 'table';
  name: string;
  file: string;
  line?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'references' | 'extends' | 'implements';
}

export interface ProjectGraph { nodes: GraphNode[]; edges: GraphEdge[]; }

export interface ImpactResult {
  changed: string;
  affected: { node: GraphNode; via: string }[];
  summary: string;
}

const IGNORE = ['node_modules', '.git', 'dist', '.next', 'build', '.loopspec'];
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue'];

export async function buildGraph(ctx: AppContext): Promise<ProjectGraph> {
  const graph: ProjectGraph = { nodes: [], edges: [] };
  const files = walk(ctx.projectDir);

  for (const file of files) {
    const rel = path.relative(ctx.projectDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    graph.nodes.push({ id: `file:${rel}`, type: 'file', name: path.basename(file), file: rel });

    let m: RegExpExecArray | null;

    // Export functions/components
    const funcRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
    while ((m = funcRe.exec(content))) {
      const t = /^[A-Z]/.test(m[1]) ? 'component' : 'function';
      graph.nodes.push({ id: `${t}:${rel}:${m[1]}`, type: t as any, name: m[1], file: rel, line: content.slice(0, m.index).split('\n').length });
    }

    // Export types/interfaces
    const typeRe = /export\s+(?:type|interface)\s+(\w+)/g;
    while ((m = typeRe.exec(content))) {
      graph.nodes.push({ id: `type:${rel}:${m[1]}`, type: 'type', name: m[1], file: rel });
    }

    // Routes (Next.js app router)
    if (rel.includes('route') || rel.includes('api')) {
      const routeRe = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/gi;
      while ((m = routeRe.exec(content))) {
        const method = m[1].toUpperCase();
        const rp = '/' + rel.replace(/^(src\/|app\/)/, '').replace(/\/route\.(ts|js)$/, '');
        graph.nodes.push({ id: `route:${method}:${rp}`, type: 'route', name: `${method} ${rp}`, file: rel });
      }
    }

    // Import edges
    const impRe = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm;
    while ((m = impRe.exec(content))) {
      const from = m[3];
      if (from.startsWith('.')) {
        const resolved = resolve(rel, from);
        graph.edges.push({ source: `file:${rel}`, target: `file:${resolved}`, type: 'imports' });
        const names = (m[1] || m[2] || '').split(',').map(s => s.trim().split(' as ')[0].trim()).filter(Boolean);
        for (const n of names) {
          const target = graph.nodes.find(nd => nd.name === n && nd.file === resolved);
          if (target) graph.edges.push({ source: `file:${rel}`, target: target.id, type: 'references' });
        }
      }
    }

    // Type reference edges
    const allTypes = graph.nodes.filter(n => n.type === 'type').map(n => n.name);
    const tRe = /:\s*([A-Z]\w+)(?:[\[\]<;,\s)])/g;
    while ((m = tRe.exec(content))) {
      if (allTypes.includes(m[1])) {
        const t = graph.nodes.find(n => n.type === 'type' && n.name === m[1] && n.file !== rel);
        if (t) graph.edges.push({ source: `file:${rel}`, target: t.id, type: 'references' });
      }
    }
  }

  // Persist
  const dir = path.join(ctx.loopspecDir, 'graph');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph, null, 2));
  try {
    const db = await ctx.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS graph_nodes (id TEXT PRIMARY KEY, type TEXT, name TEXT, file TEXT, line INTEGER);
             CREATE TABLE IF NOT EXISTS graph_edges (source TEXT, target TEXT, type TEXT);
             DELETE FROM graph_nodes; DELETE FROM graph_edges;`);
    const inN = db.prepare('INSERT INTO graph_nodes VALUES (?,?,?,?,?)');
    const inE = db.prepare('INSERT INTO graph_edges VALUES (?,?,?)');
    db.transaction(() => {
      for (const n of graph.nodes) inN.run(n.id, n.type, n.name, n.file, n.line || null);
      for (const e of graph.edges) inE.run(e.source, e.target, e.type);
    })();
  } catch {}

  return graph;
}

export function impactAnalysis(graph: ProjectGraph, changedFile: string): ImpactResult {
  const affected: { node: GraphNode; via: string }[] = [];
  const visited = new Set<string>();

  function trace(nodeId: string, depth: number) {
    if (visited.has(nodeId) || depth > 4) return;
    visited.add(nodeId);
    for (const e of graph.edges.filter(e => e.target === nodeId)) {
      const src = graph.nodes.find(n => n.id === e.source);
      if (src && src.file !== changedFile && !affected.find(a => a.node.file === src.file)) {
        affected.push({ node: src, via: e.type });
        trace(e.source, depth + 1);
      }
    }
  }

  trace(`file:${changedFile}`, 0);
  graph.nodes.filter(n => n.file === changedFile).forEach(n => trace(n.id, 0));

  const summary = affected.length === 0
    ? `No dependents for ${changedFile}.`
    : `${changedFile} affects ${affected.length} file(s):\n${affected.map(a => `  • ${a.node.file} (${a.via})`).join('\n')}`;
  return { changed: changedFile, affected, summary };
}

export function queryGraph(graph: ProjectGraph, query: string): GraphNode[] {
  const q = query.toLowerCase();
  return graph.nodes.filter(n => n.name.toLowerCase().includes(q) || n.file.toLowerCase().includes(q));
}

export async function loadGraph(ctx: AppContext): Promise<ProjectGraph | null> {
  try { return JSON.parse(fs.readFileSync(path.join(ctx.loopspecDir, 'graph', 'graph.json'), 'utf-8')); } catch { return null; }
}

function walk(dir: string): string[] {
  const r: string[] = [];
  (function w(d) {
    try { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (IGNORE.includes(e.name) || e.name.startsWith('.')) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) w(f); else if (EXTS.includes(path.extname(e.name))) r.push(f);
    }} catch {}
  })(dir);
  return r;
}

function resolve(from: string, imp: string): string {
  let r = path.posix.join(path.dirname(from).replace(/\\/g, '/'), imp);
  if (!path.extname(r)) r += '.ts';
  return r;
}
