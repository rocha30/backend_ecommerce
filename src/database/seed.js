import 'dotenv/config';
import neo4j from 'neo4j-driver';
import { runQuery, getSession, closeDriver } from '../config/neo4j.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const rnd = (min, max) => Math.random() * (max - min) + min;
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const pick = arr => arr[rndInt(0, arr.length - 1)];
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function isoDate(offsetDays = 0) {
  const d = new Date('2024-01-01');
  d.setDate(d.getDate() + rndInt(0, offsetDays));
  return d.toISOString().split('T')[0];
}

function isoDatetime(offsetDays = 0) {
  const d = new Date('2024-01-01T00:00:00');
  d.setDate(d.getDate() + rndInt(0, offsetDays));
  d.setHours(rndInt(0, 23), rndInt(0, 59), rndInt(0, 59));
  return d.toISOString().replace('Z', '');
}

function toNeo4jDate(str) {
  const [y, m, day] = str.split('-').map(Number);
  return neo4j.types.Date.fromStandardDate(new Date(y, m - 1, day));
}

function toNeo4jDatetime(str) {
  return neo4j.types.DateTime.fromStandardDate(new Date(str));
}

async function batchInsert(cypher, rows, batchSize = 200) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await runQuery(cypher, { batch });
  }
}

// ── Data ───────────────────────────────────────────────────────────────────

