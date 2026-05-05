import 'dotenv/config';
import { runQuery } from '../config/neo4j.js';

const indexes = [
  'CREATE INDEX producto_nombre IF NOT EXISTS FOR (p:Producto) ON (p.nombre)',
  'CREATE INDEX producto_categoria IF NOT EXISTS FOR (p:Producto) ON (p.categoria)',
  'CREATE INDEX producto_precio IF NOT EXISTS FOR (p:Producto) ON (p.precio)',
  'CREATE INDEX producto_disponible IF NOT EXISTS FOR (p:Producto) ON (p.disponible)',
  'CREATE INDEX usuario_correo IF NOT EXISTS FOR (u:Usuario) ON (u.correo)',
  'CREATE INDEX pedido_estado IF NOT EXISTS FOR (p:Pedido) ON (p.estado)',
  'CREATE INDEX marca_nombre IF NOT EXISTS FOR (m:Marca) ON (m.nombre)',
];

export async function createIndexes() {
  for (const cypher of indexes) {
    await runQuery(cypher);
    const name = cypher.match(/INDEX (\w+)/)?.[1] ?? cypher;
    console.log(`  ✓ ${name}`);
  }
  console.log(`Índices creados: ${indexes.length}`);
}

if (process.argv[1].endsWith('indexes.js')) {
  createIndexes().then(() => process.exit(0)).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
