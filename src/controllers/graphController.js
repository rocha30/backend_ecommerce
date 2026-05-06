import { runQuery, toNativeNumber } from '../config/neo4j.js';
import { checkConnectivity } from '../database/connectivityCheck.js';
import { runDiagnostics } from '../database/diagnostics.js';

export async function getConnectivity(req, res) {
  try {
    const result = await checkConnectivity();
    res.json({
      ...result,
      isolatedCount: result.isolatedNodeCount ?? result.isolatedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDiagnostics(req, res) {
  try {
    const result = await runDiagnostics();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getNodeCount(req, res) {
  try {
    const result = await runQuery('MATCH (n) RETURN count(n) AS totalNodos');
    const total = toNativeNumber(result.records[0].get('totalNodos'));
    res.json({
      totalNodos: total,
      count: total,
      total,
      nodeCount: total,
      nodes: total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getLabelCounts(req, res) {
  try {
    const result = await runQuery(
      'MATCH (n) UNWIND labels(n) AS label RETURN label, count(n) AS total ORDER BY total DESC'
    );
    const labels = result.records.map(r => ({
      label: r.get('label'),
      total: toNativeNumber(r.get('total')),
    }));
    res.json({
      data: labels,
      labels,
      items: labels,
      totalLabels: labels.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRelationshipTypes(req, res) {
  try {
    const result = await runQuery(
      'MATCH ()-[r]->() RETURN type(r) AS tipoRelacion, count(r) AS total ORDER BY tipoRelacion'
    );
    const types = result.records.map(r => ({
      tipoRelacion: r.get('tipoRelacion'),
      total: toNativeNumber(r.get('total')),
    }));
    const totalRelationships = types.reduce((s, t) => s + t.total, 0);
    res.json({
      data: types,
      types,
      totalRelationships,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
