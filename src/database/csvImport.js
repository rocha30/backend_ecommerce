import { parse } from 'csv-parse/sync';
import { runQuery } from '../config/neo4j.js';
import { nodeSchemas, relationshipSchemas, allowedLabels, allowedRelationships } from '../models/graphSchema.js';
import { validateProperties } from '../utils/typeValidation.js';

export async function importNodesFromCSV(csvBuffer) {
  const rows = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const labels = (row.labels || '').split('|').map(l => l.trim()).filter(Boolean);
    const primaryLabel = labels[0];

    if (!primaryLabel || !allowedLabels.includes(primaryLabel)) {
      errors.push({ line: lineNum, error: `Label '${primaryLabel}' no permitida` });
      skipped++;
      continue;
    }

    const schema = nodeSchemas[primaryLabel];
    let props;
    try {
      props = JSON.parse(row.properties || '{}');
    } catch {
      errors.push({ line: lineNum, error: 'properties no es JSON válido' });
      skipped++;
      continue;
    }

    if (row.idField && row.idValue) {
      props[row.idField] = row.idValue;
    }

    const { converted, errors: typeErrors } = validateProperties(schema.properties, props);
    if (typeErrors.length > 0) {
      errors.push({ line: lineNum, error: typeErrors.join('; ') });
      skipped++;
      continue;
    }

    for (const req of schema.required) {
      if (converted[req] === undefined || converted[req] === null) {
        errors.push({ line: lineNum, error: `Propiedad requerida '${req}' falta` });
        skipped++;
        continue;
      }
    }

    const labelStr = labels.map(l => `:${l}`).join('');
    const idField = schema.idField;
    const idValue = converted[idField];

    if (!idValue) {
      errors.push({ line: lineNum, error: `Campo id '${idField}' requerido` });
      skipped++;
      continue;
    }

    try {
      const result = await runQuery(
        `MERGE (n${labelStr} {${idField}: $idValue})
         ON CREATE SET n += $props
         RETURN n`,
        { idValue, props: converted }
      );
      if (result.records.length > 0) created++;
    } catch (err) {
      errors.push({ line: lineNum, error: err.message });
      skipped++;
    }
  }

  return { created, skipped, errors, total: rows.length };
}

export async function importRelationshipsFromCSV(csvBuffer) {
  const rows = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    const { sourceLabel, sourceIdField, sourceIdValue, relationshipType, targetLabel, targetIdField, targetIdValue } = row;

    if (!allowedLabels.includes(sourceLabel)) {
      errors.push({ line: lineNum, error: `sourceLabel '${sourceLabel}' no permitida` });
      skipped++;
      continue;
    }
    if (!allowedLabels.includes(targetLabel)) {
      errors.push({ line: lineNum, error: `targetLabel '${targetLabel}' no permitida` });
      skipped++;
      continue;
    }
    if (!allowedRelationships.includes(relationshipType)) {
      errors.push({ line: lineNum, error: `relationshipType '${relationshipType}' no permitido` });
      skipped++;
      continue;
    }

    let props;
    try {
      props = JSON.parse(row.properties || '{}');
    } catch {
      errors.push({ line: lineNum, error: 'properties no es JSON válido' });
      skipped++;
      continue;
    }

    if (Object.keys(props).length < 3) {
      errors.push({ line: lineNum, error: `La relación debe tener al menos 3 propiedades, tiene ${Object.keys(props).length}` });
      skipped++;
      continue;
    }

    const relSchema = relationshipSchemas[relationshipType];
    const { converted, errors: typeErrors } = validateProperties(relSchema.properties, props);
    if (typeErrors.length > 0) {
      errors.push({ line: lineNum, error: typeErrors.join('; ') });
      skipped++;
      continue;
    }

    try {
      const result = await runQuery(
        `MATCH (src:${sourceLabel} {${sourceIdField}: $srcId}), (tgt:${targetLabel} {${targetIdField}: $tgtId})
         CREATE (src)-[r:${relationshipType}]->(tgt)
         SET r += $props
         RETURN r`,
        { srcId: sourceIdValue, tgtId: targetIdValue, props: converted }
      );
      if (result.records.length > 0) created++;
      else {
        errors.push({ line: lineNum, error: 'No se encontraron los nodos origen o destino' });
        skipped++;
      }
    } catch (err) {
      errors.push({ line: lineNum, error: err.message });
      skipped++;
    }
  }

  return { created, skipped, errors, total: rows.length };
}
