import 'dotenv/config';
import { createInterface } from 'readline';
import { runQuery, closeDriver } from '../config/neo4j.js';

async function clear() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  await new Promise((resolve, reject) => {
    rl.question(
      '¿Seguro que deseas borrar TODOS los datos de la base de datos? Escribe "CONFIRMAR" para continuar: ',
      async (answer) => {
        rl.close();
        if (answer.trim() !== 'CONFIRMAR') {
          console.log('Operación cancelada.');
          resolve();
          return;
        }
        try {
          let deleted = 0;
          let batch = 1;
          do {
            const result = await runQuery(
              'MATCH (n) WITH n LIMIT 1000 DETACH DELETE n RETURN count(n) AS deleted'
            );
            deleted = result.records[0].get('deleted').toNumber();
            console.log(`  Lote ${batch}: ${deleted} nodos eliminados`);
            batch++;
          } while (deleted > 0);
          console.log('Base de datos limpiada.');
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

clear().then(() => closeDriver()).then(() => process.exit(0)).catch(err => {
  console.error(err.message);
  closeDriver().then(() => process.exit(1));
});
