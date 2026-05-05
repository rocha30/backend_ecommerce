import { importNodesFromCSV, importRelationshipsFromCSV } from '../database/csvImport.js';

export async function importNodes(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo CSV' });
    }
    const result = await importNodesFromCSV(req.file.buffer);
    res.json({
      message: 'Importación de nodos completada',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function importRelationships(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere un archivo CSV' });
    }
    const result = await importRelationshipsFromCSV(req.file.buffer);
    res.json({
      message: 'Importación de relaciones completada',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
