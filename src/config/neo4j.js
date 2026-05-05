import neo4j from 'neo4j-driver';
import 'dotenv/config';

let driver;

export function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error('NEO4J_URI, NEO4J_USERNAME y NEO4J_PASSWORD son requeridas en .env');
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 10000,
    });
  }
  return driver;
}

export function getSession() {
  const database = process.env.NEO4J_DATABASE || 'neo4j';
  return getDriver().session({ database });
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function runQuery(cypher, params = {}) {
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    return result;
  } finally {
    await session.close();
  }
}

export function toNativeNumber(neo4jInt) {
  if (neo4j.isInt(neo4jInt)) return neo4jInt.toNumber();
  return neo4jInt;
}

export function recordToObject(record) {
  const obj = {};
  for (const key of record.keys) {
    const val = record.get(key);
    obj[key] = convertValue(val);
  }
  return obj;
}

function convertValue(val) {
  if (val === null || val === undefined) return val;
  if (neo4j.isInt(val)) return val.toNumber();
  if (val instanceof neo4j.types.Date) return val.toString();
  if (val instanceof neo4j.types.DateTime) return val.toString();
  if (val instanceof neo4j.types.LocalDateTime) return val.toString();
  if (Array.isArray(val)) return val.map(convertValue);
  if (typeof val === 'object' && val.properties) {
    return convertProperties(val.properties);
  }
  return val;
}

function convertProperties(props) {
  const obj = {};
  for (const key of Object.keys(props)) {
    obj[key] = convertValue(props[key]);
  }
  return obj;
}