const MARCA_DATA = [
  { nombre: 'Rolex', pais: 'Suiza', anio: 1905, lujo: true, web: 'https://www.rolex.com' },
  { nombre: 'Omega', pais: 'Suiza', anio: 1848, lujo: true, web: 'https://www.omegawatches.com' },
  { nombre: 'TAG Heuer', pais: 'Suiza', anio: 1860, lujo: true, web: 'https://www.tagheuer.com' },
  { nombre: 'Patek Philippe', pais: 'Suiza', anio: 1839, lujo: true, web: 'https://www.patek.com' },
  { nombre: 'Audemars Piguet', pais: 'Suiza', anio: 1875, lujo: true, web: 'https://www.audemarspiguet.com' },
  { nombre: 'Richard Mille', pais: 'Suiza', anio: 2001, lujo: true, web: 'https://www.richardmille.com' },
  { nombre: 'Breitling', pais: 'Suiza', anio: 1884, lujo: true, web: 'https://www.breitling.com' },
  { nombre: 'IWC Schaffhausen', pais: 'Suiza', anio: 1868, lujo: true, web: 'https://www.iwc.com' },
  { nombre: 'Cartier', pais: 'Francia', anio: 1847, lujo: true, web: 'https://www.cartier.com' },
  { nombre: 'Panerai', pais: 'Italia', anio: 1860, lujo: true, web: 'https://www.panerai.com' },
  { nombre: 'Zenith', pais: 'Suiza', anio: 1865, lujo: true, web: 'https://www.zenith-watches.com' },
  { nombre: 'Longines', pais: 'Suiza', anio: 1832, lujo: false, web: 'https://www.longines.com' },
  { nombre: 'Tissot', pais: 'Suiza', anio: 1853, lujo: false, web: 'https://www.tissotwatches.com' },
  { nombre: 'Rado', pais: 'Suiza', anio: 1917, lujo: false, web: 'https://www.rado.com' },
  { nombre: 'Hamilton', pais: 'Suiza', anio: 1892, lujo: false, web: 'https://www.hamiltonwatch.com' },
  { nombre: 'Seiko', pais: 'Japón', anio: 1881, lujo: false, web: 'https://www.seikowatches.com' },
  { nombre: 'Casio', pais: 'Japón', anio: 1946, lujo: false, web: 'https://www.casio.com' },
  { nombre: 'Citizen', pais: 'Japón', anio: 1918, lujo: false, web: 'https://www.citizenwatch.com' },
  { nombre: 'Orient', pais: 'Japón', anio: 1950, lujo: false, web: 'https://www.orientwatchusa.com' },
  { nombre: 'Grand Seiko', pais: 'Japón', anio: 1960, lujo: true, web: 'https://www.grand-seiko.com' },
  { nombre: 'Tudor', pais: 'Suiza', anio: 1926, lujo: false, web: 'https://www.tudorwatch.com' },
  { nombre: 'Sinn', pais: 'Alemania', anio: 1961, lujo: false, web: 'https://www.sinn.de' },
  { nombre: 'Nomos Glashütte', pais: 'Alemania', anio: 1990, lujo: false, web: 'https://www.nomos-glashuette.com' },
  { nombre: 'A. Lange & Söhne', pais: 'Alemania', anio: 1845, lujo: true, web: 'https://www.alange-soehne.com' },
  { nombre: 'Jaeger-LeCoultre', pais: 'Suiza', anio: 1833, lujo: true, web: 'https://www.jaeger-lecoultre.com' },
  { nombre: 'Vacheron Constantin', pais: 'Suiza', anio: 1755, lujo: true, web: 'https://www.vacheron-constantin.com' },
  { nombre: 'Blancpain', pais: 'Suiza', anio: 1735, lujo: true, web: 'https://www.blancpain.com' },
  { nombre: 'Girard-Perregaux', pais: 'Suiza', anio: 1791, lujo: true, web: 'https://www.girard-perregaux.com' },
  { nombre: 'Chopard', pais: 'Suiza', anio: 1860, lujo: true, web: 'https://www.chopard.com' },
  { nombre: 'Hublot', pais: 'Suiza', anio: 1980, lujo: true, web: 'https://www.hublot.com' },
  { nombre: 'Bell & Ross', pais: 'Francia', anio: 1992, lujo: true, web: 'https://www.bellross.com' },
  { nombre: 'Bvlgari', pais: 'Italia', anio: 1884, lujo: true, web: 'https://www.bulgari.com' },
  { nombre: 'Ulysse Nardin', pais: 'Suiza', anio: 1846, lujo: true, web: 'https://www.ulysse-nardin.com' },
  { nombre: 'Roger Dubuis', pais: 'Suiza', anio: 1995, lujo: true, web: 'https://www.rogerdubuis.com' },
  { nombre: 'F.P. Journe', pais: 'Suiza', anio: 1999, lujo: true, web: 'https://www.fpjourne.com' },
  { nombre: 'Frederique Constant', pais: 'Suiza', anio: 1988, lujo: false, web: 'https://www.frederiqueconstant.com' },
  { nombre: 'Alpina', pais: 'Suiza', anio: 1883, lujo: false, web: 'https://www.alpina-watches.com' },
  { nombre: 'Ball Watch', pais: 'Suiza', anio: 1891, lujo: false, web: 'https://www.ballwatch.com' },
  { nombre: 'Movado', pais: 'Suiza', anio: 1881, lujo: false, web: 'https://www.movado.com' },
  { nombre: 'Baume & Mercier', pais: 'Suiza', anio: 1830, lujo: false, web: 'https://www.baume-et-mercier.com' },
  { nombre: 'Piaget', pais: 'Suiza', anio: 1874, lujo: true, web: 'https://www.piaget.com' },
  { nombre: 'Harry Winston', pais: 'EE.UU.', anio: 1932, lujo: true, web: 'https://www.harrywinston.com' },
  { nombre: 'Montblanc', pais: 'Alemania', anio: 1906, lujo: false, web: 'https://www.montblanc.com' },
  { nombre: 'Raymond Weil', pais: 'Suiza', anio: 1976, lujo: false, web: 'https://www.raymond-weil.com' },
  { nombre: 'Ebel', pais: 'Suiza', anio: 1911, lujo: false, web: 'https://www.ebel.com' },
  { nombre: 'Corum', pais: 'Suiza', anio: 1955, lujo: true, web: 'https://www.corum.ch' },
  { nombre: 'Bulgari Solotempo', pais: 'Italia', anio: 1977, lujo: true, web: 'https://www.bulgari.com' },
  { nombre: 'Fossil', pais: 'EE.UU.', anio: 1984, lujo: false, web: 'https://www.fossil.com' },
  { nombre: 'Skagen', pais: 'Dinamarca', anio: 1989, lujo: false, web: 'https://www.skagen.com' },
  { nombre: 'Bulova', pais: 'EE.UU.', anio: 1875, lujo: false, web: 'https://www.bulova.com' },
  { nombre: 'Wittnauer', pais: 'EE.UU.', anio: 1885, lujo: false, web: 'https://www.wittnauer.com' },
  { nombre: 'Mido', pais: 'Suiza', anio: 1918, lujo: false, web: 'https://www.mido.com' },
  { nombre: 'Certina', pais: 'Suiza', anio: 1888, lujo: false, web: 'https://www.certina.com' },
  { nombre: 'Porsche Design', pais: 'Alemania', anio: 1972, lujo: true, web: 'https://www.porsche-design.com' },
  { nombre: 'Glycine', pais: 'Suiza', anio: 1914, lujo: false, web: 'https://www.glycine-watch.ch' },
  { nombre: 'H. Moser & Cie.', pais: 'Suiza', anio: 1828, lujo: true, web: 'https://www.h-moser.com' },
  { nombre: 'Urwerk', pais: 'Suiza', anio: 1997, lujo: true, web: 'https://www.urwerk.com' },
  { nombre: 'De Bethune', pais: 'Suiza', anio: 2002, lujo: true, web: 'https://www.debethune.ch' },
  { nombre: 'Bovet Fleurier', pais: 'Suiza', anio: 1822, lujo: true, web: 'https://www.bovet.com' },
  { nombre: 'Laurent Ferrier', pais: 'Suiza', anio: 2010, lujo: true, web: 'https://www.laurentferrier.com' },
  { nombre: 'Arnold & Son', pais: 'Reino Unido', anio: 1764, lujo: true, web: 'https://www.arnoldandson.com' },
  { nombre: 'Jaquet Droz', pais: 'Suiza', anio: 1738, lujo: true, web: 'https://www.jaquet-droz.com' },
  { nombre: 'Louis Moinet', pais: 'Suiza', anio: 2004, lujo: true, web: 'https://www.louismoinet.com' },
  { nombre: 'MB&F', pais: 'Suiza', anio: 2005, lujo: true, web: 'https://www.mbandf.com' },
  { nombre: 'Voutilainen', pais: 'Finlandia', anio: 2002, lujo: true, web: 'https://www.voutilainen.fi' },
  { nombre: 'Greubel Forsey', pais: 'Suiza', anio: 2004, lujo: true, web: 'https://www.greubelforsey.com' },
  { nombre: 'Romain Gauthier', pais: 'Suiza', anio: 2005, lujo: true, web: 'https://www.romaingauthier.com' },
  { nombre: 'Hermès Timepieces', pais: 'Francia', anio: 1978, lujo: true, web: 'https://www.hermes.com' },
  { nombre: 'Chanel Horlogerie', pais: 'Francia', anio: 1987, lujo: true, web: 'https://www.chanel.com' },
  { nombre: 'Louis Vuitton Montres', pais: 'Francia', anio: 2002, lujo: true, web: 'https://www.louisvuitton.com' },
  { nombre: 'Junghans', pais: 'Alemania', anio: 1861, lujo: false, web: 'https://www.junghans.de' },
  { nombre: 'Emporio Armani Watches', pais: 'Italia', anio: 1975, lujo: false, web: 'https://www.armani.com' },
  { nombre: 'Hugo Boss Watches', pais: 'Alemania', anio: 1924, lujo: false, web: 'https://www.hugoboss.com' },
  { nombre: 'Michael Kors Watches', pais: 'EE.UU.', anio: 1981, lujo: false, web: 'https://www.michaelkors.com' },
  { nombre: 'MVMT', pais: 'EE.UU.', anio: 2013, lujo: false, web: 'https://www.mvmtwatches.com' },
  { nombre: 'Daniel Wellington', pais: 'Suecia', anio: 2011, lujo: false, web: 'https://www.danielwellington.com' },
  { nombre: 'Vincero', pais: 'EE.UU.', anio: 2014, lujo: false, web: 'https://www.vincero.com' },
  { nombre: 'Timex', pais: 'EE.UU.', anio: 1854, lujo: false, web: 'https://www.timex.com' },
  { nombre: 'Pulsar', pais: 'Japón', anio: 1970, lujo: false, web: 'https://www.pulsarwatches.com' },
  { nombre: 'Wenger', pais: 'Suiza', anio: 1893, lujo: false, web: 'https://www.wenger.ch' },
];

