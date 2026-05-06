import { toNativeNumber } from '../config/neo4j.js';

export function mapProductForFront(p, extras = {}) {
  if (!p) return null;
  const precio = typeof p.precio === 'number' ? p.precio : Number(p.precio ?? 0);
  const hasOriginal = p.precioOriginal != null && p.precioOriginal !== '';
  const original = hasOriginal
    ? Number(p.precioOriginal)
    : Math.round(precio * 1.12 * 100) / 100;
  const discount =
    p.descuento != null && p.descuento !== ''
      ? Number(p.descuento)
      : original > precio
        ? Math.round((1 - precio / original) * 100)
        : 0;

  const id = p.idProducto ?? p.id;
  const image =
    p.imagen ??
    p.image ??
    `https://picsum.photos/seed/${encodeURIComponent(String(id))}/400/400`;
  const description =
    p.descripcion ??
    p.description ??
    (p.nombre ? `${p.nombre}${p.categoria ? ` — ${p.categoria}` : ''}.` : '');

  return {
    id,
    idProducto: id,
    name: p.nombre,
    nombre: p.nombre,
    price: precio,
    precio,
    originalPrice: original,
    precioOriginal: original,
    image,
    descripcion: description,
    description,
    discount,
    descuento: discount,
    stock: p.stock != null ? toNativeNumber(p.stock) : p.stock,
    disponible: p.disponible,
    categoria: p.categoria,
    marcaNombre: extras.marcaNombre ?? p.marcaNombre,
    marcaId: extras.marcaId ?? p.marcaId,
  };
}
