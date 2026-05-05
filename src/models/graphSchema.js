export const nodeSchemas = {
  Usuario: {
    idField: 'idUsuario',
    properties: {
      idUsuario: 'string',
      nombre: 'string',
      correo: 'string',
      fechaNacimiento: 'date',
      activo: 'boolean',
      fechaRegistro: 'datetime',
    },
    required: ['idUsuario', 'nombre', 'correo', 'fechaNacimiento', 'activo', 'fechaRegistro'],
  },
  Pedido: {
    idField: 'idPedido',
    properties: {
      idPedido: 'string',
      fechaPedido: 'datetime',
      montoTotal: 'float',
      estado: 'string',
      pagado: 'boolean',
      direccionEnvio: 'string',
    },
    required: ['idPedido', 'fechaPedido', 'montoTotal', 'estado', 'pagado', 'direccionEnvio'],
  },
  ListaDeseos: {
    idField: 'idLista',
    properties: {
      idLista: 'string',
      nombre: 'string',
      publica: 'boolean',
      fechaCreacion: 'date',
      descripcion: 'string',
      cantidadItems: 'integer',
    },
    required: ['idLista', 'nombre', 'publica', 'fechaCreacion', 'descripcion', 'cantidadItems'],
  },
  Carrito: {
    idField: 'idCarrito',
    properties: {
      idCarrito: 'string',
      fechaCreacion: 'datetime',
      fechaActualizacion: 'datetime',
      estado: 'string',
      cantidadItems: 'integer',
      subtotal: 'float',
    },
    required: ['idCarrito', 'fechaCreacion', 'fechaActualizacion', 'estado', 'cantidadItems', 'subtotal'],
  },
  Producto: {
    idField: 'idProducto',
    properties: {
      idProducto: 'string',
      nombre: 'string',
      precio: 'float',
      stock: 'integer',
      disponible: 'boolean',
      fechaCreacion: 'date',
      caracteristicas: 'list',
      categoria: 'string',
      etiquetasCategoria: 'list',
      ordenDisplayCategoria: 'integer',
    },
    required: ['idProducto', 'nombre', 'precio', 'stock', 'disponible', 'fechaCreacion', 'categoria'],
  },
  Marca: {
    idField: 'idMarca',
    properties: {
      idMarca: 'string',
      nombre: 'string',
      pais: 'string',
      anioFundacion: 'integer',
      esLujo: 'boolean',
      sitioWeb: 'string',
    },
    required: ['idMarca', 'nombre', 'pais', 'anioFundacion', 'esLujo', 'sitioWeb'],
  },
  Resena: {
    idField: 'idResena',
    properties: {
      idResena: 'string',
      calificacion: 'integer',
      titulo: 'string',
      comentario: 'string',
      fechaCreacion: 'date',
      verificada: 'boolean',
    },
    required: ['idResena', 'calificacion', 'titulo', 'comentario', 'fechaCreacion', 'verificada'],
  },
  Recomendacion: {
    idField: 'idRecomendacion',
    properties: {
      idRecomendacion: 'string',
      score: 'float',
      fechaGeneracion: 'datetime',
      modelo: 'string',
      fuentes: 'list',
      razon: 'string',
    },
    required: ['idRecomendacion', 'score', 'fechaGeneracion', 'modelo', 'fuentes', 'razon'],
  },
};

export const allowedLabels = Object.keys(nodeSchemas);

