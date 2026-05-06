import neo4j from 'neo4j-driver';
import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';

function mapBrand(m, extras = {}) {
  const id = m.idMarca;
  const nombre = m.nombre;
  return {
    ...m,
    id,
    idMarca: id,
    name: nombre,
    nombre,
    totalProductos: extras.totalProductos,
  };
}

function parseNonNegativeInt(value, fallback) {
  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, parsed);
}

export async function getBrands(req, res) {
  try {
    const result = await runQuery(
      `MATCH (m:Marca)
       OPTIONAL MATCH (p:Producto)-[:FABRICADO_POR]->(m)
       RETURN m, count(p) AS totalProductos
       ORDER BY m.nombre`
    );

    const brands = result.records.map(r => {
      const m = recordToObject(r).m;
      return mapBrand(m, { totalProductos: toNativeNumber(r.get('totalProductos')) });
    });

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

    res.json({ data: { ...mapBrand(marca), productos } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBrandProducts(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.max(1, parseNonNegativeInt(req.query.limit, 20));
    const skip = parseNonNegativeInt(req.query.skip, 0);

    const result = await runQuery(
      `MATCH (m:Marca {idMarca: $id})<-[:FABRICADO_POR]-(p:Producto)
       RETURN p
       ORDER BY p.nombre
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { id, limit: neo4j.int(limit), skip: neo4j.int(skip) }
    );

    const products = result.records.map(r => recordToObject(r).p);
    res.json({ data: products, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
