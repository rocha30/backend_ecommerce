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

function normalizeUserId(rawUserId) {
  const userId = String(rawUserId || '').trim();
  const m = /^USR-(\d{1,5})$/i.exec(userId);
  if (!m) return userId;
  return `USR-${m[1].padStart(5, '0')}`;
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
    const hasPaginationParams =
      q.limit !== undefined || q.page !== undefined || q.skip !== undefined;

    let limit = 0;
    let skip = 0;
    let page = 1;

    if (hasPaginationParams) {
      limit = Math.min(Math.max(1, parseNonNegativeInt(q.limit, 50)), 200);
      skip = parseNonNegativeInt(q.skip, 0);
      page = parseNonNegativeInt(q.page, 0);
      if (page > 0) {
        skip = (page - 1) * limit;
      }
    }

    const search = q.search || null;
    const brand = q.brand || q.marca || null;
    const category = q.category || q.categoria || null;
    const minPrice = q.minPrice !== undefined && q.minPrice !== '' ? Number(q.minPrice) : null;
    const maxPrice = q.maxPrice !== undefined && q.maxPrice !== '' ? Number(q.maxPrice) : null;
    const available = parseBool(q.available ?? q.disponible);

    const params = {
      search,
      brand,
      category,
      minPrice,
      maxPrice,
      available,
    };
    if (hasPaginationParams) {
      params.limit = neo4j.int(limit);
      params.skip = neo4j.int(skip);
    }

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
    const paginationClause = hasPaginationParams
      ? 'SKIP toInteger($skip) LIMIT toInteger($limit)'
      : '';
    const listCypher = `
      ${baseMatch}
      RETURN DISTINCT p, m.nombre AS marcaNombre, m.idMarca AS marcaId
      ORDER BY p.ordenDisplayCategoria, p.nombre
      ${paginationClause}
    `;

    const [countResult, listResult] = await Promise.all([
      runQuery(countCypher, params),
      runQuery(listCypher, params),
    ]);

    const total = toNativeNumber(countResult.records[0].get('total'));
    const products = collectProductRows(listResult.records);
    if (!hasPaginationParams) {
      limit = Math.max(products.length, 1);
      skip = 0;
      page = 1;
    }
    const currentPage = page > 0 ? page : 1;
    const totalPages = hasPaginationParams ? (Math.ceil(total / limit) || 0) : 1;

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
    const rawUserId = req.query.userId;
    if (!rawUserId) {
      return res.status(400).json({ error: 'Query userId es requerido' });
    }
    const userId = normalizeUserId(rawUserId);

    const realtime = await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId})
       CALL {
         WITH u
         OPTIONAL MATCH (u)-[:POSEE_LISTA]->(:ListaDeseos)-[w:TIENE_ITEM]->(p:Producto)
         WITH p, w
         ORDER BY coalesce(w.fechaAgregado, date('1970-01-01')) DESC
         LIMIT 20
         RETURN p AS seed, 30.0 AS weight
         UNION ALL
         WITH u
         OPTIONAL MATCH (u)-[:POSEE_CARRITO]->(:Carrito)-[c:CONTIENE]->(p:Producto)
         RETURN p AS seed, 25.0 + (toFloat(coalesce(c.cantidad, 1)) * 4.0) AS weight
         UNION ALL
         WITH u
         OPTIONAL MATCH (u)-[v:VIO]->(p:Producto)
         WITH p, v
         ORDER BY coalesce(v.ultimaVez, datetime('1970-01-01T00:00:00')) DESC
         LIMIT 25
         RETURN p AS seed,
                (
                  1.0 +
                  toFloat(
                    CASE
                      WHEN coalesce(v.veces, 1) > 3 THEN 3
                      ELSE coalesce(v.veces, 1)
                    END
                  ) +
                  CASE
                    WHEN v.ultimaVez >= datetime() - duration('PT6H') THEN 12.0
                    WHEN v.ultimaVez >= datetime() - duration('P1D') THEN 6.0
                    WHEN v.ultimaVez >= datetime() - duration('P3D') THEN 2.0
                    ELSE 0.0
                  END
                ) AS weight
         UNION ALL
         WITH u
         OPTIONAL MATCH (u)-[b:COMPRO]->(p:Producto)
         WITH p, b
         ORDER BY coalesce(b.fechaCompra, datetime('1970-01-01T00:00:00')) DESC
         LIMIT 15
         RETURN p AS seed,
                (
                  1.0 +
                  toFloat(
                    CASE
                      WHEN coalesce(b.cantidad, 1) > 2 THEN 2
                      ELSE coalesce(b.cantidad, 1)
                    END
                  ) +
                  CASE
                    WHEN b.fechaCompra >= datetime() - duration('P14D') THEN 3.0
                    ELSE 0.0
                  END
                ) AS weight
       }
       WITH u, seed, weight
       WHERE seed IS NOT NULL
       CALL {
         WITH seed, weight
         MATCH (seed)-[r:SIMILAR_A|SE_COMPRA_CON]-(cand:Producto)
         WHERE cand.idProducto <> seed.idProducto
         RETURN cand AS p, weight * coalesce(r.score, 1.5) * 3.0 AS score
         UNION ALL
         WITH seed, weight
         MATCH (seed)-[:FABRICADO_POR]->(m:Marca)<-[:FABRICADO_POR]-(cand:Producto)
         WHERE cand.idProducto <> seed.idProducto
         RETURN cand AS p, weight * 1.6 AS score
         UNION ALL
         WITH seed, weight
         MATCH (cand:Producto {categoria: seed.categoria})
         WHERE cand.idProducto <> seed.idProducto
         RETURN cand AS p, weight * 1.2 AS score
       }
       WITH u, p, sum(score) AS recScore
       WHERE recScore > 0
         AND NOT (u)-[:COMPRO]->(p)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId, recScore
       ORDER BY recScore DESC, p.nombre ASC
       LIMIT 24`,
      { userId }
    );

    let records = realtime.records;
    if (records.length === 0) {
      const primary = await runQuery(
        `MATCH (u:Usuario {idUsuario: $userId})-[:RECIBE_RECOMENDACION]->(rec:Recomendacion)-[:RECOMIENDA]->(p:Producto)
         OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
         RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId, rec.score AS ord
         ORDER BY ord DESC
         LIMIT 24`,
        { userId }
      );
      records = primary.records;
    }

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

    if (records.length === 0) {
      const generic = await runQuery(
        `MATCH (p:Producto)
         OPTIONAL MATCH (p)<-[v:VIO]-(:Usuario)
         OPTIONAL MATCH (p)<-[c:COMPRO]-(:Usuario)
         OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
         WITH p, m, count(v) + count(c) AS score
         RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId, score
         ORDER BY score DESC, p.ordenDisplayCategoria ASC, p.nombre ASC
         LIMIT 24`
      );
      records = generic.records;
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