export const relationshipSchemas = {
  REALIZO_PEDIDO: {
    from: 'Usuario', to: 'Pedido',
    properties: { fecha: 'datetime', canal: 'string', estado: 'string' },
  },
  CONTIENE: {
    from: ['Pedido', 'Carrito'], to: 'Producto',
    properties: { cantidad: 'integer', precioUnitario: 'float', descuento: 'float' },
  },
  COMPRO: {
    from: 'Usuario', to: 'Producto',
    properties: { cantidad: 'integer', fechaCompra: 'datetime', precioAlComprar: 'float' },
  },
  VIO: {
    from: 'Usuario', to: 'Producto',
    properties: { veces: 'integer', ultimaVez: 'datetime', segundosEnPagina: 'integer' },
  },
  FABRICADO_POR: {
    from: 'Producto', to: 'Marca',
    properties: { fechaAsignacion: 'date', fuente: 'string', activo: 'boolean' },
  },
  ESCRIBIO_RESENA: {
    from: 'Usuario', to: 'Resena',
    properties: { fecha: 'date', dispositivo: 'string', verificada: 'boolean' },
  },
  RESENA_DE: {
    from: 'Resena', to: 'Producto',
    properties: { fechaAsociacion: 'date', visible: 'boolean', utilidad: 'integer' },
  },
  POSEE_LISTA: {
    from: 'Usuario', to: 'ListaDeseos',
    properties: { fechaCreacion: 'date', rol: 'string', activa: 'boolean' },
  },
  TIENE_ITEM: {
    from: 'ListaDeseos', to: 'Producto',
    properties: { fechaAgregado: 'date', prioridad: 'integer', notas: 'string' },
  },
  POSEE_CARRITO: {
    from: 'Usuario', to: 'Carrito',
    properties: { fechaCreacion: 'datetime', activo: 'boolean', origen: 'string' },
  },
  SIGUE: {
    from: 'Usuario', to: 'Usuario',
    properties: { fechaInicio: 'datetime', afinidad: 'float', activo: 'boolean' },
  },
  SIMILAR_A: {
    from: 'Producto', to: 'Producto',
    properties: { score: 'float', criterio: 'string', fechaCalculo: 'date' },
  },
  SE_COMPRA_CON: {
    from: 'Producto', to: 'Producto',
    properties: { frecuencia: 'integer', score: 'float', fechaCalculo: 'date' },
  },
  RECIBE_RECOMENDACION: {
    from: 'Usuario', to: 'Recomendacion',
    properties: { fecha: 'datetime', canal: 'string', vista: 'boolean' },
  },
  RECOMIENDA: {
    from: 'Recomendacion', to: 'Producto',
    properties: { score: 'float', posicion: 'integer', motivo: 'string' },
  },
  BASADA_EN_WISHLIST: {
    from: 'Recomendacion', to: 'ListaDeseos',
    properties: { peso: 'float', fechaCalculo: 'date', fuente: 'string' },
  },
  BASADA_EN_CARRITO: {
    from: 'Recomendacion', to: 'Carrito',
    properties: { peso: 'float', fechaCalculo: 'date', fuente: 'string' },
  },
  BASADA_EN_CLICK: {
    from: 'Recomendacion', to: 'Producto',
    properties: { peso: 'float', fechaCalculo: 'date', fuente: 'string' },
  },
};

export const allowedRelationships = Object.keys(relationshipSchemas);

export function validateNodeProperties(label, properties) {
  const schema = nodeSchemas[label];
  if (!schema) return { valid: false, errors: [`Label '${label}' no está permitida`] };

  const errors = [];
  for (const req of schema.required) {
    if (properties[req] === undefined || properties[req] === null || properties[req] === '') {
      errors.push(`Propiedad requerida '${req}' falta en ${label}`);
    }
  }
  for (const [key, val] of Object.entries(properties)) {
    if (!schema.properties[key]) {
      errors.push(`Propiedad '${key}' no está definida en el schema de ${label}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateRelationshipProperties(type, properties) {
  const schema = relationshipSchemas[type];
  if (!schema) return { valid: false, errors: [`Tipo de relación '${type}' no está permitido`] };

  const errors = [];
  const propKeys = Object.keys(properties);
  if (propKeys.length < 3) {
    errors.push(`La relación ${type} debe tener al menos 3 propiedades, tiene ${propKeys.length}`);
  }
  return { valid: errors.length === 0, errors };
}
