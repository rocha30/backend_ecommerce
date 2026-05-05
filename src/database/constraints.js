import 'dotenv/config';
import { runQuery } from '../config/neo4j.js';

const constraints = [
  'CREATE CONSTRAINT usuario_id IF NOT EXISTS FOR (n:Usuario) REQUIRE n.idUsuario IS UNIQUE',
  'CREATE CONSTRAINT pedido_id IF NOT EXISTS FOR (n:Pedido) REQUIRE n.idPedido IS UNIQUE',
  'CREATE CONSTRAINT lista_id IF NOT EXISTS FOR (n:ListaDeseos) REQUIRE n.idLista IS UNIQUE',
  'CREATE CONSTRAINT carrito_id IF NOT EXISTS FOR (n:Carrito) REQUIRE n.idCarrito IS UNIQUE',
  'CREATE CONSTRAINT producto_id IF NOT EXISTS FOR (n:Producto) REQUIRE n.idProducto IS UNIQUE',
  'CREATE CONSTRAINT marca_id IF NOT EXISTS FOR (n:Marca) REQUIRE n.idMarca IS UNIQUE',
  'CREATE CONSTRAINT resena_id IF NOT EXISTS FOR (n:Resena) REQUIRE n.idResena IS UNIQUE',
  'CREATE CONSTRAINT recomendacion_id IF NOT EXISTS FOR (n:Recomendacion) REQUIRE n.idRecomendacion IS UNIQUE',
];

export async function createConstraints() {
  for (const cypher of constraints) {
    await runQuery(cypher);
    const name = cypher.match(/CONSTRAINT (\w+)/)?.[1] ?? cypher;
    console.log(`  ✓ ${name}`);
  }
  console.log(`Constraints creados: ${constraints.length}`);
}

if (process.argv[1].endsWith('constraints.js')) {
  createConstraints().then(() => process.exit(0)).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
