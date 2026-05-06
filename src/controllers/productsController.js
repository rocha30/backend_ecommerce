import neo4j from 'neo4j-driver';
import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';
import { mapProductForFront } from '../utils/productMapper.js';

function parseBool(q) {
  if (q === undefined || q === null || q === '') return null;
  if (typeof q === 'boolean') return q;
  const s = String(q).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return null;
}

function collectProductRows(records) {
  return records.map(r => {
    const raw = recordToObject(r);
    const p = raw.p ?? raw.similar ?? raw.rel ?? raw.rec;
    const marcaNombre = r.get('marcaNombre');
    const marcaId = r.get('marcaId');
    return mapProductForFront(p, { marcaNombre, marcaId });
  });
}

function parseNonNegativeInt(value, fallback) {
  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, parsed);
}

export async function getProducts(req, res) {
  try {
    const q = req.query;
    const limit = Math.min(Math.max(1, parseNonNegativeInt(q.limit, 50)), 200);
    let skip = parseNonNegativeInt(q.skip, 0);
    const page = parseNonNegativeInt(q.page, 0);
    if (!Number.isNaN(page) && page > 0) {
      skip = (page - 1) * limit;
    }

    const search = q.search || null;
    const brand = q.brand || q.marca || null;
    const category = q.category || q.categoria || null;
    const minPrice = q.minPrice !== undefined && q.minPrice !== '' ? Number(q.minPrice) : null;
    const maxPrice = q.maxPrice !== undefined && q.maxPrice !== '' ? Number(q.maxPrice) : null;
    const available = parseBool(q.available ?? q.disponible);

    const params = {
      limit: neo4j.int(limit),
      skip: neo4j.int(skip),
      search,
      brand,
      category,
      minPrice,
      maxPrice,
      available,
    };

    const whereParts = [
      '($search IS NULL OR toLower(p.nombre) CONTAINS toLower($search))',
      '($category IS NULL OR p.categoria = $category)',
      '($minPrice IS NULL OR p.precio >= $minPrice)',
      '($maxPrice IS NULL OR p.precio <= $maxPrice)',
      '($available IS NULL OR p.disponible = $available)',
      '($brand IS NULL OR (m IS NOT NULL AND (m.idMarca = $brand OR toLower(m.nombre) = toLower($brand))))',
    ];

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const baseMatch = `
      MATCH (p:Producto)
      OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
      ${whereClause}
    `;

    const countCypher = `${baseMatch} RETURN count(DISTINCT p) AS total`;
    const listCypher = `
      ${baseMatch}
      RETURN DISTINCT p, m.nombre AS marcaNombre, m.idMarca AS marcaId
      ORDER BY p.ordenDisplayCategoria, p.nombre
      SKIP toInteger($skip) LIMIT toInteger($limit)
    `;

    const [countResult, listResult] = await Promise.all([
      runQuery(countCypher, params),
      runQuery(listCypher, params),
    ]);

    const total = toNativeNumber(countResult.records[0].get('total'));
    const products = collectProductRows(listResult.records);
    const currentPage = page > 0 ? page : Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit) || 0;

    res.json({
      data: products,
      meta: {
        page: currentPage,
        limit,
        total,
        totalPages,
        skip,
      },
      count: products.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const result = await runQuery(
      `MATCH (p:Producto {idProducto: $id})
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       OPTIONAL MATCH (res:Resena)-[:RESENA_DE]->(p)
       RETURN p, m, collect(res)[0..5] AS resenas`,
      { id }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const record = result.records[0];
    const prod = recordToObject(record);
    const marca = record.get('m') ? { ...record.get('m').properties } : null;
    const resenasRaw = (record.get('resenas') || []).map(r => (r ? { ...r.properties } : null)).filter(Boolean);

    const item = mapProductForFront(prod.p, {
      marcaNombre: marca?.nombre,
      marcaId: marca?.idMarca,
    });

    res.json({
      data: {
        ...item,
        marca,
        resenas: resenasRaw,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProductRecommendations(req, res) {
  try {
    const { id } = req.params;
    const result = await runQuery(
      `MATCH (p:Producto {idProducto: $id})-[:SIMILAR_A]->(similar:Producto)
       OPTIONAL MATCH (similar)-[:FABRICADO_POR]->(m:Marca)
       RETURN similar, m.nombre AS marcaNombre, m.idMarca AS marcaId
       LIMIT 12`,
      { id }
    );

    const products = collectProductRows(result.records);
    res.json({ data: products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProductRecommendationsForUser(req, res) {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Query userId es requerido' });
    }

    const primary = await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId})-[:RECIBE_RECOMENDACION]->(rec:Recomendacion)-[:RECOMIENDA]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId, rec.score AS ord
       ORDER BY ord DESC
       LIMIT 24`,
      { userId }
    );

    let records = primary.records;
    if (records.length === 0) {
      const fallback = await runQuery(
        `MATCH (u:Usuario {idUsuario: $userId})-[:COMPRO|VIO]->(p0:Producto)<-[:COMPRO|VIO]-(u2:Usuario)-[:COMPRO|VIO]->(p:Producto)
         WHERE u2.idUsuario <> $userId AND NOT (u)-[:COMPRO|VIO]->(p)
         OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
         WITH p, m, count(*) AS co
         RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId, co
         ORDER BY co DESC
         LIMIT 24`,
        { userId }
      );
      records = fallback.records;
    }

    const products = collectProductRows(records);
    res.json({ data: products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProductReviews(req, res) {
  try {
    const { id } = req.params;
    const result = await runQuery(
      `MATCH (p:Producto {idProducto: $id})<-[:RESENA_DE]-(r:Resena)<-[:ESCRIBIO_RESENA]-(u:Usuario)
       RETURN r, u.nombre AS autorNombre
       ORDER BY r.fechaCreacion DESC`,
      { id }
    );

    const data = result.records.map(rec => {
      const r = recordToObject(rec).r;
      return {
        id: r.idResena,
        idResena: r.idResena,
        rating: toNativeNumber(r.calificacion),
        calificacion: toNativeNumber(r.calificacion),
        title: r.titulo,
        titulo: r.titulo,
        comment: r.comentario,
        comentario: r.comentario,
        authorName: rec.get('autorNombre'),
        fecha: r.fechaCreacion,
        fechaCreacion: r.fechaCreacion,
        verified: r.verificada,
        verificada: r.verificada,
      };
    });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProductRelated(req, res) {
  try {
    const { id } = req.params;
    const result = await runQuery(
      `MATCH (seed:Producto {idProducto: $id})
       MATCH (seed)-[rel:SIMILAR_A|SE_COMPRA_CON]-(other:Producto)
       WHERE other.idProducto <> $id
       OPTIONAL MATCH (other)-[:FABRICADO_POR]->(m:Marca)
       RETURN DISTINCT other AS p, m.nombre AS marcaNombre, m.idMarca AS marcaId
       LIMIT 12`,
      { id }
    );

    const products = collectProductRows(result.records);
    res.json({ data: products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getCategorias(req, res) {
  try {
    const result = await runQuery(
      `MATCH (p:Producto)
       RETURN p.categoria AS categoria, count(p) AS total
       ORDER BY total DESC`
    );
    const categorias = result.records.map(r => {
      const nombre = r.get('categoria');
      return {
        id: nombre,
        idCategoria: nombre,
        nombre,
        name: nombre,
        total: toNativeNumber(r.get('total')),
      };
    });
    res.json({ data: categorias });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
