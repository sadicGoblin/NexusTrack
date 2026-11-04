/**
 * Carga inicial desde la planilla original (docs/NexusTrack.xlsx).
 *
 * - Es idempotente: se puede ejecutar varias veces sin duplicar datos.
 * - Normaliza textos (espacios sobrantes, RUT con formato, errores de tipeo conocidos).
 * - Informa cada dato que no pudo vincular en lugar de inventarlo.
 *
 * Uso: npm run db:seed
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import {
  CATALOGOS,
  esRutValido,
  formatearCodigo,
  formatearRut,
  generarTramo,
  type TipoCatalogo,
} from '@nexustrack/shared';
import { PrismaClient, type Prisma } from '../apps/api/src/generated/prisma/client.js';
import { fecha, leerTabla, normalizar, numero, texto, textoONulo } from './planilla.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const advertencias: string[] = [];
const avisar = (msg: string) => advertencias.push(msg);

/** Correcciones de tipeo conocidas en la planilla (documentadas en docs/NexusTrack.md). */
const CORRECCIONES: Record<string, string> = { PLATADORMA: 'PLATAFORMA' };

/** Códigos fijos para los catálogos que gobiernan lógica. */
const CODIGOS: Partial<Record<TipoCatalogo, Record<string, string>>> = {
  TIPO_MOVIL: {
    CAMION: 'CAMION',
    TRACTOCAMION: 'TRACTOCAMION',
    'CHASIS C/MOTOR': 'CHASIS_CON_MOTOR',
    'CHASIS S/MOTOR': 'CHASIS_SIN_MOTOR',
    PLATAFORMA: 'PLATAFORMA',
    THERMO: 'THERMO',
  },
  CATEGORIA_EMPRESA: { SOCIO: 'SOCIO', FLETERO: 'FLETERO', EXTERNO: 'EXTERNO' },
};

const PARAMETROS: { clave: string; valor: string; descripcion: string }[] = [
  {
    clave: 'EMPRESA_NOMBRE',
    valor: 'NexusTrack',
    descripcion: 'Razón social de la empresa emisora (encabezado de documentos PDF).',
  },
  { clave: 'EMPRESA_RUT', valor: '', descripcion: 'RUT de la empresa emisora.' },
  { clave: 'EMPRESA_DIRECCION', valor: '', descripcion: 'Dirección de la empresa emisora.' },
  { clave: 'EMPRESA_TELEFONO', valor: '', descripcion: 'Teléfono de la empresa emisora.' },
  { clave: 'EMPRESA_EMAIL', valor: '', descripcion: 'Correo de contacto de la empresa emisora.' },
  {
    clave: 'VALOR_LITRO_COMBUSTIBLE',
    valor: '',
    descripcion: 'Valor por defecto del litro de combustible en pesos (editable en cada vale).',
  },
  {
    clave: 'CONCEPTO_VALE_DINERO',
    valor: 'FLETE',
    descripcion: 'Concepto por defecto de los vales de dinero.',
  },
  {
    clave: 'HOJA_RUTA_INICIAL',
    valor: '1',
    descripcion: 'N° de la primera hoja de ruta (para continuar la numeración de la planilla).',
  },
  {
    clave: 'DIAS_ALERTA_VENCIMIENTO',
    valor: '30',
    descripcion: 'Días de anticipación para alertar vencimientos de documentos de móviles y licencias.',
  },
];

// ───────────────────────────── Carga ─────────────────────────────

async function siguienteCodigo(tipo: 'PACKING' | 'RUTA_TARIFA', prefijo: string): Promise<string> {
  const sec = await prisma.secuencia.update({ where: { tipo }, data: { ultimo: { increment: 1 } } });
  return `${prefijo}-${String(sec.ultimo).padStart(3, '0')}`;
}

