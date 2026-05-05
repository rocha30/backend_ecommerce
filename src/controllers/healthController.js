import { runQuery } from '../config/neo4j.js';

export async function getHealth(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function getNeo4jHealth(req, res) {
  try {
    const result = await runQuery('RETURN 1 AS ok');
    const ok = result.records[0].get('ok').toNumber();
    res.json({ status: 'ok', neo4j: ok === 1, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
}
