import { Router } from 'express';
import multer from 'multer';
import { getHealth, getNeo4jHealth } from '../controllers/healthController.js';
import { getProducts, getProductById, getProductRecommendations, getCategorias } from '../controllers/productsController.js';
import { getBrands, getBrandById, getBrandProducts } from '../controllers/brandsController.js';
import { getConnectivity, getDiagnostics, getNodeCount, getLabelCounts, getRelationshipTypes } from '../controllers/graphController.js';
import { importNodes, importRelationships } from '../controllers/importController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/health', getHealth);
router.get('/health/neo4j', getNeo4jHealth);

router.get('/products', getProducts);
router.get('/products/categorias', getCategorias);
router.get('/products/:id', getProductById);
router.get('/products/:id/recommendations', getProductRecommendations);

router.get('/brands', getBrands);
router.get('/brands/:id', getBrandById);
router.get('/brands/:id/products', getBrandProducts);

router.get('/graph/diagnostics/connectivity', getConnectivity);
router.get('/graph/diagnostics', getDiagnostics);
router.get('/graph/nodes/count', getNodeCount);
router.get('/graph/nodes/labels', getLabelCounts);
router.get('/graph/relationships/types', getRelationshipTypes);

router.post('/import/csv/nodes', upload.single('file'), importNodes);
router.post('/import/csv/relationships', upload.single('file'), importRelationships);

export default router;