async function cargarCatalogos(ws: ExcelJS.Worksheet) {
  const porTitulo = new Map(CATALOGOS.map((c) => [c.tituloExcel, c.tipo]));
  const valores = new Map<TipoCatalogo, string[]>();
  for (const col of [2, 4, 6, 8]) {
    let actual: TipoCatalogo | null = null;
    for (let n = 1; n <= ws.rowCount; n++) {
      const v = texto(ws.getRow(n).getCell(col).value).toUpperCase();
      if (!v) {
        actual = null;
      } else if (porTitulo.has(v)) {
        actual = porTitulo.get(v)!;
        valores.set(actual, []);
      } else if (actual) {
        valores.get(actual)!.push(CORRECCIONES[v] ?? v);
      }
    }
  }
  for (const meta of CATALOGOS) {
    const lista = valores.get(meta.tipo);
    if (!lista?.length) {
      avisar(`Catálogo ${meta.tituloExcel}: no se encontró en la hoja BaseDatos.`);
      continue;
    }
    for (const [i, valor] of lista.entries()) {
      const codigo = CODIGOS[meta.tipo]?.[valor] ?? null;
      await prisma.catalogoItem.upsert({
        where: { tipo_valor: { tipo: meta.tipo, valor } },
        update: { orden: i + 1, codigo },
        create: { tipo: meta.tipo, valor, orden: i + 1, codigo },
      });
    }
  }
  return [...valores.values()].reduce((s, l) => s + l.length, 0);
}

async function catalogoId(tipo: TipoCatalogo, valor: string, contexto: string): Promise<number | null> {
  if (!valor) return null;
  const v = CORRECCIONES[valor.toUpperCase()] ?? valor.toUpperCase();
  const item = await prisma.catalogoItem.findUnique({ where: { tipo_valor: { tipo, valor: v } } });
  if (!item) avisar(`${contexto}: "${valor}" no existe en el catálogo ${tipo}.`);
  return item?.id ?? null;
}

function rutNormalizado(rut: string, contexto: string): string {
  const formateado = formatearRut(rut);
  if (!esRutValido(rut))
    avisar(
      `${contexto}: el RUT ${formateado} no pasa la validación módulo 11. Se importó tal cual; corregirlo al editar.`,
    );
  return formateado;
}

async function cargarEmpresas(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'RutEmpresa')) {
    const razonSocial = texto(f['Empresa']);
    const rut = rutNormalizado(texto(f['RutEmpresa']), `Empresa ${razonSocial}`);
    const categoriaId = await catalogoId(
      'CATEGORIA_EMPRESA',
      texto(f['Categoria Empresa']),
      `Empresa ${razonSocial}`,
    );
    if (!categoriaId) continue;
    const data = {
      razonSocial,
      propietario: textoONulo(f['Propietario']),
      fono: textoONulo(f['Fono Móvil']),
      email: textoONulo(f['Email']),
      categoriaId,
    };
    await prisma.empresa.upsert({ where: { rut }, update: data, create: { rut, ...data } });
    n++;
  }
  return n;
}

async function cargarClientes(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'Cliente')) {
    const nombre = texto(f['Cliente']);
    const rut = rutNormalizado(texto(f['Rut']), `Cliente ${nombre}`);
    const data = {
      nombre,
      giro: textoONulo(f['Giro']),
      direccion: textoONulo(f['Dirección']),
      contactoOperaciones: textoONulo(f['Contacto Operaciones']),
      contactoAdministrativo: textoONulo(f['Contacto Administrativo']),
      fono: textoONulo(f['Fono']),
      email: textoONulo(f['Email']),
    };
    await prisma.cliente.upsert({ where: { rut }, update: data, create: { rut, ...data } });
    n++;
  }
  return n;
}

/** En la planilla los clientes aparecen con nombre corto (COEXCA, PROPAL) en Packings y Rutas. */
async function buscarCliente(nombre: string, contexto: string) {
  const clave = normalizar(nombre);
  const clientes = await prisma.cliente.findMany();
  const cliente =
    clientes.find((c) => normalizar(c.nombre) === clave) ??
    clientes.find((c) => normalizar(c.nombre).split(' ').includes(clave));
  if (!cliente) avisar(`${contexto}: no se encontró el cliente "${nombre}".`);
  return cliente ?? null;
}

async function buscarEmpresa(razonSocial: string, contexto: string) {
  const clave = normalizar(razonSocial);
  const empresas = await prisma.empresa.findMany();
  const empresa =
    empresas.find((e) => normalizar(e.razonSocial) === clave) ??
    empresas.find(
      (e) => normalizar(e.razonSocial).startsWith(clave) || clave.startsWith(normalizar(e.razonSocial)),
    );
  if (!empresa) avisar(`${contexto}: no se encontró la empresa "${razonSocial}".`);
  return empresa ?? null;
}

