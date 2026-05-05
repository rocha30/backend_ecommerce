import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';

export async function getBrands(req, res) {
  try {
    const result = await runQuery(
      `MATCH (m:Marca)
       OPTIONAL MATCH (p:Producto)-[:FABRICADO_POR]->(m)
       RETURN m, count(p) AS totalProductos
       ORDER BY m.nombre`
    );

    const brands = result.records.map(r => ({
      ...recordToObject(r).m,
      totalProductos: toNativeNumber(r.get('totalProductos')),
    }));

    res.json({ data: brands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBrandById(req, res) {
  try {
    const { id } = req.params;
    const result = await runQuery(
      `MATCH (m:Marca {idMarca: $id})
       OPTIONAL MATCH (p:Producto)-[:FABRICADO_POR]->(m)
       RETURN m, collect(p)[0..12] AS productos`,
      { id }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    const record = result.records[0];
    const marca = recordToObject(record).m;
    const productos = (record.get('productos') || []).map(p => p ? { ...p.properties } : null).filter(Boolean);

    res.json({ data: { ...marca, productos } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBrandProducts(req, res) {
  try {
    const { id } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const result = await runQuery(
      `MATCH (m:Marca {idMarca: $id})<-[:FABRICADO_POR]-(p:Producto)
       RETURN p
       ORDER BY p.nombre
       SKIP $skip LIMIT $limit`,
      { id, limit: parseInt(limit), skip: parseInt(skip) }
    );

    const products = result.records.map(r => recordToObject(r).p);
    res.json({ data: products, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
