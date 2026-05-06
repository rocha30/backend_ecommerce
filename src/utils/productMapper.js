import { toNativeNumber } from '../config/neo4j.js';

function categoryToImageTags(category) {
  const c = String(category ?? '').toLowerCase();
  if (c.includes('buceo')) return 'diver-watch';
  if (c.includes('lujo')) return 'luxury-watch';
  if (c.includes('clasico')) return 'classic-watch';
  if (c.includes('deportivo')) return 'sport-watch';
  if (c.includes('aviacion')) return 'pilot-watch';
  if (c.includes('cronografo')) return 'chronograph-watch';
  if (c.includes('skeleton')) return 'skeleton-watch';
  if (c.includes('smartwatch')) return 'smartwatch';
  if (c.includes('vintage')) return 'vintage-watch';
  if (c.includes('casual')) return 'wristwatch';
  return 'watch';
}

function stableHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

function fixedCategoryImage(category, seedNumber) {
  const c = String(category ?? '').toLowerCase();
  const deportivo = [
    'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=400&h=400&q=80',
    'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&w=400&h=400&q=80',
  ];
  const casual = [
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=400&h=400&q=80',
    'https://images.unsplash.com/photo-1434056886845-dac89ffe9b56?auto=format&fit=crop&w=400&h=400&q=80',
  ];

  if (c.includes('deportivo')) return deportivo[seedNumber % deportivo.length];
  if (c.includes('casual')) return casual[seedNumber % casual.length];
  return null;
}

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
  const imageTag = categoryToImageTags(p.categoria);
  const imageSig = stableHash(`${id ?? 'watch'}:${String(p.categoria ?? '')}`);
  const fixedImage = fixedCategoryImage(p.categoria, imageSig);
  // Category-aware watch photos using a simple image endpoint that works in <img>.
  const watchFallbackImage = `https://loremflickr.com/400/400/${imageTag}?lock=${imageSig}`;
  const image =
    p.imagen ??
    p.image ??
    fixedImage ??
    watchFallbackImage;
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
