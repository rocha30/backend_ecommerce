import { runQuery } from '../config/neo4j.js';

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

const PRESETS = {
  topViewedProducts: () =>
    `MATCH (u:Usuario)-[v:VIO]->(p:Producto)
     RETURN p.idProducto AS idProducto, p.nombre AS nombre, sum(coalesce(v.veces, 1)) AS vistas
     ORDER BY vistas DESC LIMIT 25`,

  topCartProducts: () =>
    `MATCH (c:Carrito)-[r:CONTIENE]->(p:Producto)
     RETURN p.idProducto AS idProducto, p.nombre AS nombre, sum(r.cantidad) AS enCarritos
     ORDER BY enCarritos DESC LIMIT 25`,

  topWishlistProducts: () =>
    `MATCH (l:ListaDeseos)-[t:TIENE_ITEM]->(p:Producto)
     RETURN p.idProducto AS idProducto, p.nombre AS nombre, count(t) AS enWishlists
     ORDER BY enWishlists DESC LIMIT 25`,

  salesByBrand: () =>
    `MATCH (ped:Pedido)-[r:CONTIENE]->(pr:Producto)-[:FABRICADO_POR]->(m:Marca)
     RETURN m.idMarca AS idMarca, m.nombre AS marca, sum(r.cantidad * r.precioUnitario) AS ventas
     ORDER BY ventas DESC LIMIT 25`,

  reviewsByProduct: () =>
    `MATCH (p:Producto)<-[:RESENA_DE]-(res:Resena)
     RETURN p.idProducto AS idProducto, p.nombre AS nombre, count(res) AS resenas
     ORDER BY resenas DESC LIMIT 25`,

  userRecommendations: body => {
    const userId = body.userId;
    if (!userId || typeof userId !== 'string') {
      throw new Error('preset userRecommendations requiere userId en el body');
    }
    return {
      cypher: `MATCH (u:Usuario {idUsuario: $userId})-[:RECIBE_RECOMENDACION]->(rec:Recomendacion)-[:RECOMIENDA]->(p:Producto)
               OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
               RETURN p.idProducto AS idProducto, p.nombre AS nombre, rec.score AS score, m.nombre AS marca
               ORDER BY score DESC LIMIT 30`,
      params: { userId },
    };
  },
};

export async function runQueryEndpoint(req, res) {
  try {
    const { preset, cypher } = req.body || {};

    if (preset) {
      const fn = PRESETS[preset];
      if (!fn) {
        return res.status(400).json({ error: `preset desconocido: ${preset}` });
      }
      const out = typeof fn === 'function' ? fn(req.body) : fn;
      let query;
      let params = {};
      if (typeof out === 'string') {
        query = out;
      } else if (out && out.cypher) {
        query = out.cypher;
        params = out.params || {};
      } else {
        return res.status(500).json({ error: 'Preset mal configurado' });
      }
      const result = await runQuery(query, params);
      const data = result.records.map(r => {
        const obj = {};
        for (const key of r.keys) obj[key] = convertForJson(r.get(key));
        return obj;
      });
      return res.json({ data, preset });
    }

    if (!cypher || typeof cypher !== 'string') {
      return res.status(400).json({ error: 'Se requiere cypher o preset en el body' });
    }

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