const CATEGORIAS = ['deportivo', 'clasico', 'lujo', 'buceo', 'aviacion', 'cronografo', 'skeleton', 'smartwatch', 'vintage', 'casual'];
const MECANISMOS = ['automatico', 'manual', 'cuarzo', 'solar', 'kinetic', 'eco-drive', 'spring-drive'];
const MATERIALES_CAJA = ['acero inoxidable', 'titanio', 'oro amarillo', 'oro blanco', 'oro rosa', 'ceramica', 'carbono', 'platino'];
const MATERIALES_CORREA = ['acero', 'cuero', 'caucho', 'nylon', 'titanio', 'ceramica', 'goma'];
const CRISTALES = ['zafiro', 'mineral', 'acrilico', 'zafiro antireflejo'];
const ESTADOS_PEDIDO = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
const ESTADOS_CARRITO = ['activo', 'abandonado', 'convertido'];
const CANALES = ['web', 'movil', 'app', 'kiosco'];
const DISPOSITIVOS = ['desktop', 'mobile', 'tablet'];
const NOMBRES = ['Carlos','Ana','Mario','Lucia','Pedro','Sofia','Juan','Maria','Luis','Elena','Jorge','Valentina','Miguel','Camila','Roberto','Isabella','Andres','Daniela','Felipe','Gabriela','Sebastian','Laura','Ricardo','Natalia','Eduardo','Fernanda','Alejandro','Patricia','Francisco','Claudia','Antonio','Monica','Gabriel','Andrea','Rodrigo','Carolina','Sergio','Paola','Alberto','Marcela','Diego','Beatriz','Hector','Silvia','Oscar','Diana','Manuel','Veronica','Rafael','Cristina','Ivan','Alejandra','Raul','Jimena','Ernesto','Adriana','Arturo','Lorena','Victor','Mariana','Hugo','Fabiola','Gerardo','Marisol','Pablo','Yareli','Marco','Rocio','Enrique','Sara','Emilio','Graciela','Julio','Alicia','Ruben','Olga','Tomas','Miriam','David','Blanca','Nicolas','Esperanza','Alvaro','Leticia','Salvador','Karla','Xavier','Sandra','Emmanuel','Martha','Ismael','Irene','Bernardo','Gloria','Mauricio','Angela','Alfredo','Concepcion'];
const APELLIDOS = ['Garcia','Rodriguez','Martinez','Lopez','Gonzalez','Perez','Sanchez','Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Cruz','Morales','Gutierrez','Ortiz','Chavez','Ramos','Mendoza','Ruiz','Herrera','Jimenez','Alvarez','Romero','Moreno','Soto','Vargas','Castillo','Espinoza','Aguilar','Guerrero','Nunez','Vega','Rojas','Salinas','Delgado','Figueroa','Rios','Silva','Navarro','Campos','Miranda','Medina','Avila','Contreras','Fuentes','Lara','Dominguez','Ibarra','Castro','Bermudez','Molina','Cisneros','Trejo','Suarez','Pena','Serrano','Villanueva','Cortez','Leon','Montes','Acosta','Ponce','Tapia','Estrada','Padilla','Bravo','Caballero','Arias','Solis','Valenzuela','Barajas','Sandoval','Iglesias','Orozco','Pacheco','Lucero','Ochoa','Escobar','Carrillo','Maldonado','Zamora','Alvarado','Beltran','Arroyo'];

const NOMBRES_RELOJ = ['Submariner', 'Speedmaster', 'Monaco', 'Nautilus', 'Royal Oak', 'Daytona', 'Calatrava', 'Aquanaut', 'Seamaster', 'Constellation', 'De Ville', 'GMT-Master', 'Datejust', 'Day-Date', 'Explorer', 'Air-King', 'Milgauss', 'Pearlmaster', 'Cellini', 'Heritage', 'Navigator', 'Aviator', 'Pilot', 'Navitimer', 'Superocean', 'Colt', 'Chronomat', 'Transocean', 'Galactic', 'Premier', 'Big Pilot', 'Portugieser', 'Ingenieur', 'Aquatimer', 'Da Vinci', 'Portofino', 'Mark', 'Spitfire', 'Luminor', 'Radiomir', 'Submersible', 'Due', 'Carrera', 'Formula 1', 'Link', 'Aquaracer', 'Autavia', 'Connected', 'Masterpiece', 'Star', 'Heritage', 'Hydro', 'Legend', 'SkyHawk', 'Promaster', 'Eco', 'Satellite', 'Chrono', 'Tourbillon', 'Skeleton', 'Reserve', 'Classic', 'Sport', 'Prestige', 'Diver', 'Titanium', 'Carbon', 'Ceramic', 'Gold', 'Platinum', 'Limited'];

