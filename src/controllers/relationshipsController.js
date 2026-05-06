import neo4j from 'neo4j-driver';
import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';
import { allowedRelationships, allowedLabels, relationshipSchemas } from '../models/graphSchema.js';

function safeKey(k) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k);
}

function extractRelationship(record) {
  const r = record.get('r');
  return {
    elementId: record.get('eid'),
    type: record.get('relType'),
    properties: r.properties ? Object.fromEntries(
      Object.entries(r.properties).map(([k, v]) => [k, convertProp(v)])
    ) : {},
    source: {
      elementId: record.get('srcEid'),
      labels: record.get('srcLabels'),
      id: record.get('srcId'),
    },
    target: {
      elementId: record.get('tgtEid'),
      labels: record.get('tgtLabels'),
      id: record.get('tgtId'),
    },
  };
}

function convertProp(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  if (typeof val === 'object' && val.toString && (val.constructor?.name?.includes('Date') || val.constructor?.name?.includes('Time'))) {
    return val.toString();
  }
  if (Array.isArray(val)) return val.map(convertProp);
  return val;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, parsed);
}

// GET /api/relationships
export async function listRelationships(req, res) {
  try {
    const { type, sourceLabel, targetLabel } = req.query;
    const limit = Math.max(1, parseNonNegativeInt(req.query.limit, 20));
    let skip = parseNonNegativeInt(req.query.skip, 0);
    const page = parseNonNegativeInt(req.query.page, 0);
    if (!Number.isNaN(page) && page > 0) {
      skip = (page - 1) * limit;
    }

    const params = { limit: neo4j.int(limit), skip: neo4j.int(skip) };
    const conditions = [];

    if (type) {
      if (!allowedRelationships.includes(type)) {
        return res.status(400).json({ error: `Tipo de relación '${type}' no permitido` });
      }
      conditions.push('type(r) = $type');
      params.type = type;
    }
    if (sourceLabel) conditions.push(`$sourceLabel IN labels(src)`);
    if (targetLabel) conditions.push(`$targetLabel IN labels(tgt)`);
    if (sourceLabel) params.sourceLabel = sourceLabel;
    if (targetLabel) params.targetLabel = targetLabel;

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      runQuery(
        `MATCH (src)-[r]->(tgt)
         ${whereClause}
         RETURN r,
                elementId(r) AS eid,
                type(r) AS relType,
                elementId(src) AS srcEid,
                labels(src) AS srcLabels,
                head([k IN keys(src) WHERE k STARTS WITH 'id']) AS srcIdKey,
                src[head([k IN keys(src) WHERE k STARTS WITH 'id'])] AS srcId,
                elementId(tgt) AS tgtEid,
                labels(tgt) AS tgtLabels,
                tgt[head([k IN keys(tgt) WHERE k STARTS WITH 'id'])] AS tgtId
         ORDER BY elementId(r)
         SKIP toInteger($skip) LIMIT toInteger($limit)`,
        params
      ),
      runQuery(
        `MATCH (src)-[r]->(tgt) ${whereClause} RETURN count(r) AS total`,
        params
      ),
    ]);

    const relationships = dataResult.records.map(r => extractRelationship(r));
    const total = toNativeNumber(countResult.records[0].get('total'));
    const currentPage = page > 0 ? page : Math.floor(skip / limit) + 1;
    res.json({
      data: relationships,
      total,
      meta: {
        page: currentPage,
        limit,
        skip,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/relationships — create relationship with type and 3+ properties
export async function createRelationship(req, res) {
  try {
    const { sourceElementId, targetElementId, type, properties } = req.body;

    if (!sourceElementId || !targetElementId) {
      return res.status(400).json({ error: 'sourceElementId y targetElementId son requeridos' });
    }
    if (!type || !allowedRelationships.includes(type)) {
      return res.status(400).json({ error: `Tipo de relación '${type}' no está permitido` });
    }
    if (!properties || Object.keys(properties).length < 3) {
      return res.status(400).json({ error: 'La relación debe tener al menos 3 propiedades' });
    }

    const result = await runQuery(
      `MATCH (src), (tgt)
       WHERE elementId(src) = $sourceElementId AND elementId(tgt) = $targetElementId
       CREATE (src)-[r:${type}]->(tgt)
       SET r += $props
       RETURN r,
              elementId(r) AS eid,
              type(r) AS relType,
              elementId(src) AS srcEid,
              labels(src) AS srcLabels,
              src[head([k IN keys(src) WHERE k STARTS WITH 'id'])] AS srcId,
              elementId(tgt) AS tgtEid,
              labels(tgt) AS tgtLabels,
              tgt[head([k IN keys(tgt) WHERE k STARTS WITH 'id'])] AS tgtId`,
      { sourceElementId, targetElementId, props: properties }
    );

    if (!result.records.length) {
      return res.status(404).json({ error: 'No se encontraron los nodos origen o destino' });
    }

    res.status(201).json({ data: extractRelationship(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/relationships/:elementId/properties — add/update properties on one relationship
export async function updateRelationshipProperties(req, res) {
  try {
    const { elementId } = req.params;
    const { properties } = req.body;

    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return res.status(400).json({ error: 'Se requiere un objeto properties' });
    }

    const result = await runQuery(
      `MATCH ()-[r]->()
       WHERE elementId(r) = $elementId
       SET r += $props
       RETURN r,
              elementId(r) AS eid,
              type(r) AS relType,
              elementId(startNode(r)) AS srcEid,
              labels(startNode(r)) AS srcLabels,
              startNode(r)[head([k IN keys(startNode(r)) WHERE k STARTS WITH 'id'])] AS srcId,
              elementId(endNode(r)) AS tgtEid,
              labels(endNode(r)) AS tgtLabels,
              endNode(r)[head([k IN keys(endNode(r)) WHERE k STARTS WITH 'id'])] AS tgtId`,
      { elementId, props: properties }
    );

    if (!result.records.length) return res.status(404).json({ error: 'Relación no encontrada' });
    res.json({ data: extractRelationship(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/relationships/bulk/properties — add/update properties on multiple relationships
export async function bulkUpdateRelationshipProperties(req, res) {
  try {
    const { elementIds, properties } = req.body;

    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'elementIds debe ser un array no vacío' });
    }
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return res.status(400).json({ error: 'Se requiere un objeto properties' });
    }

    const result = await runQuery(
      `MATCH ()-[r]->()
       WHERE elementId(r) IN $elementIds
       SET r += $props
       RETURN count(r) AS affected`,
      { elementIds, props: properties }
    );

    res.json({ affected: toNativeNumber(result.records[0].get('affected')) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/relationships/:elementId/properties — remove specific properties from one relationship
export async function removeRelationshipProperties(req, res) {
  try {
    const { elementId } = req.params;
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys debe ser un array no vacío' });
    }
    if (!keys.every(safeKey)) {
      return res.status(400).json({ error: 'Nombres de propiedad contienen caracteres inválidos' });
    }

    const removeClause = keys.map(k => `r.${k}`).join(', ');
    const result = await runQuery(
      `MATCH ()-[r]->()
       WHERE elementId(r) = $elementId
       REMOVE ${removeClause}
       RETURN r,
              elementId(r) AS eid,
              type(r) AS relType,
              elementId(startNode(r)) AS srcEid,
              labels(startNode(r)) AS srcLabels,
              startNode(r)[head([k IN keys(startNode(r)) WHERE k STARTS WITH 'id'])] AS srcId,
              elementId(endNode(r)) AS tgtEid,
              labels(endNode(r)) AS tgtLabels,
              endNode(r)[head([k IN keys(endNode(r)) WHERE k STARTS WITH 'id'])] AS tgtId`,
      { elementId }
    );

    if (!result.records.length) return res.status(404).json({ error: 'Relación no encontrada' });
    res.json({ data: extractRelationship(result.records[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/relationships/bulk/properties — remove properties from multiple relationships
export async function bulkRemoveRelationshipProperties(req, res) {
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

    const removeClause = keys.map(k => `r.${k}`).join(', ');
    const result = await runQuery(
      `MATCH ()-[r]->()
       WHERE elementId(r) IN $elementIds
       REMOVE ${removeClause}
       RETURN count(r) AS affected`,
      { elementIds }
    );

    res.json({ affected: toNativeNumber(result.records[0].get('affected')) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/relationships/:elementId — delete a single relationship
export async function deleteRelationship(req, res) {
  try {
    const { elementId } = req.params;

    const check = await runQuery(
      'MATCH ()-[r]->() WHERE elementId(r) = $elementId RETURN elementId(r) AS eid',
      { elementId }
    );
    if (!check.records.length) return res.status(404).json({ error: 'Relación no encontrada' });

    await runQuery(
      'MATCH ()-[r]->() WHERE elementId(r) = $elementId DELETE r',
      { elementId }
    );

    res.json({ message: 'Relación eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/relationships/bulk — delete multiple relationships
export async function bulkDeleteRelationships(req, res) {
  try {
    const { elementIds } = req.body;

    if (!Array.isArray(elementIds) || elementIds.length === 0) {
      return res.status(400).json({ error: 'elementIds debe ser un array no vacío' });
    }

    const countResult = await runQuery(
      'MATCH ()-[r]->() WHERE elementId(r) IN $elementIds RETURN count(r) AS total',
      { elementIds }
    );
    const total = toNativeNumber(countResult.records[0].get('total'));

    await runQuery(
      'MATCH ()-[r]->() WHERE elementId(r) IN $elementIds DELETE r',
      { elementIds }
    );

    res.json({ deleted: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
