import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDriver } from './config/neo4j.js';
import { createConstraints } from './database/constraints.js';
import { createIndexes } from './database/indexes.js';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  try {
    getDriver();
    console.log('Conectando a Neo4j...');
    await createConstraints();
    await createIndexes();
    app.listen(PORT, () => {
      console.log(`Backend iniciado en http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Neo4j:  http://localhost:${PORT}/api/health/neo4j`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