const DIRECCIONES = ['Calle Principal 123', 'Av. Central 456', 'Boulevard Norte 789', 'Calle Reforma 321', 'Paseo de la Rosa 654', 'Av. Juarez 987', 'Calle Hidalgo 147', 'Av. Insurgentes 258', 'Calle Morelos 369', 'Paseo Constitución 741'];
const CIUDADES = ['Ciudad de Mexico', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Leon', 'Juarez', 'Zapopan', 'Merida', 'San Luis Potosi', 'Aguascalientes', 'Hermosillo', 'Mexicali', 'Culiacan', 'Acapulco', 'Tampico', 'Veracruz', 'Torreon', 'Chihuahua', 'Morelia'];

function randomName() {
  return `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
}

function randomEmail(nombre, idx) {
  const base = nombre.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'correo.com'];
  return `${base}${idx}@${pick(domains)}`;
}

function randomAddress() {
  return `${pick(DIRECCIONES)}, ${pick(CIUDADES)}, México`;
}

// ── Generate Data ──────────────────────────────────────────────────────────

function generateMarcas() {
  return MARCA_DATA.map((m, i) => ({
    idMarca: `MARCA-${String(i + 1).padStart(3, '0')}`,
    nombre: m.nombre,
    pais: m.pais,
    anioFundacion: neo4j.int(m.anio),
    esLujo: m.lujo,
    sitioWeb: m.web,
  }));
}

function generateProductos(marcas, count = 1200) {
  const productos = [];
  const perMarca = Math.ceil(count / marcas.length);
  let idx = 1;
  for (const marca of marcas) {
    const n = Math.min(perMarca, count - productos.length);
    for (let i = 0; i < n; i++) {
      const cat = pick(CATEGORIAS);
      const precio = parseFloat(rnd(marca.esLujo ? 2000 : 150, marca.esLujo ? 95000 : 3000).toFixed(2));
      const stock = rndInt(0, 50);
      const nombre = `${marca.nombre.split(' ')[0]} ${pick(NOMBRES_RELOJ)} ${rndInt(100, 9999)}`;
      productos.push({
        idProducto: `PROD-${String(idx).padStart(5, '0')}`,
        nombre,
        precio,
        stock: neo4j.int(stock),
        disponible: stock > 0,
        fechaCreacion: toNeo4jDate(isoDate(730)),
        caracteristicas: pickN([...MECANISMOS, ...MATERIALES_CAJA, ...CRISTALES], rndInt(3, 6)),
        categoria: cat,
        etiquetasCategoria: pickN(CATEGORIAS, rndInt(1, 3)),
        ordenDisplayCategoria: neo4j.int(rndInt(1, 10)),
        _marcaId: marca.idMarca,
      });
      idx++;
      if (productos.length >= count) break;
    }
    if (productos.length >= count) break;
  }
  return productos;
}

function generateUsuarios(count = 1000) {
  const usuarios = [];
  for (let i = 1; i <= count; i++) {
    const nombre = randomName();
    const bornYear = rndInt(1960, 2000);
    const regDate = isoDatetime(365);
    usuarios.push({
      idUsuario: `USR-${String(i).padStart(5, '0')}`,
      nombre,
      correo: randomEmail(nombre, i),
      fechaNacimiento: toNeo4jDate(`${bornYear}-${String(rndInt(1,12)).padStart(2,'0')}-${String(rndInt(1,28)).padStart(2,'0')}`),
      activo: Math.random() > 0.1,
      fechaRegistro: toNeo4jDatetime(regDate),
    });
  }
  return usuarios;
}

function generatePedidos(usuarios, count = 1400) {
  const pedidos = [];
  for (let i = 1; i <= count; i++) {
    const usuario = usuarios[i % usuarios.length];
    const fechaDate = isoDatetime(365);
    pedidos.push({
      idPedido: `PED-${String(i).padStart(5, '0')}`,
      fechaPedido: toNeo4jDatetime(fechaDate),
      montoTotal: parseFloat(rnd(200, 15000).toFixed(2)),
      estado: pick(ESTADOS_PEDIDO),
      pagado: Math.random() > 0.15,
      direccionEnvio: randomAddress(),
      _usuarioId: usuario.idUsuario,
    });
  }
  return pedidos;
}

function generateCarritos(usuarios, count = 1000) {
  const carritos = [];
  for (let i = 1; i <= count; i++) {
    const usuario = usuarios[i % usuarios.length];
    const crea = isoDatetime(365);
    const act = isoDatetime(30);
    carritos.push({
      idCarrito: `CART-${String(i).padStart(5, '0')}`,
      fechaCreacion: toNeo4jDatetime(crea),
      fechaActualizacion: toNeo4jDatetime(act),
      estado: pick(ESTADOS_CARRITO),
      cantidadItems: neo4j.int(rndInt(1, 8)),
      subtotal: parseFloat(rnd(100, 12000).toFixed(2)),
      _usuarioId: usuario.idUsuario,
    });
  }
  return carritos;
}

function generateListas(usuarios, count = 800) {
  const listas = [];
  const nombres = ['Mis favoritos', 'Lista de deseos', 'Para el cumpleaños', 'Aniversario', 'Colección', 'Inversión', 'Regalos', 'Premium', 'Sport', 'Vintage'];
  for (let i = 1; i <= count; i++) {
    const usuario = usuarios[i % usuarios.length];
    listas.push({
      idLista: `LIST-${String(i).padStart(5, '0')}`,
      nombre: `${pick(nombres)} ${rndInt(1, 99)}`,
      publica: Math.random() > 0.6,
      fechaCreacion: toNeo4jDate(isoDate(365)),
      descripcion: `Lista de deseos de ${usuario.nombre}`,
      cantidadItems: neo4j.int(rndInt(1, 20)),
      _usuarioId: usuario.idUsuario,
    });
  }
  return listas;
}

function generateResenas(usuarios, productos, count = 900) {
  const resenas = [];
  const titulos = ['Excelente reloj', 'Muy buena calidad', 'Vale lo que cuesta', 'Superó mis expectativas', 'Recomendado', 'Buen producto', 'Calidad premium', 'Impresionante', 'Para coleccionistas', 'Gran compra'];
  const comentarios = ['Un reloj espectacular, la calidad de manufactura es increible. Muy satisfecho con la compra.', 'El mecanismo es muy preciso y la correa es de excelente calidad.', 'Producto tal como se describe. Entrega rapida y bien empacado.', 'Increible acabado, el cristal es perfecto y el peso es justo.', 'Supero mis expectativas en todos los aspectos. Lo recomiendo totalmente.', 'La relacion calidad-precio es excelente. Muy contento con mi adquisicion.', 'Precision de relojeria suiza impecable. Vale cada centavo.'];
  for (let i = 1; i <= count; i++) {
    const usuario = usuarios[i % usuarios.length];
    const producto = productos[rndInt(0, productos.length - 1)];
    resenas.push({
      idResena: `RES-${String(i).padStart(5, '0')}`,
      calificacion: neo4j.int(rndInt(3, 5)),
      titulo: pick(titulos),
      comentario: pick(comentarios),
      fechaCreacion: toNeo4jDate(isoDate(365)),
      verificada: Math.random() > 0.3,
      _usuarioId: usuario.idUsuario,
      _productoId: producto.idProducto,
    });
  }
  return resenas;
}

function generateRecomendaciones(usuarios, productos, carritos, listas, count = 600) {
  const recomendaciones = [];
  const modelos = ['colaborativo', 'contenido', 'hibrido', 'popularidad', 'tendencia'];
  const razones = ['Basado en tu historial de compras', 'Similar a lo que viste', 'Tendencia en tu categoria', 'Usuarios similares compraron esto', 'Complementa tu compra anterior', 'Top vendido en tu categoria'];
  for (let i = 1; i <= count; i++) {
    const usuario = usuarios[i % usuarios.length];
    const prod = productos[rndInt(0, productos.length - 1)];
    const carrito = carritos[i % carritos.length];
    const lista = listas[i % listas.length];
    recomendaciones.push({
      idRecomendacion: `REC-${String(i).padStart(5, '0')}`,
      score: parseFloat(rnd(0.5, 1.0).toFixed(4)),
      fechaGeneracion: toNeo4jDatetime(isoDatetime(30)),
      modelo: pick(modelos),
      fuentes: pickN(['compras', 'vistas', 'wishlist', 'carrito', 'similares'], rndInt(2, 4)),
      razon: pick(razones),
      _usuarioId: usuario.idUsuario,
      _productoId: prod.idProducto,
      _carritoId: carrito.idCarrito,
      _listaId: lista.idLista,
    });
  }
  return recomendaciones;
}

// ── Insert Functions ────────────────────────────────────────────────────────

async function insertMarcas(marcas) {
  await batchInsert(
    `UNWIND $batch AS m CREATE (n:Marca {idMarca:m.idMarca,nombre:m.nombre,pais:m.pais,anioFundacion:m.anioFundacion,esLujo:m.esLujo,sitioWeb:m.sitioWeb})`,
    marcas
  );
  console.log(`  ✓ Marcas: ${marcas.length}`);
}

async function insertProductos(productos) {
  const rows = productos.map(p => ({ ...p }));
  await batchInsert(
    `UNWIND $batch AS p CREATE (n:Producto {idProducto:p.idProducto,nombre:p.nombre,precio:p.precio,stock:p.stock,disponible:p.disponible,fechaCreacion:p.fechaCreacion,caracteristicas:p.caracteristicas,categoria:p.categoria,etiquetasCategoria:p.etiquetasCategoria,ordenDisplayCategoria:p.ordenDisplayCategoria})`,
    rows
  );
  console.log(`  ✓ Productos: ${productos.length}`);
}

async function insertUsuarios(usuarios) {
  await batchInsert(
    `UNWIND $batch AS u CREATE (n:Usuario {idUsuario:u.idUsuario,nombre:u.nombre,correo:u.correo,fechaNacimiento:u.fechaNacimiento,activo:u.activo,fechaRegistro:u.fechaRegistro})`,
    usuarios
  );
  console.log(`  ✓ Usuarios: ${usuarios.length}`);
}

async function insertPedidos(pedidos) {
  await batchInsert(
    `UNWIND $batch AS p CREATE (n:Pedido {idPedido:p.idPedido,fechaPedido:p.fechaPedido,montoTotal:p.montoTotal,estado:p.estado,pagado:p.pagado,direccionEnvio:p.direccionEnvio})`,
    pedidos
  );
  console.log(`  ✓ Pedidos: ${pedidos.length}`);
}

async function insertCarritos(carritos) {
  await batchInsert(
    `UNWIND $batch AS c CREATE (n:Carrito {idCarrito:c.idCarrito,fechaCreacion:c.fechaCreacion,fechaActualizacion:c.fechaActualizacion,estado:c.estado,cantidadItems:c.cantidadItems,subtotal:c.subtotal})`,
    carritos
  );
  console.log(`  ✓ Carritos: ${carritos.length}`);
}

async function insertListas(listas) {
  await batchInsert(
    `UNWIND $batch AS l CREATE (n:ListaDeseos {idLista:l.idLista,nombre:l.nombre,publica:l.publica,fechaCreacion:l.fechaCreacion,descripcion:l.descripcion,cantidadItems:l.cantidadItems})`,
    listas
  );
  console.log(`  ✓ Listas de deseos: ${listas.length}`);
}

async function insertResenas(resenas) {
  await batchInsert(
    `UNWIND $batch AS r CREATE (n:Resena {idResena:r.idResena,calificacion:r.calificacion,titulo:r.titulo,comentario:r.comentario,fechaCreacion:r.fechaCreacion,verificada:r.verificada})`,
    resenas
  );
  console.log(`  ✓ Reseñas: ${resenas.length}`);
}

async function insertRecomendaciones(recs) {
  await batchInsert(
    `UNWIND $batch AS r CREATE (n:Recomendacion {idRecomendacion:r.idRecomendacion,score:r.score,fechaGeneracion:r.fechaGeneracion,modelo:r.modelo,fuentes:r.fuentes,razon:r.razon})`,
    recs
  );
  console.log(`  ✓ Recomendaciones: ${recs.length}`);
}

// ── Relationships ───────────────────────────────────────────────────────────

async function createRelFabricadoPor(productos) {
  const batch = productos.map(p => ({
    idProducto: p.idProducto,
    idMarca: p._marcaId,
    fechaAsignacion: toNeo4jDate(isoDate(730)),
    fuente: pick(['catalogo', 'fabricante', 'distribuidor']),
    activo: true,
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (p:Producto {idProducto:r.idProducto}), (m:Marca {idMarca:r.idMarca})
     CREATE (p)-[:FABRICADO_POR {fechaAsignacion:r.fechaAsignacion, fuente:r.fuente, activo:r.activo}]->(m)`,
    batch
  );
  console.log(`  ✓ FABRICADO_POR: ${batch.length}`);
}

