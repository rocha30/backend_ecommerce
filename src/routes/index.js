import { Router } from 'express';
import multer from 'multer';
import { getHealth, getNeo4jHealth } from '../controllers/healthController.js';
import { getProducts, getProductById, getProductRecommendations, getCategorias } from '../controllers/productsController.js';
import { getBrands, getBrandById, getBrandProducts } from '../controllers/brandsController.js';
import { getConnectivity, getDiagnostics, getNodeCount, getLabelCounts, getRelationshipTypes } from '../controllers/graphController.js';
import { importNodes, importRelationships } from '../controllers/importController.js';
import { runQuery } from '../config/neo4j.js';
import {
  listNodes, getNodeByElementId, createNode,
  updateNodeProperties, bulkUpdateNodeProperties,
  removeNodeProperties, bulkRemoveNodeProperties,
  deleteNode, bulkDeleteNodes,
} from '../controllers/nodesController.js';
import {
  listRelationships, createRelationship,
  updateRelationshipProperties, bulkUpdateRelationshipProperties,
  removeRelationshipProperties, bulkRemoveRelationshipProperties,
  deleteRelationship, bulkDeleteRelationships,
} from '../controllers/relationshipsController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Cypher query runner (read-only, for the demo Consultas tab) ────────────
function convertForJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  if (typeof val === 'object' && val.toString && val.constructor?.name?.match(/Date|Time/)) return val.toString();
  if (Array.isArray(val)) return val.map(convertForJson);
  if (typeof val === 'object' && val.properties) {
    const out = {};
    for (const k of Object.keys(val.properties)) out[k] = convertForJson(val.properties[k]);
    return out;
  }
  return val;
}

async function runCypherQuery(req, res) {
  try {
    const { cypher } = req.body;
    if (!cypher || typeof cypher !== 'string') return res.status(400).json({ error: 'cypher requerido' });
    // Block write operations — only MATCH/RETURN queries allowed here
    const tokens = cypher.toUpperCase().split(/\s+|[^A-Z]/);
    const writeKeywords = ['DELETE', 'DETACH', 'DROP', 'CREATE', 'MERGE', 'REMOVE'];
    const hasWrite = writeKeywords.some(kw => tokens.includes(kw));
    if (hasWrite) {
      return res.status(403).json({ error: 'Solo se permiten consultas de lectura (MATCH/RETURN)' });
    }
    const result = await runQuery(cypher);
    const data = result.records.map(r => {
      const obj = {};
      for (const key of r.keys) obj[key] = convertForJson(r.get(key));
      return obj;
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Health ─────────────────────────────────────────────────────────────────
router.get('/health', getHealth);
router.get('/health/neo4j', getNeo4jHealth);

// ── Products (store) ───────────────────────────────────────────────────────
router.get('/products', getProducts);
router.get('/products/categorias', getCategorias);
router.get('/products/:id', getProductById);
router.get('/products/:id/recommendations', getProductRecommendations);

// ── Brands (store) ─────────────────────────────────────────────────────────
router.get('/brands', getBrands);
router.get('/brands/:id', getBrandById);
router.get('/brands/:id/products', getBrandProducts);

// ── Graph diagnostics ──────────────────────────────────────────────────────
router.get('/graph/diagnostics/connectivity', getConnectivity);
router.get('/graph/diagnostics', getDiagnostics);
router.get('/graph/nodes/count', getNodeCount);
router.get('/graph/nodes/labels', getLabelCounts);
router.get('/graph/relationships/types', getRelationshipTypes);

// ── CSV import ─────────────────────────────────────────────────────────────
router.post('/import/csv/nodes', upload.single('file'), importNodes);
router.post('/import/csv/relationships', upload.single('file'), importRelationships);

// ── Cypher demo queries ────────────────────────────────────────────────────
router.post('/query', runCypherQuery);

// ── Nodes CRUD — bulk routes before /:elementId to avoid routing conflicts ─
router.get('/nodes', listNodes);
router.post('/nodes', createNode);
router.patch('/nodes/bulk/properties', bulkUpdateNodeProperties);
router.delete('/nodes/bulk/properties', bulkRemoveNodeProperties);
router.delete('/nodes/bulk', bulkDeleteNodes);
router.get('/nodes/:elementId', getNodeByElementId);
router.patch('/nodes/:elementId/properties', updateNodeProperties);
router.delete('/nodes/:elementId/properties', removeNodeProperties);
router.delete('/nodes/:elementId', deleteNode);

// ── Relationships CRUD — bulk routes before /:elementId ───────────────────
router.get('/relationships', listRelationships);
router.post('/relationships', createRelationship);
router.patch('/relationships/bulk/properties', bulkUpdateRelationshipProperties);
router.delete('/relationships/bulk/properties', bulkRemoveRelationshipProperties);
router.delete('/relationships/bulk', bulkDeleteRelationships);
router.patch('/relationships/:elementId/properties', updateRelationshipProperties);
router.delete('/relationships/:elementId/properties', removeRelationshipProperties);
router.delete('/relationships/:elementId', deleteRelationship);

export default router;
