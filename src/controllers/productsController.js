import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';

export async function getProducts(req, res) {
  try {
    const { categoria, disponible, marca, limit = 50, skip = 0, search } = req.query;

    let filters = [];
    const params = {
      limit: parseInt(limit),
      skip: parseInt(skip),
    };

    if (categoria) { filters.push('p.categoria = $categoria'); params.categoria = categoria; }
    if (disponible !== undefined) { filters.push('p.disponible = $disponible'); params.disponible = disponible === 'true'; }
    if (search) { filters.push('toLower(p.nombre) CONTAINS toLower($search)'); params.search = search; }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const marcaMatch = marca ? `MATCH (p)-[:FABRICADO_POR]->(m:Marca {nombre: $marca})` : 'OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)';
    if (marca) params.marca = marca;

    const cypher = `
      MATCH (p:Producto)
      ${whereClause}
      ${marcaMatch}
      RETURN p, m.nombre AS marcaNombre, m.idMarca AS marcaId
      ORDER BY p.ordenDisplayCategoria, p.nombre
      SKIP $skip LIMIT $limit
    `;

    const result = await runQuery(cypher, params);
    const products = result.records.map(r => {
      const p = recordToObject(r);
      return {
        ...p.p,
        marcaNombre: r.get('marcaNombre'),
        marcaId: r.get('marcaId'),
      };
    });

    res.json({ data: products, count: products.length });
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
    const resenas = (record.get('resenas') || []).map(r => r ? { ...r.properties } : null).filter(Boolean);

    res.json({ data: { ...prod.p, marca, resenas } });
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
       RETURN similar, m.nombre AS marcaNombre
       LIMIT 6`,
      { id }
    );

    const products = result.records.map(r => ({
      ...recordToObject(r).similar,
      marcaNombre: r.get('marcaNombre'),
    }));

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
    const categorias = result.records.map(r => ({
      categoria: r.get('categoria'),
      total: toNativeNumber(r.get('total')),
    }));
    res.json({ data: categorias });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
