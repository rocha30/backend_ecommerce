import { Router } from 'express';
import multer from 'multer';
import { getHealth, getNeo4jHealth } from '../controllers/healthController.js';
import {
  getProducts,
  getProductById,
  getProductRecommendations,
  getProductRecommendationsForUser,
  getCategorias,
  getProductReviews,
  getProductRelated,
} from '../controllers/productsController.js';
import { getBrands, getBrandById, getBrandProducts } from '../controllers/brandsController.js';
import { getConnectivity, getDiagnostics, getNodeCount, getLabelCounts, getRelationshipTypes } from '../controllers/graphController.js';
import { importNodes, importRelationships } from '../controllers/importController.js';
import { runQueryEndpoint } from '../controllers/queryController.js';
import { getRubricStatus } from '../controllers/rubricController.js';
import {
  recordProductView,
  getCart,
  postCartItem,
  patchCartItem,
  deleteCartItem,
  clearCart,
  getWishlistItems,
  postWishlistItem,
  deleteWishlistItem,
  createOrder,
  createReview,
  getUserRecommendations,
} from '../controllers/usersController.js';
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

// ── Health ─────────────────────────────────────────────────────────────────
router.get('/health', getHealth);
router.get('/health/neo4j', getNeo4jHealth);

// ── Rubric (opcional) ───────────────────────────────────────────────────────
router.get('/rubric/status', getRubricStatus);

// ── Products — rutas estáticas antes de /products/:id ───────────────────────
router.get('/products', getProducts);
router.get('/products/categorias', getCategorias);
router.get('/products/recommendations', getProductRecommendationsForUser);
router.get('/products/:id/reviews', getProductReviews);
router.get('/products/:id/related', getProductRelated);
router.get('/products/:id/recommendations', getProductRecommendations);
router.get('/products/:id', getProductById);

// ── Brands ───────────────────────────────────────────────────────────────────
router.get('/brands', getBrands);
router.get('/brands/:id', getBrandById);
router.get('/brands/:id/products', getBrandProducts);

// ── Users (carrito, wishlist, pedidos, tracking) ────────────────────────────
router.post('/users/:idUsuario/views/:idProducto', recordProductView);
router.get('/users/:idUsuario/cart', getCart);
router.delete('/users/:idUsuario/cart/items', clearCart);
router.post('/users/:idUsuario/cart/items', postCartItem);
router.patch('/users/:idUsuario/cart/items/:idProducto', patchCartItem);
router.delete('/users/:idUsuario/cart/items/:idProducto', deleteCartItem);
router.get('/users/:idUsuario/wishlist/items', getWishlistItems);
router.post('/users/:idUsuario/wishlist/items', postWishlistItem);
router.delete('/users/:idUsuario/wishlist/items/:idProducto', deleteWishlistItem);
router.post('/users/:idUsuario/orders', createOrder);
router.post('/users/:idUsuario/reviews', createReview);
router.get('/users/:idUsuario/recommendations', getUserRecommendations);

// ── Graph diagnostics ──────────────────────────────────────────────────────
router.get('/graph/diagnostics/connectivity', getConnectivity);
router.get('/graph/diagnostics', getDiagnostics);
router.get('/graph/nodes/count', getNodeCount);
router.get('/graph/nodes/labels', getLabelCounts);
router.get('/graph/relationships/types', getRelationshipTypes);

// ── CSV import ─────────────────────────────────────────────────────────────
router.post('/import/csv/nodes', upload.single('file'), importNodes);
router.post('/import/csv/relationships', upload.single('file'), importRelationships);

// ── Cypher / presets (POST body: { preset } o { cypher }) ───────────────────
router.post('/query', runQueryEndpoint);

// ── Nodes CRUD — bulk routes before /:elementId ────────────────────────────
router.get('/nodes', listNodes);
router.post('/nodes', createNode);
router.patch('/nodes/bulk/properties', bulkUpdateNodeProperties);
router.delete('/nodes/bulk/properties', bulkRemoveNodeProperties);
router.delete('/nodes/bulk', bulkDeleteNodes);
router.get('/nodes/:elementId', getNodeByElementId);
router.patch('/nodes/:elementId/properties', updateNodeProperties);
router.delete('/nodes/:elementId/properties', removeNodeProperties);
router.delete('/nodes/:elementId', deleteNode);

// ── Relationships CRUD — bulk routes before /:elementId ─────────────────────
router.get('/relationships', listRelationships);
router.post('/relationships', createRelationship);
router.patch('/relationships/bulk/properties', bulkUpdateRelationshipProperties);
router.delete('/relationships/bulk/properties', bulkRemoveRelationshipProperties);
router.delete('/relationships/bulk', bulkDeleteRelationships);
router.patch('/relationships/:elementId/properties', updateRelationshipProperties);
router.delete('/relationships/:elementId/properties', removeRelationshipProperties);
router.delete('/relationships/:elementId', deleteRelationship);

export default router;
