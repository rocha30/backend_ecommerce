import { runQuery, toNativeNumber } from '../config/neo4j.js';

export async function checkConnectivity() {
  const nodeResult = await runQuery('MATCH (n) RETURN id(n) AS nid LIMIT 10000');
  const edgeResult = await runQuery(
    'MATCH (a)-[r]->(b) RETURN id(a) AS src, id(b) AS dst LIMIT 50000'
  );

  const nodeIds = nodeResult.records.map(r => toNativeNumber(r.get('nid')));
  const edges = edgeResult.records.map(r => ({
    src: toNativeNumber(r.get('src')),
    dst: toNativeNumber(r.get('dst')),
  }));

  if (nodeIds.length === 0) {
    return {
      isConnected: false,
      componentCount: 0,
      totalNodes: 0,
      largestComponentSize: 0,
      isolatedNodeCount: 0,
      sampleIsolatedNodes: [],
      note: 'No hay nodos en la base de datos',
    };
  }

  const adj = new Map();
  for (const nid of nodeIds) adj.set(nid, []);
  for (const { src, dst } of edges) {
    if (adj.has(src) && adj.has(dst)) {
      adj.get(src).push(dst);
      adj.get(dst).push(src);
    }
  }

  const visited = new Set();
  const components = [];

  for (const nid of nodeIds) {
    if (visited.has(nid)) continue;
    const component = [];
    const queue = [nid];
    visited.add(nid);
    while (queue.length > 0) {
      const curr = queue.shift();
      component.push(curr);
      for (const neighbor of (adj.get(curr) || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const largestComponent = components.reduce((a, b) => (a.length >= b.length ? a : b), []);
  const isolatedNodes = components.filter(c => c.length === 1).flat();

  const totalCountResult = await runQuery('MATCH (n) RETURN count(n) AS total');
  const totalNodes = toNativeNumber(totalCountResult.records[0].get('total'));

  return {
    isConnected: components.length === 1,
    componentCount: components.length,
    totalNodes,
    sampledNodes: nodeIds.length,
    largestComponentSize: largestComponent.length,
    isolatedNodeCount: isolatedNodes.length,
    sampleIsolatedNodes: isolatedNodes.slice(0, 5),
  };
}