async function cargarPackings(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'Código Packing')) {
    const nombre = texto(f['Packing']);
    const cliente = await buscarCliente(texto(f['Cliente']), `Packing ${nombre}`);
    if (!cliente) continue;
    const existente = await prisma.packing.findFirst({ where: { clienteId: cliente.id, nombre } });
    const data = { nombre, ubicacion: textoONulo(f['Ubicación']), clienteId: cliente.id };
    if (existente) {
      await prisma.packing.update({ where: { id: existente.id }, data });
    } else {
      const codigo = formatearCodigo(texto(f['Código Packing'])) || (await siguienteCodigo('PACKING', 'PK'));
      await prisma.packing.create({ data: { codigo, ...data } });
    }
    n++;
  }
  return n;
}

async function cargarMoviles(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'Patente')) {
    const patente = texto(f['Patente'])
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const empresa = await buscarEmpresa(texto(f['Empresa']), `Móvil ${patente}`);
    const tipoId = await catalogoId('TIPO_MOVIL', texto(f['Tipo']), `Móvil ${patente}`);
    if (!empresa || !tipoId) continue;
    const data = {
      marca: textoONulo(f['Marca']),
      modelo: textoONulo(f['Modelo']),
      anio: numero(f['Año']),
      tipoId,
      empresaId: empresa.id,
      vencRevisionTecnica: fecha(f['Vencimiento Revisión Técnica']),
      vencPermisoCirculacion: fecha(f['Vencimiento Permiso Circulación']),
      vencSeguro: fecha(f['Vencimiento Seguro']),
    };
    await prisma.movil.upsert({ where: { patente }, update: data, create: { patente, ...data } });
    n++;
  }
  return n;
}

async function cargarConductores(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'RUT')) {
    const nombre = texto(f['Conductor']);
    const rut = rutNormalizado(texto(f['RUT']), `Conductor ${nombre}`);
    const empresa = await buscarEmpresa(texto(f['Empresa']), `Conductor ${nombre}`);
    if (!empresa) continue;
    const tipo = texto(f['Tipo']).toUpperCase() === 'TERCERO' ? 'TERCERO' : 'TRABAJADOR';
    const data = {
      nombre,
      tipo,
      empresaId: empresa.id,
      comision: numero(f['% Comisión']),
      numeroLicencia: textoONulo(f['N° Licencia']),
      vencLicencia: fecha(f['Vencimiento']),
      fechaIngreso: fecha(f['Fecha Ingreso']),
      terminoContrato: fecha(f['Término Contrato']),
      direccion: textoONulo(f['Dirección']),
      telefono: textoONulo(f['Móvil']),
      numeroCuenta: textoONulo(f['N° Cuenta']),
      banco: textoONulo(f['Banco']),
    } satisfies Partial<Prisma.ConductorUncheckedCreateInput>;
    await prisma.conductor.upsert({ where: { rut }, update: data, create: { rut, ...data } });
    n++;
  }
  return n;
}

async function buscarMovil(patente: string, contexto: string) {
  const p = patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!p) return null;
  const movil = await prisma.movil.findUnique({ where: { patente: p } });
  if (!movil) avisar(`${contexto}: la patente ${p} no existe en Móviles.`);
  return movil;
}

async function cargarAsignaciones(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'Camión')) {
    const ctx = `Asignación del camión ${texto(f['Camión'])}`;
    const camion = await buscarMovil(texto(f['Camión']), ctx);
    if (!camion) continue;
    if (await prisma.asignacion.findFirst({ where: { camionId: camion.id, fechaTermino: null } })) continue;
    const nombreConductor = texto(f['Conductor']);
    const conductor = nombreConductor
      ? (await prisma.conductor.findMany()).find((c) => normalizar(c.nombre) === normalizar(nombreConductor))
      : undefined;
    if (nombreConductor && !conductor) {
      avisar(
        `${ctx}: el conductor "${nombreConductor}" no existe en Conductores; la asignación se cargó sin conductor.`,
      );
    }
    const chasis = await buscarMovil(texto(f['Chasis']), ctx);
    const thermo = await buscarMovil(texto(f['Thermo']), ctx);
    const plataforma = await buscarMovil(texto(f['Plataforma']), ctx);
    await prisma.asignacion.create({
      data: {
        empresaId: camion.empresaId,
        camionId: camion.id,
        conductorId: conductor?.id ?? null,
        chasisId: chasis?.id ?? null,
        thermoId: thermo?.id ?? null,
        plataformaId: plataforma?.id ?? null,
        fechaAsignacion: fecha(f['Fecha Asignación']) ?? new Date(),
      },
    });
    n++;
  }
  return n;
}

