import neo4j from 'neo4j-driver';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/;

export function validateAndConvert(value, type, fieldName) {
  if (value === undefined || value === null) {
    return { value: null, error: null };
  }

  switch (type) {
    case 'string': {
      const str = String(value);
      return { value: str, error: null };
    }

    case 'integer': {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        return { value: null, error: `'${fieldName}' debe ser un entero, recibido: ${value}` };
      }
      return { value: neo4j.int(n), error: null };
    }

    case 'float': {
      const f = parseFloat(value);
      if (isNaN(f)) {
        return { value: null, error: `'${fieldName}' debe ser un número decimal, recibido: ${value}` };
      }
      return { value: f, error: null };
    }

    case 'boolean': {
      if (typeof value === 'boolean') return { value, error: null };
      if (value === 'true') return { value: true, error: null };
      if (value === 'false') return { value: false, error: null };
      return { value: null, error: `'${fieldName}' debe ser boolean (true/false), recibido: ${value}` };
    }

    case 'date': {
      const str = String(value);
      if (!ISO_DATE.test(str)) {
        return { value: null, error: `'${fieldName}' debe ser fecha ISO (YYYY-MM-DD), recibido: ${value}` };
      }
      const parts = str.split('-').map(Number);
      return { value: neo4j.types.Date.fromStandardDate(new Date(parts[0], parts[1] - 1, parts[2])), error: null };
    }

    case 'datetime': {
      const str = String(value);
      if (!ISO_DATETIME.test(str)) {
        return { value: null, error: `'${fieldName}' debe ser datetime ISO, recibido: ${value}` };
      }
      const dt = new Date(str);
      if (isNaN(dt.getTime())) {
        return { value: null, error: `'${fieldName}' datetime inválido: ${value}` };
      }
      return { value: neo4j.types.DateTime.fromStandardDate(dt), error: null };
    }

    case 'list': {
      if (Array.isArray(value)) return { value, error: null };
      if (typeof value === 'string') {
        return { value: value.split(',').map(s => s.trim()).filter(Boolean), error: null };
      }
      return { value: null, error: `'${fieldName}' debe ser un array o string separado por comas` };
    }

    default:
      return { value, error: null };
  }
}

export function validateProperties(schemaProps, inputProps) {
  const converted = {};
  const errors = [];

  for (const [key, type] of Object.entries(schemaProps)) {
    if (inputProps[key] !== undefined) {
      const { value, error } = validateAndConvert(inputProps[key], type, key);
      if (error) {
        errors.push(error);
      } else {
        converted[key] = value;
      }
    }
  }

  return { converted, errors };
}