async function createRelRealizoPedido(pedidos) {
  const batch = pedidos.map(p => ({
    idUsuario: p._usuarioId,
    idPedido: p.idPedido,
    fecha: p.fechaPedido,
    canal: pick(CANALES),
    estado: p.estado,
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (p:Pedido {idPedido:r.idPedido})
     CREATE (u)-[:REALIZO_PEDIDO {fecha:r.fecha, canal:r.canal, estado:r.estado}]->(p)`,
    batch
  );
  console.log(`  ✓ REALIZO_PEDIDO: ${batch.length}`);
}

async function createRelContienePedido(pedidos, productos) {
  const batch = [];
  for (const pedido of pedidos) {
    const n = rndInt(1, 3);
    const prods = pickN(productos, n);
    for (const prod of prods) {
      batch.push({
        idPedido: pedido.idPedido,
        idProducto: prod.idProducto,
        cantidad: neo4j.int(rndInt(1, 3)),
        precioUnitario: prod.precio,
        descuento: parseFloat(rnd(0, 0.2).toFixed(2)),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (p:Pedido {idPedido:r.idPedido}), (prod:Producto {idProducto:r.idProducto})
     CREATE (p)-[:CONTIENE {cantidad:r.cantidad, precioUnitario:r.precioUnitario, descuento:r.descuento}]->(prod)`,
    batch
  );
  console.log(`  ✓ CONTIENE (Pedido→Producto): ${batch.length}`);
}

async function createRelCompro(usuarios, productos) {
  const batch = [];
  for (let i = 0; i < usuarios.length; i++) {
    const u = usuarios[i];
    const n = rndInt(1, 5);
    const prods = pickN(productos, n);
    for (const prod of prods) {
      batch.push({
        idUsuario: u.idUsuario,
        idProducto: prod.idProducto,
        cantidad: neo4j.int(rndInt(1, 2)),
        fechaCompra: toNeo4jDatetime(isoDatetime(365)),
        precioAlComprar: prod.precio,
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (p:Producto {idProducto:r.idProducto})
     CREATE (u)-[:COMPRO {cantidad:r.cantidad, fechaCompra:r.fechaCompra, precioAlComprar:r.precioAlComprar}]->(p)`,
    batch
  );
  console.log(`  ✓ COMPRO: ${batch.length}`);
}

async function createRelVio(usuarios, productos) {
  const batch = [];
  for (let i = 0; i < usuarios.length; i++) {
    const u = usuarios[i];
    const n = rndInt(3, 10);
    const prods = pickN(productos, n);
    for (const prod of prods) {
      batch.push({
        idUsuario: u.idUsuario,
        idProducto: prod.idProducto,
        veces: neo4j.int(rndInt(1, 20)),
        ultimaVez: toNeo4jDatetime(isoDatetime(30)),
        segundosEnPagina: neo4j.int(rndInt(10, 600)),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (p:Producto {idProducto:r.idProducto})
     CREATE (u)-[:VIO {veces:r.veces, ultimaVez:r.ultimaVez, segundosEnPagina:r.segundosEnPagina}]->(p)`,
    batch
  );
  console.log(`  ✓ VIO: ${batch.length}`);
}

async function createRelPoseeCarrito(carritos) {
  const batch = carritos.map(c => ({
    idUsuario: c._usuarioId,
    idCarrito: c.idCarrito,
    fechaCreacion: c.fechaCreacion,
    activo: c.estado === 'activo',
    origen: pick(CANALES),
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (c:Carrito {idCarrito:r.idCarrito})
     CREATE (u)-[:POSEE_CARRITO {fechaCreacion:r.fechaCreacion, activo:r.activo, origen:r.origen}]->(c)`,
    batch
  );
  console.log(`  ✓ POSEE_CARRITO: ${batch.length}`);
}

async function createRelContieneCarrito(carritos, productos) {
  const batch = [];
  for (const carrito of carritos) {
    const n = rndInt(1, 4);
    const prods = pickN(productos, n);
    for (const prod of prods) {
      batch.push({
        idCarrito: carrito.idCarrito,
        idProducto: prod.idProducto,
        cantidad: neo4j.int(rndInt(1, 3)),
        precioUnitario: prod.precio,
        descuento: parseFloat(rnd(0, 0.1).toFixed(2)),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (c:Carrito {idCarrito:r.idCarrito}), (p:Producto {idProducto:r.idProducto})
     CREATE (c)-[:CONTIENE {cantidad:r.cantidad, precioUnitario:r.precioUnitario, descuento:r.descuento}]->(p)`,
    batch
  );
  console.log(`  ✓ CONTIENE (Carrito→Producto): ${batch.length}`);
}

async function createRelPoseeLista(listas) {
  const batch = listas.map(l => ({
    idUsuario: l._usuarioId,
    idLista: l.idLista,
    fechaCreacion: l.fechaCreacion,
    rol: pick(['propietario', 'colaborador']),
    activa: Math.random() > 0.2,
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (l:ListaDeseos {idLista:r.idLista})
     CREATE (u)-[:POSEE_LISTA {fechaCreacion:r.fechaCreacion, rol:r.rol, activa:r.activa}]->(l)`,
    batch
  );
  console.log(`  ✓ POSEE_LISTA: ${batch.length}`);
}

async function createRelTieneItem(listas, productos) {
  const batch = [];
  for (const lista of listas) {
    const n = rndInt(1, 5);
    const prods = pickN(productos, n);
    for (const prod of prods) {
      batch.push({
        idLista: lista.idLista,
        idProducto: prod.idProducto,
        fechaAgregado: toNeo4jDate(isoDate(365)),
        prioridad: neo4j.int(rndInt(1, 5)),
        notas: pick(['Navidad', 'Cumpleanos', 'Aniversario', 'Inversion', 'Coleccion', '']),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (l:ListaDeseos {idLista:r.idLista}), (p:Producto {idProducto:r.idProducto})
     CREATE (l)-[:TIENE_ITEM {fechaAgregado:r.fechaAgregado, prioridad:r.prioridad, notas:r.notas}]->(p)`,
    batch
  );
  console.log(`  ✓ TIENE_ITEM: ${batch.length}`);
}

async function createRelResenas(resenas) {
  const batchEscribio = resenas.map(r => ({
    idUsuario: r._usuarioId,
    idResena: r.idResena,
    fecha: r.fechaCreacion,
    dispositivo: pick(DISPOSITIVOS),
    verificada: r.verificada,
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (res:Resena {idResena:r.idResena})
     CREATE (u)-[:ESCRIBIO_RESENA {fecha:r.fecha, dispositivo:r.dispositivo, verificada:r.verificada}]->(res)`,
    batchEscribio
  );

  const batchResenaDE = resenas.map(r => ({
    idResena: r.idResena,
    idProducto: r._productoId,
    fechaAsociacion: r.fechaCreacion,
    visible: Math.random() > 0.1,
    utilidad: neo4j.int(rndInt(0, 50)),
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (res:Resena {idResena:r.idResena}), (p:Producto {idProducto:r.idProducto})
     CREATE (res)-[:RESENA_DE {fechaAsociacion:r.fechaAsociacion, visible:r.visible, utilidad:r.utilidad}]->(p)`,
    batchResenaDE
  );
  console.log(`  ✓ ESCRIBIO_RESENA + RESENA_DE: ${resenas.length} cada una`);
}

async function createRelRecomendaciones(recs) {
  const batchRecibe = recs.map(r => ({
    idUsuario: r._usuarioId,
    idRec: r.idRecomendacion,
    fecha: r.fechaGeneracion,
    canal: pick(CANALES),
    vista: Math.random() > 0.4,
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u:Usuario {idUsuario:r.idUsuario}), (rec:Recomendacion {idRecomendacion:r.idRec})
     CREATE (u)-[:RECIBE_RECOMENDACION {fecha:r.fecha, canal:r.canal, vista:r.vista}]->(rec)`,
    batchRecibe
  );

  const batchRecomienda = recs.map(r => ({
    idRec: r.idRecomendacion,
    idProducto: r._productoId,
    score: r.score,
    posicion: neo4j.int(rndInt(1, 10)),
    motivo: pick(['precio', 'popularidad', 'similitud', 'tendencia', 'colaborativo']),
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (rec:Recomendacion {idRecomendacion:r.idRec}), (p:Producto {idProducto:r.idProducto})
     CREATE (rec)-[:RECOMIENDA {score:r.score, posicion:r.posicion, motivo:r.motivo}]->(p)`,
    batchRecomienda
  );

  const batchCarrito = recs.map(r => ({
    idRec: r.idRecomendacion,
    idCarrito: r._carritoId,
    peso: parseFloat(rnd(0.3, 1.0).toFixed(3)),
    fechaCalculo: toNeo4jDate(isoDate(30)),
    fuente: 'carrito',
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (rec:Recomendacion {idRecomendacion:r.idRec}), (c:Carrito {idCarrito:r.idCarrito})
     CREATE (rec)-[:BASADA_EN_CARRITO {peso:r.peso, fechaCalculo:r.fechaCalculo, fuente:r.fuente}]->(c)`,
    batchCarrito
  );

  const batchLista = recs.map(r => ({
    idRec: r.idRecomendacion,
    idLista: r._listaId,
    peso: parseFloat(rnd(0.3, 1.0).toFixed(3)),
    fechaCalculo: toNeo4jDate(isoDate(30)),
    fuente: 'wishlist',
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (rec:Recomendacion {idRecomendacion:r.idRec}), (l:ListaDeseos {idLista:r.idLista})
     CREATE (rec)-[:BASADA_EN_WISHLIST {peso:r.peso, fechaCalculo:r.fechaCalculo, fuente:r.fuente}]->(l)`,
    batchLista
  );

  const batchClick = recs.map(r => ({
    idRec: r.idRecomendacion,
    idProducto: r._productoId,
    peso: parseFloat(rnd(0.2, 0.9).toFixed(3)),
    fechaCalculo: toNeo4jDate(isoDate(30)),
    fuente: 'click',
  }));
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (rec:Recomendacion {idRecomendacion:r.idRec}), (p:Producto {idProducto:r.idProducto})
     CREATE (rec)-[:BASADA_EN_CLICK {peso:r.peso, fechaCalculo:r.fechaCalculo, fuente:r.fuente}]->(p)`,
    batchClick
  );

  console.log(`  ✓ RECIBE_RECOMENDACION, RECOMIENDA, BASADA_EN_*: ${recs.length} cada una`);
}

async function createRelSigue(usuarios) {
  const batch = [];
  for (let i = 0; i < usuarios.length; i++) {
    const n = rndInt(1, 5);
    for (let j = 0; j < n; j++) {
      const target = usuarios[(i + rndInt(1, usuarios.length - 1)) % usuarios.length];
      if (target.idUsuario !== usuarios[i].idUsuario) {
        batch.push({
          idFrom: usuarios[i].idUsuario,
          idTo: target.idUsuario,
          fechaInicio: toNeo4jDatetime(isoDatetime(365)),
          afinidad: parseFloat(rnd(0.1, 1.0).toFixed(3)),
          activo: Math.random() > 0.1,
        });
      }
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (u1:Usuario {idUsuario:r.idFrom}), (u2:Usuario {idUsuario:r.idTo})
     CREATE (u1)-[:SIGUE {fechaInicio:r.fechaInicio, afinidad:r.afinidad, activo:r.activo}]->(u2)`,
    batch
  );
  console.log(`  ✓ SIGUE: ${batch.length}`);
}

async function createRelProductoSimilar(productos) {
  const batch = [];
  const criterios = ['precio', 'categoria', 'marca', 'mecanismo', 'material'];
  const sample = productos.slice(0, 400);
  for (const prod of sample) {
    const targets = pickN(productos.filter(p => p.idProducto !== prod.idProducto), rndInt(1, 3));
    for (const target of targets) {
      batch.push({
        idFrom: prod.idProducto,
        idTo: target.idProducto,
        score: parseFloat(rnd(0.5, 1.0).toFixed(4)),
        criterio: pick(criterios),
        fechaCalculo: toNeo4jDate(isoDate(90)),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (p1:Producto {idProducto:r.idFrom}), (p2:Producto {idProducto:r.idTo})
     CREATE (p1)-[:SIMILAR_A {score:r.score, criterio:r.criterio, fechaCalculo:r.fechaCalculo}]->(p2)`,
    batch
  );
  console.log(`  ✓ SIMILAR_A: ${batch.length}`);
}

async function createRelSeCompraCon(productos) {
  const batch = [];
  const sample = productos.slice(0, 300);
  for (const prod of sample) {
    const targets = pickN(productos.filter(p => p.idProducto !== prod.idProducto), rndInt(1, 2));
    for (const target of targets) {
      batch.push({
        idFrom: prod.idProducto,
        idTo: target.idProducto,
        frecuencia: neo4j.int(rndInt(5, 200)),
        score: parseFloat(rnd(0.3, 0.95).toFixed(4)),
        fechaCalculo: toNeo4jDate(isoDate(90)),
      });
    }
  }
  await batchInsert(
    `UNWIND $batch AS r
     MATCH (p1:Producto {idProducto:r.idFrom}), (p2:Producto {idProducto:r.idTo})
     CREATE (p1)-[:SE_COMPRA_CON {frecuencia:r.frecuencia, score:r.score, fechaCalculo:r.fechaCalculo}]->(p2)`,
    batch
  );
  console.log(`  ✓ SE_COMPRA_CON: ${batch.length}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log('=== Iniciando seed ===\n');

  console.log('Generando datos...');
  const marcas = generateMarcas();
  const productos = generateProductos(marcas, 1200);
  const usuarios = generateUsuarios(1000);
  const pedidos = generatePedidos(usuarios, 1400);
  const carritos = generateCarritos(usuarios, 1000);
  const listas = generateListas(usuarios, 800);
  const resenas = generateResenas(usuarios, productos, 900);
  const recomendaciones = generateRecomendaciones(usuarios, productos, carritos, listas, 600);

  const total = marcas.length + productos.length + usuarios.length + pedidos.length +
    carritos.length + listas.length + resenas.length + recomendaciones.length;
  console.log(`Total nodos a crear: ${total}\n`);

  console.log('Insertando nodos...');
  await insertMarcas(marcas);
  await insertProductos(productos);
  await insertUsuarios(usuarios);
  await insertPedidos(pedidos);
  await insertCarritos(carritos);
  await insertListas(listas);
  await insertResenas(resenas);
  await insertRecomendaciones(recomendaciones);

  console.log('\nCreando relaciones...');
  await createRelFabricadoPor(productos);
  await createRelRealizoPedido(pedidos);
  await createRelContienePedido(pedidos, productos);
  await createRelCompro(usuarios, productos);
  await createRelVio(usuarios, productos);
  await createRelPoseeCarrito(carritos);
  await createRelContieneCarrito(carritos, productos);
  await createRelPoseeLista(listas);
  await createRelTieneItem(listas, productos);
  await createRelResenas(resenas);
  await createRelRecomendaciones(recomendaciones);
  await createRelSigue(usuarios);
  await createRelProductoSimilar(productos);
  await createRelSeCompraCon(productos);

  const result = await runQuery('MATCH (n) RETURN count(n) AS total');
  const totalFinal = result.records[0].get('total').toNumber();
  console.log(`\n=== Seed completado ===`);
  console.log(`Total nodos en base de datos: ${totalFinal}`);
  if (totalFinal < 5000) {
    console.error(`ADVERTENCIA: Se esperaban >= 5000 nodos, hay ${totalFinal}`);
  } else {
    console.log('✓ Supera el mínimo de 5000 nodos requeridos');
  }
}

seed().then(() => closeDriver()).then(() => process.exit(0)).catch(err => {
  console.error('Error en seed:', err.message);
  closeDriver().then(() => process.exit(1));
});