async function cargarRutas(ws: ExcelJS.Worksheet) {
  let n = 0;
  for (const f of leerTabla(ws, 'Tramo')) {
    const ctx = `Ruta ${texto(f['Tramo'])}`;
    const cliente = await buscarCliente(texto(f['Cliente']), ctx);
    const origenId = await catalogoId('CIUDAD', texto(f['Origen']), ctx);
    const destinoId = await catalogoId('CIUDAD', texto(f['Destino']), ctx);
    const unidadId = await catalogoId('UNIDAD_RUTA', texto(f['Unidad']), ctx);
    const valor = numero(f['Valor']);
    if (!cliente || !origenId || !destinoId || !unidadId || valor === null) continue;
    const tramo = generarTramo(
      texto(f['Origen']),
      texto(f['Destino']),
      CORRECCIONES[texto(f['Unidad'])] ?? texto(f['Unidad']),
    );
    const data = {
      clienteId: cliente.id,
      origenId,
      destinoId,
      unidadId,
      tramo,
      distanciaKm: numero(f['Distancia Ruta']),
      valor,
      vigenciaHasta: fecha(f['Vigencia']),
    };
    const existente = await prisma.rutaTarifa.findFirst({
      where: { clienteId: cliente.id, origenId, destinoId, unidadId },
    });
    if (existente) {
      await prisma.rutaTarifa.update({ where: { id: existente.id }, data });
    } else {
      const codigo = formatearCodigo(texto(f['Código'])) || (await siguienteCodigo('RUTA_TARIFA', 'RT'));
      await prisma.rutaTarifa.create({ data: { codigo, ...data } });
    }
    n++;
  }
  return n;
}

async function cargarSistema() {
  for (const p of PARAMETROS) {
    await prisma.parametro.upsert({
      where: { clave: p.clave },
      update: { descripcion: p.descripcion },
      create: p,
    });
  }
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@nexustrack.cl').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (!existe) {
    await prisma.usuario.create({
      data: { email, nombre: 'Administrador', rol: 'ADMIN', passwordHash: await hash(password) },
    });
  }
  return { email, creado: !existe };
}

async function main() {
  const archivo = path.resolve(process.env.SEED_XLSX ?? 'docs/NexusTrack.xlsx');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(archivo);
  const hoja = (nombre: string) => {
    const ws = libro.getWorksheet(nombre);
    if (!ws) throw new Error(`La planilla no tiene la hoja "${nombre}"`);
    return ws;
  };

  console.log(`Cargando datos iniciales desde ${archivo}`);
  const resumen = {
    'Ítems de catálogo': await cargarCatalogos(hoja('BaseDatos')),
    Empresas: await cargarEmpresas(hoja('Empresas')),
    Clientes: await cargarClientes(hoja('Clientes')),
    Packings: await cargarPackings(hoja('Packings')),
    Móviles: await cargarMoviles(hoja('Móviles')),
    Conductores: await cargarConductores(hoja('Conductores')),
    Asignaciones: await cargarAsignaciones(hoja('Asignaciones')),
    'Rutas tarifas': await cargarRutas(hoja('Rutas Tarifas')),
  };
  const admin = await cargarSistema();
  console.table(resumen);
  console.log(
    admin.creado
      ? `Usuario administrador creado: ${admin.email}`
      : `Usuario administrador ya existía: ${admin.email}`,
  );
  if (advertencias.length) {
    console.warn(`\n${advertencias.length} advertencia(s) de calidad de datos:`);
    for (const a of advertencias) console.warn(`  - ${a}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
