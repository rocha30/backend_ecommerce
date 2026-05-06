import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';
import { allowedLabels, nodeSchemas } from '../models/graphSchema.js';
import { validateProperties } from '../utils/typeValidation.js';

function safeKey(k) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k);
}

function extractNode(record) {
  return {
    elementId: record.get('eid'),
    labels: record.get('lbls'),
    properties: recordToObject(record).n,
  };
}

// GET /api/nodes
export async function listNodes(req, res) {
  try {
    const { label, search, limit = 20, skip = 0 } = req.query;
    const params = { limit: parseInt(limit), skip: parseInt(skip) };
    const conditions = [];

    let matchClause = 'MATCH (n)';
    if (label) {
      if (!allowedLabels.includes(label)) {
        return res.status(400).json({ error: `Label '${label}' no permitida` });
      }
      matchClause = `MATCH (n:${label})`;
    }

    if (search) {
      conditions.push('any(k IN keys(n) WHERE toLower(toString(n[k])) CONTAINS toLower($search))');
      params.search = search;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      runQuery(
        `${matchClause} ${whereClause}
         RETURN n, elementId(n) AS eid, labels(n) AS lbls
         ORDER BY elementId(n)
         SKIP $skip LIMIT $limit`,
        params
      ),
      runQuery(
        `${matchClause} ${whereClause} RETURN count(n) AS total`,
        { search: params.search }
      ),
    ]);

    const nodes = dataResult.records.map(r => extractNode(r));
    res.json({ data: nodes, total: toNativeNumber(countResult.records[0].get('total')) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/nodes/:elementId
export async function getNodeByElementId(req, res) {
  try {
    const { elementId } = req.params;
    const result = await runQuery(
      'MATCH (n) WHERE elementId(n) = $elementId RETURN n, elementId(n) AS eid, labels(n) AS lbls',
      { elementId }
    );
    if (!result.records.length) return res.status(404).json({ error: 'Nodo no encontrado' });
    res.json({ data: extractNode(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/nodes — supports 1 label or multiple labels
export async function createNode(req, res) {
  try {
    const { labels, properties } = req.body;

    if (!Array.isArray(labels) || labels.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un label en el array labels' });
    }

    const primaryLabel = labels[0];
    if (!allowedLabels.includes(primaryLabel)) {
      return res.status(400).json({ error: `Label primario '${primaryLabel}' no está permitido` });
    }

    const extraLabels = labels.slice(1).filter(l => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(l));

    const schema = nodeSchemas[primaryLabel];
    const { converted, errors } = validateProperties(schema.properties, properties || {});
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    if (!converted[schema.idField]) {
      return res.status(400).json({ error: `Propiedad ID '${schema.idField}' es requerida` });
    }

    const labelStr = [primaryLabel, ...extraLabels].map(l => `:${l}`).join('');

    const result = await runQuery(
      `CREATE (n${labelStr} $props) RETURN n, elementId(n) AS eid, labels(n) AS lbls`,
      { props: converted }
    );

    res.status(201).json({ data: extractNode(result.records[0]) });
  } catch (err) {
    if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
      return res.status(409).json({ error: 'Ya existe un nodo con ese ID (constraint violation)' });
    }
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/nodes/:elementId/properties — add or update properties on one node
export async function updateNodeProperties(req, res) {
  try {
    const { elementId } = req.params;
    const { properties } = req.body;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return res.status(400).json({ error: 'Se requiere un objeto properties' });
    }

    const result = await runQuery(
      `MATCH (n) WHERE elementId(n) = $elementId
       SET n += $props
       RETURN n, elementId(n) AS eid, labels(n) AS lbls`,
      { elementId, props: properties }
    );

    if (!result.records.length) return res.status(404).json({ error: 'Nodo no encontrado' });
    res.json({ data: extractNode(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/nodes/bulk/properties — add/update properties on multiple nodes
export async function bulkUpdateNodeProperties(req, res) {
  try {
    const { elementIds, properties } = req.body;

    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'elementIds debe ser un array no vacío' });
    }
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return res.status(400).json({ error: 'Se requiere un objeto properties' });
    }

    const result = await runQuery(
      `MATCH (n) WHERE elementId(n) IN $elementIds
       SET n += $props
       RETURN count(n) AS affected`,
      { elementIds, props: properties }
    );

    res.json({ affected: toNativeNumber(result.records[0].get('affected')) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/nodes/:elementId/properties — remove specific properties from one node
export async function removeNodeProperties(req, res) {
  try {
    const { elementId } = req.params;
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys debe ser un array no vacío' });
    }
    if (!keys.every(safeKey)) {
      return res.status(400).json({ error: 'Nombres de propiedad contienen caracteres inválidos' });
    }

    const removeClause = keys.map(k => `n.${k}`).join(', ');
    const result = await runQuery(
      `MATCH (n) WHERE elementId(n) = $elementId
       REMOVE ${removeClause}
       RETURN n, elementId(n) AS eid, labels(n) AS lbls`,
      { elementId }
    );

    if (!result.records.length) return res.status(404).json({ error: 'Nodo no encontrado' });
    res.json({ data: extractNode(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/nodes/bulk/properties — remove specific properties from multiple nodes
export async function bulkRemoveNodeProperties(req, res) {
  try {
    const { elementIds, keys } = req.body;

    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'elementIds debe ser un array no vacío' });
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys debe ser un array no vacío' });
    }
    if (!keys.every(safeKey)) {
      return res.status(400).json({ error: 'Nombres de propiedad contienen caracteres inválidos' });
    }

    const removeClause = keys.map(k => `n.${k}`).join(', ');
    const result = await runQuery(
      `MATCH (n) WHERE elementId(n) IN $elementIds
       REMOVE ${removeClause}
       RETURN count(n) AS affected`,
      { elementIds }
    );

    res.json({ affected: toNativeNumber(result.records[0].get('affected')) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/nodes/:elementId — delete a single node (detach)
export async function deleteNode(req, res) {
  try {
    const { elementId } = req.params;

    const check = await runQuery(
      'MATCH (n) WHERE elementId(n) = $elementId RETURN elementId(n) AS eid',
      { elementId }
    );
    if (!check.records.length) return res.status(404).json({ error: 'Nodo no encontrado' });

    await runQuery(
      'MATCH (n) WHERE elementId(n) = $elementId DETACH DELETE n',
      { elementId }
    );

    res.json({ message: 'Nodo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/nodes/bulk — delete multiple nodes (detach)
export async function bulkDeleteNodes(req, res) {
  try {
    const { elementIds } = req.body;

    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'elementIds debe ser un array no vacío' });
    }

    const countResult = await runQuery(
      'MATCH (n) WHERE elementId(n) IN $elementIds RETURN count(n) AS total',
      { elementIds }
    );
    const total = toNativeNumber(countResult.records[0].get('total'));

    await runQuery(
      'MATCH (n) WHERE elementId(n) IN $elementIds DETACH DELETE n',
      { elementIds }
    );

    res.json({ deleted: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
