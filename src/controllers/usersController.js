import neo4j from 'neo4j-driver';
import { runQuery, recordToObject, toNativeNumber } from '../config/neo4j.js';
import { mapProductForFront } from '../utils/productMapper.js';
import { getProductRecommendationsForUser } from './productsController.js';

function bodyProductId(body) {
  return body?.idProducto ?? body?.productId ?? body?.product_id;
}

function bodyQty(body, fallback = 1) {
  const q = body?.cantidad ?? body?.quantity ?? body?.qty;
  const n = parseInt(q, 10);
  return Number.isNaN(n) ? fallback : Math.max(1, n);
}

function normalizeUserId(rawUserId) {
  const userId = String(rawUserId || '').trim();
  const m = /^USR-(\d{1,5})$/i.exec(userId);
  if (!m) return userId;
  return `USR-${m[1].padStart(5, '0')}`;
}

async function ensureUsuario(userId) {
  const r = await runQuery('MATCH (u:Usuario {idUsuario: $userId}) RETURN u', { userId });
  return r.records.length > 0;
}

async function getActiveCartNode(userId) {
  const r = await runQuery(
    `MATCH (u:Usuario {idUsuario: $userId})-[:POSEE_CARRITO]->(c:Carrito)
     WHERE c.estado = 'activo'
     RETURN c ORDER BY c.fechaActualizacion DESC LIMIT 1`,
    { userId }
  );
  if (r.records.length === 0) return null;
  return recordToObject(r.records[0]).c;
}

async function getOrCreateActiveCart(userId) {
  let cart = await getActiveCartNode(userId);
  if (cart) return cart;

  const cartId = `CART-API-${userId.replace(/[^A-Za-z0-9-]/g, '')}`;
  await runQuery(
    `MATCH (u:Usuario {idUsuario: $userId})
     MERGE (c:Carrito {idCarrito: $cartId})
     ON CREATE SET
       c.fechaCreacion = datetime(),
       c.fechaActualizacion = datetime(),
       c.estado = 'activo',
       c.cantidadItems = 0,
       c.subtotal = 0.0
     ON MATCH SET
       c.fechaActualizacion = datetime(),
       c.estado = 'activo',
       c.cantidadItems = coalesce(c.cantidadItems, 0),
       c.subtotal = coalesce(c.subtotal, 0.0)
     MERGE (u)-[pc:POSEE_CARRITO]->(c)
     ON CREATE SET pc.fechaCreacion = datetime(), pc.activo = true, pc.origen = 'api'
     ON MATCH SET pc.activo = true
     RETURN c`,
    { userId, cartId }
  );
  const again = await getActiveCartNode(userId);
  return again || { idCarrito: cartId };
}

async function getDefaultWishlist(userId) {
  const r = await runQuery(
    `MATCH (u:Usuario {idUsuario: $userId})-[:POSEE_LISTA]->(l:ListaDeseos)
     RETURN l ORDER BY l.fechaCreacion ASC LIMIT 1`,
    { userId }
  );
  if (r.records.length) return recordToObject(r.records[0]).l;

  const idLista = `LIST-WISH-${userId.replace(/[^A-Za-z0-9-]/g, '')}`;
  await runQuery(
    `MATCH (u:Usuario {idUsuario: $userId})
     CREATE (l:ListaDeseos {
       idLista: $idLista,
       nombre: 'Wishlist',
       publica: false,
       fechaCreacion: date(),
       descripcion: 'Lista principal',
       cantidadItems: 0
     })
     CREATE (u)-[:POSEE_LISTA {fechaCreacion: date(), rol: 'propietario', activa: true}]->(l)
     RETURN l`,
    { userId, idLista }
  );
  const r2 = await runQuery(
    `MATCH (l:ListaDeseos {idLista: $idLista}) RETURN l`,
    { idLista }
  );
  return recordToObject(r2.records[0]).l;
}

function cartItemsPayload(records) {
  const items = records.map(rec => {
    const rel = rec.get('r');
    const pr = recordToObject(rec).p;
    const marcaNombre = rec.get('marcaNombre');
    const marcaId = rec.get('marcaId');
    const cantidad = toNativeNumber(rel.properties.cantidad);
    const precioUnitario = Number(rel.properties.precioUnitario ?? pr.precio);
    const descuento = Number(rel.properties.descuento ?? 0);
    const product = mapProductForFront(pr, { marcaNombre, marcaId });
    return {
      cantidad,
      quantity: cantidad,
      precioUnitario,
      descuento,
      // Keep nested object and expose flat fields for frontend compatibility.
      product,
      producto: product,
      id: product.id,
      idProducto: pr.idProducto,
      name: product.name,
      nombre: product.nombre,
      image: product.image,
      price: product.price,
      precio: product.precio,
      originalPrice: product.originalPrice,
      precioOriginal: product.precioOriginal,
      discount: product.discount,
      categoria: product.categoria,
      marcaNombre: product.marcaNombre,
    };
  });

  const subtotal = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  return { items, subtotal };
}

