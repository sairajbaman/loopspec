import { createContext } from '../../context.js';
import { buildGraph, loadGraph, impactAnalysis, queryGraph } from '../../engines/graph/index.js';
import { log, severity } from '../output.js';

export async function runGraphCommand(positional: string[], _flags: Record<string, string | boolean>) {
  const ctx = createContext();
  const action = positional[0] || 'build';

  switch (action) {
    case 'build': {
      log(`${severity('info')} Building project graph...`);
      const graph = await buildGraph(ctx);
      log(`${severity('ok')} Graph built: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      log(`  Files: ${graph.nodes.filter(n => n.type === 'file').length}`);
      log(`  Functions: ${graph.nodes.filter(n => n.type === 'function').length}`);
      log(`  Types: ${graph.nodes.filter(n => n.type === 'type').length}`);
      log(`  Components: ${graph.nodes.filter(n => n.type === 'component').length}`);
      log(`  Routes: ${graph.nodes.filter(n => n.type === 'route').length}`);
      break;
    }
    case 'impact': {
      const file = positional[1];
      if (!file) { log('Usage: loopspec graph impact <file>'); return; }
      let graph = await loadGraph(ctx);
      if (!graph) { graph = await buildGraph(ctx); }
      const result = impactAnalysis(graph, file);
      log(`\n${result.summary}\n`);
      break;
    }
    case 'query': {
      const query = positional[1];
      if (!query) { log('Usage: loopspec graph query "<name>"'); return; }
      let graph = await loadGraph(ctx);
      if (!graph) { graph = await buildGraph(ctx); }
      const results = queryGraph(graph, query);
      log(`\n  Results for "${query}" (${results.length}):\n`);
      for (const n of results.slice(0, 15)) {
        log(`  [${n.type}] ${n.name} — ${n.file}${n.line ? `:${n.line}` : ''}`);
      }
      log('');
      break;
    }
    default:
      log('Usage: loopspec graph [build|impact|query] [args]');
  }
}
