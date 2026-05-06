export async function getRubricStatus(req, res) {
  res.json({
    ok: true,
    proyecto: 'watch-store-backend',
    endpoints: {
      tienda: ['/products', '/products/categorias', '/brands', '/products/:id'],
      usuarios: ['/users/:idUsuario/cart', '/users/:idUsuario/wishlist/items'],
      grafo: ['/graph/nodes/count', '/query'],
    },
  });
}