export async function recordProductView(req, res) {
  try {
    const { idProducto } = req.params;
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const seconds = Number(req.body?.secondsOnPage ?? req.body?.seconds ?? 0);

    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await runQuery(
      `MATCH (u:Usuario {idUsuario: $idUsuario}), (p:Producto {idProducto: $idProducto})
       MERGE (u)-[v:VIO]->(p)
       ON CREATE SET v.veces = 1, v.ultimaVez = datetime(), v.segundosEnPagina = $seconds
       ON MATCH SET v.veces = coalesce(v.veces, 0) + 1, v.ultimaVez = datetime(),
                    v.segundosEnPagina = coalesce(v.segundosEnPagina, 0) + $seconds`,
      { idUsuario, idProducto, seconds: neo4j.int(Math.floor(seconds)) }
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getCart(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getActiveCartNode(idUsuario);
    if (!cart) {
      return res.json({ data: { idCarrito: null, items: [], subtotal: 0 } });
    }

    const r = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN r, p, m.nombre AS marcaNombre, m.idMarca AS marcaId
       ORDER BY p.nombre`,
      { idCarrito: cart.idCarrito }
    );

    const { items, subtotal } = cartItemsPayload(r.records);
    res.json({
      data: {
        idCarrito: cart.idCarrito,
        items,
        subtotal,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function postCartItem(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const pid = bodyProductId(req.body);
    const addQty = bodyQty(req.body, 1);

    if (!pid) return res.status(400).json({ error: 'idProducto requerido' });
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getOrCreateActiveCart(idUsuario);
    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito}), (p:Producto {idProducto: $pid})
       MERGE (c)-[r:CONTIENE]->(p)
       ON CREATE SET r.cantidad = $qty, r.precioUnitario = p.precio, r.descuento = 0.0
       ON MATCH SET r.cantidad = coalesce(r.cantidad, 0) + $qty, r.precioUnitario = p.precio`,
      { idCarrito: cart.idCarrito, pid, qty: neo4j.int(addQty) }
    );

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(:Producto)
       WITH c, sum(r.cantidad * r.precioUnitario) AS sub, count(r) AS n
       SET c.subtotal = sub, c.cantidadItems = n, c.fechaActualizacion = datetime()`,
      { idCarrito: cart.idCarrito }
    ).catch(() => {});

    const full = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN r, p, m.nombre AS marcaNombre, m.idMarca AS marcaId`,
      { idCarrito: cart.idCarrito }
    );

    const { items, subtotal } = cartItemsPayload(full.records);
    res.status(201).json({ data: { idCarrito: cart.idCarrito, items, subtotal } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function patchCartItem(req, res) {
  try {
    const { idProducto } = req.params;
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const qty = bodyQty(req.body, 1);

    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getOrCreateActiveCart(idUsuario);
    const r = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto {idProducto: $idProducto})
       SET r.cantidad = $qty
       RETURN r`,
      { idCarrito: cart.idCarrito, idProducto, qty: neo4j.int(qty) }
    );

    if (r.records.length === 0) {
      return res.status(404).json({ error: 'Ítem no encontrado en carrito' });
    }

    const full = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN r, p, m.nombre AS marcaNombre, m.idMarca AS marcaId`,
      { idCarrito: cart.idCarrito }
    );
    const { items, subtotal } = cartItemsPayload(full.records);
    res.json({ data: { idCarrito: cart.idCarrito, items, subtotal } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteCartItem(req, res) {
  try {
    const { idProducto } = req.params;
    const idUsuario = normalizeUserId(req.params.idUsuario);
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getActiveCartNode(idUsuario);
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto {idProducto: $idProducto})
       DELETE r`,
      { idCarrito: cart.idCarrito, idProducto }
    );

    const full = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN r, p, m.nombre AS marcaNombre, m.idMarca AS marcaId`,
      { idCarrito: cart.idCarrito }
    );
    const { items, subtotal } = cartItemsPayload(full.records);
    res.json({ data: { idCarrito: cart.idCarrito, items, subtotal } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function clearCart(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getActiveCartNode(idUsuario);
    if (!cart) {
      return res.json({ data: { idCarrito: null, items: [], subtotal: 0 } });
    }

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(:Producto)
       DELETE r`,
      { idCarrito: cart.idCarrito }
    );

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})
       SET c.subtotal = 0.0, c.cantidadItems = 0, c.fechaActualizacion = datetime()`,
      { idCarrito: cart.idCarrito }
    );

    res.json({ data: { idCarrito: cart.idCarrito, items: [], subtotal: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getWishlistItems(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const r = await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId})-[:POSEE_LISTA]->(l:ListaDeseos)-[t:TIENE_ITEM]->(p:Producto)
       OPTIONAL MATCH (p)-[:FABRICADO_POR]->(m:Marca)
       RETURN DISTINCT p, m.nombre AS marcaNombre, m.idMarca AS marcaId, t
       ORDER BY t.fechaAgregado DESC`,
      { userId: idUsuario }
    );

    const items = r.records.map(rec => ({
      added: recordToObject(rec).t?.properties,
      product: mapProductForFront(recordToObject(rec).p, {
        marcaNombre: rec.get('marcaNombre'),
        marcaId: rec.get('marcaId'),
      }),
    }));

    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function postWishlistItem(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const pid = bodyProductId(req.body);
    if (!pid) return res.status(400).json({ error: 'idProducto requerido' });
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const lista = await getDefaultWishlist(idUsuario);
    await runQuery(
      `MATCH (l:ListaDeseos {idLista: $idLista}), (p:Producto {idProducto: $pid})
       MERGE (l)-[t:TIENE_ITEM]->(p)
       ON CREATE SET t.fechaAgregado = date(), t.prioridad = 1, t.notas = ''`,
      { idLista: lista.idLista, pid }
    );

    await runQuery(
      `MATCH (l:ListaDeseos {idLista: $idLista})-[:TIENE_ITEM]->(p:Producto)
       WITH l, count(p) AS n SET l.cantidadItems = n`,
      { idLista: lista.idLista }
    );

    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteWishlistItem(req, res) {
  try {
    const { idProducto } = req.params;
    const idUsuario = normalizeUserId(req.params.idUsuario);
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId})-[:POSEE_LISTA]->(l:ListaDeseos)-[t:TIENE_ITEM]->(p:Producto {idProducto: $idProducto})
       DELETE t`,
      { userId: idUsuario, idProducto }
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createOrder(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const direccion = req.body?.direccionEnvio ?? req.body?.address ?? 'Sin dirección';

    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cart = await getActiveCartNode(idUsuario);
    if (!cart) {
      return res.status(400).json({ error: 'Carrito vacío o inexistente' });
    }

    const lines = await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       RETURN r, p`,
      { idCarrito: cart.idCarrito }
    );

    if (lines.records.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío' });
    }

    let total = 0;
    for (const rec of lines.records) {
      const r = rec.get('r').properties;
      const p = recordToObject(rec).p;
      const cant = toNativeNumber(r.cantidad);
      const pu = Number(r.precioUnitario ?? p.precio);
      total += cant * pu;
    }

    const idPedido = `PED-API-${Date.now()}`;
    await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId})
       CREATE (ped:Pedido {
         idPedido: $idPedido,
         fechaPedido: datetime(),
         montoTotal: $total,
         estado: 'pendiente',
         pagado: false,
         direccionEnvio: $direccion
       })
       CREATE (u)-[:REALIZO_PEDIDO {fecha: datetime(), canal: 'web', estado: 'creado'}]->(ped)`,
      { userId: idUsuario, idPedido, total, direccion }
    );

    await runQuery(
      `MATCH (ped:Pedido {idPedido: $idPedido}), (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(p:Producto)
       CREATE (ped)-[:CONTIENE {cantidad: r.cantidad, precioUnitario: r.precioUnitario, descuento: r.descuento}]->(p)`,
      { idPedido, idCarrito: cart.idCarrito }
    );

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})-[r:CONTIENE]->(:Producto) DELETE r`,
      { idCarrito: cart.idCarrito }
    );

    await runQuery(
      `MATCH (c:Carrito {idCarrito: $idCarrito})
       SET c.estado = 'convertido', c.subtotal = 0.0, c.cantidadItems = 0, c.fechaActualizacion = datetime()`,
      { idCarrito: cart.idCarrito }
    );

    res.status(201).json({ data: { idPedido, montoTotal: total, estado: 'pendiente' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createReview(req, res) {
  try {
    const idUsuario = normalizeUserId(req.params.idUsuario);
    const pid = bodyProductId(req.body);
    const calificacion = parseInt(req.body?.calificacion ?? req.body?.rating ?? 5, 10);
    const titulo = req.body?.titulo ?? req.body?.title ?? 'Reseña';
    const comentario = req.body?.comentario ?? req.body?.comment ?? '';

    if (!pid) return res.status(400).json({ error: 'idProducto requerido' });
    if (!(await ensureUsuario(idUsuario))) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const idResena = `RES-API-${Date.now()}`;
    await runQuery(
      `MATCH (u:Usuario {idUsuario: $userId}), (p:Producto {idProducto: $pid})
       CREATE (r:Resena {
         idResena: $idResena,
         calificacion: $calificacion,
         titulo: $titulo,
         comentario: $comentario,
         fechaCreacion: date(),
         verificada: false
       })
       CREATE (u)-[:ESCRIBIO_RESENA {fecha: date(), dispositivo: 'web', verificada: false}]->(r)
       CREATE (r)-[:RESENA_DE {fechaAsociacion: date(), visible: true, utilidad: 0}]->(p)`,
      {
        userId: idUsuario,
        pid,
        idResena,
        calificacion: neo4j.int(Math.min(5, Math.max(1, calificacion))),
        titulo,
        comentario,
      }
    );

    res.status(201).json({ data: { idResena } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUserRecommendations(req, res) {
  req.query = { ...req.query, userId: normalizeUserId(req.params.idUsuario) };
  return getProductRecommendationsForUser(req, res);
}
