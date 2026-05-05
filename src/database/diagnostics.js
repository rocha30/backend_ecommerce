import 'dotenv/config';
import { runQuery, toNativeNumber } from '../config/neo4j.js';
import { checkConnectivity } from './connectivityCheck.js';
import { closeDriver } from '../config/neo4j.js';

export async function runDiagnostics() {
  const results = {};

  const totalNodes = await runQuery('MATCH (n) RETURN count(n) AS total');
  results.totalNodes = toNativeNumber(totalNodes.records[0].get('total'));

  const totalRels = await runQuery('MATCH ()-[r]->() RETURN count(r) AS total');
  results.totalRelationships = toNativeNumber(totalRels.records[0].get('total'));

  const byLabel = await runQuery(
    'MATCH (n) UNWIND labels(n) AS label RETURN label, count(n) AS total ORDER BY total DESC'
  );
  results.nodesByLabel = byLabel.records.map(r => ({
    label: r.get('label'),
    total: toNativeNumber(r.get('total')),
  }));

  const byRel = await runQuery(
    'MATCH ()-[r]->() RETURN type(r) AS tipoRelacion, count(r) AS total ORDER BY tipoRelacion'
  );
  results.relationshipsByType = byRel.records.map(r => ({
    type: r.get('tipoRelacion'),
    total: toNativeNumber(r.get('total')),
  }));

  const relProps = await runQuery(
    `MATCH ()-[r]->()
     WITH type(r) AS tipo, keys(r) AS props
     RETURN tipo, min(size(props)) AS minimoPropiedades, count(*) AS total
     ORDER BY tipo`
  );
  results.relationshipProperties = relProps.records.map(r => ({
    type: r.get('tipo'),
    minProperties: toNativeNumber(r.get('minimoPropiedades')),
    total: toNativeNumber(r.get('total')),
  }));

  results.validations = {
    minNodes5000: results.totalNodes >= 5000,
    minLabels5: results.nodesByLabel.length >= 5,
    minRelTypes10: results.relationshipsByType.length >= 10,
    allRelsHave3Props: results.relationshipProperties.every(r => r.minProperties >= 3),
  };

  results.connectivity = await checkConnectivity();

  return results;
}

if (process.argv[1].endsWith('diagnostics.js')) {
  runDiagnostics().then(r => {
    console.log('\n=== DIAGNÓSTICO DEL GRAFO ===\n');
    console.log(`Total nodos:        ${r.totalNodes}`);
    console.log(`Total relaciones:   ${r.totalRelationships}`);
    console.log('\nNodos por label:');
    r.nodesByLabel.forEach(l => console.log(`  ${l.label}: ${l.total}`));
    console.log('\nRelaciones por tipo:');
    r.relationshipsByType.forEach(t => console.log(`  ${t.type}: ${t.total}`));
    console.log('\nPropiedades mínimas por relación:');
    r.relationshipProperties.forEach(t => {
      const ok = t.minProperties >= 3 ? '✓' : '✗';
      console.log(`  ${ok} ${t.type}: ${t.minProperties} props (${t.total} relaciones)`);
    });
    console.log('\nValidaciones de rúbrica:');
    console.log(`  ${r.validations.minNodes5000 ? '✓' : '✗'} >= 5000 nodos: ${r.totalNodes}`);
    console.log(`  ${r.validations.minLabels5 ? '✓' : '✗'} >= 5 labels: ${r.nodesByLabel.length}`);
    console.log(`  ${r.validations.minRelTypes10 ? '✓' : '✗'} >= 10 tipos de relación: ${r.relationshipsByType.length}`);
    console.log(`  ${r.validations.allRelsHave3Props ? '✓' : '✗'} Todas las relaciones tienen >= 3 props`);
    console.log('\nConectividad:');
    console.log(`  Conexo: ${r.connectivity.isConnected}`);
    console.log(`  Componentes: ${r.connectivity.componentCount}`);
    console.log(`  Nodos muestreados: ${r.connectivity.sampledNodes}`);
    console.log(`  Componente más grande: ${r.connectivity.largestComponentSize}`);
    console.log(`  Nodos aislados: ${r.connectivity.isolatedNodeCount}`);
  })
    .then(() => closeDriver())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.message);
      closeDriver().then(() => process.exit(1));
    });
}
