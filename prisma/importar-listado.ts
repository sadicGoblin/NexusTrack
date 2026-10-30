/**
 * Importa o actualiza Móviles, Conductores y Asignaciones desde la planilla «Listado de
 * conductores y equipos» (hojas Moviles, Conductores y Asignaciones).
 *
 * - Por defecto solo simula: informa qué crearía y qué cambiaría, y no guarda nada.
 * - Con --aplicar guarda todo en una sola transacción: o entra completo o no entra nada.
 * - Nunca borra: una celda vacía no borra un dato guardado, y lo que no está en la planilla
 *   queda como estaba.
 * - Las asignaciones siguen las reglas de la pantalla: cierra la vigente del camión y abre la
 *   nueva; un conductor o remolque no queda en dos camiones a la vez.
 * - Cada cambio queda en la auditoría a nombre del administrador.
 *
 * Uso: npx tsx prisma/importar-listado.ts <planilla.xlsx> [--aplicar] [--usuario correo]
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { esRutValido, formatearRut, GRUPOS_MOVIL, hoyIso, type GrupoMovil } from '@nexustrack/shared';
import { PrismaClient, type Prisma } from '../apps/api/src/generated/prisma/client.js';
import { fecha, leerTabla, normalizar, numero, texto, textoONulo, type Celda } from './planilla.js';

type Tx = Prisma.TransactionClient;
type Valores = Record<string, unknown>;

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes('--aplicar');
const iUsuario = argumentos.indexOf('--usuario');
const correoUsuario = iUsuario >= 0 ? argumentos[iUsuario + 1] : undefined;
const archivo = argumentos.find((a, i) => !a.startsWith('--') && (iUsuario < 0 || i !== iUsuario + 1));
if (!archivo) {
  console.error('Uso: npx tsx prisma/importar-listado.ts <planilla.xlsx> [--aplicar] [--usuario correo]');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const advertencias: string[] = [];
const detalle: string[] = [];
const avisar = (msg: string) => advertencias.push(msg);
const nuevoConteo = () => ({ creados: 0, actualizados: 0, sinCambios: 0, omitidos: 0 });
const resumen = { Móviles: nuevoConteo(), Conductores: nuevoConteo(), Asignaciones: nuevoConteo() };

/** Error para deshacer la transacción cuando solo se simula. */
class Simulacion extends Error {}

// ───────────────────────────── Formatos ─────────────────────────────

const mayusculas = (v: Celda) => textoONulo(v)?.toUpperCase() ?? null;

/** «S/N» y similares significan que el dato no existe. */
function numeroSerie(v: Celda): string | null {
  const t = mayusculas(v);
  return t && !/^(S\/N|SN|SIN NUMERO|-+)$/.test(t) ? t : null;
}

function entero(v: Celda): number | null {
  const n = numero(v);
  return n === null || Number.isNaN(n) ? null : Math.round(n);
}

/** SI/NO a booleano; vacío o desconocido no cambia el dato. */
function siNo(v: Celda): boolean | null {
  const t = normalizar(texto(v));
  return t === 'SI' ? true : t === 'NO' ? false : null;
}

/** Celulares chilenos con el formato de la app: 56 9 1234 5678. */
function telefono(v: Celda): string | null {
  const t = texto(v);
  const d = t.replace(/\D/g, '');
  if (/^569\d{8}$/.test(d)) return `56 9 ${d.slice(3, 7)} ${d.slice(7)}`;
  if (/^9\d{8}$/.test(d)) return `56 9 ${d.slice(1, 5)} ${d.slice(5)}`;
  return t || null;
}

/** Comisión como fracción (0,08 = 8 %); acepta también 8 o «8 %». */
function comision(v: Celda): number | null {
  const n = numero(v);
  if (n === null || Number.isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');

function mostrar(v: unknown): string {
  if (v === null || v === undefined) return '(vacío)';
  if (v instanceof Date) return fechaCorta(v);
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v);
}

// ───────────────────────────── Auditoría ─────────────────────────────

const IGNORAR = new Set(['id', 'creadoEn', 'actualizadoEn', 'creadoPorId', 'actualizadoPorId']);
const paraAuditoria = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

function instantanea(registro: Valores): Prisma.InputJsonValue {
  return Object.fromEntries(
    Object.entries(registro)
      .filter(([k]) => !IGNORAR.has(k))
      .map(([k, v]) => [k, paraAuditoria(v)]),
  ) as Prisma.InputJsonValue;
}

/** Campos con valor en la planilla que difieren de lo guardado. Una celda vacía nunca borra. */
function diferencias(actual: Valores, nuevo: Valores): Valores {
  const cambios: Valores = {};
  for (const [campo, valor] of Object.entries(nuevo)) {
    if (valor === null || valor === undefined) continue;
    const antes = actual[campo];
    const igual =
      valor instanceof Date && antes instanceof Date ? valor.getTime() === antes.getTime() : valor === antes;
    if (!igual) cambios[campo] = valor;
  }
  return cambios;
}

// ───────────────────────────── Importación ─────────────────────────────

type Contexto = { tx: Tx; usuarioId: number; nombres: Map<string, string> };

/** Crea el registro o actualiza solo los campos que cambiaron, con su auditoría. */
async function guardar(
  c: Contexto,
  entidad: 'Movil' | 'Conductor',
  etiqueta: string,
  actual: (Valores & { id: number }) | null,
  clave: Valores,
  datos: Valores,
  conteo: ReturnType<typeof nuevoConteo>,
): Promise<void> {
  const modelo = (entidad === 'Movil' ? c.tx.movil : c.tx.conductor) as unknown as {
    create(a: { data: Valores }): Promise<Valores & { id: number }>;
    update(a: { where: { id: number }; data: Valores }): Promise<Valores & { id: number }>;
  };
  if (!actual) {
    const creado = await modelo.create({
      data: { ...clave, ...datos, creadoPorId: c.usuarioId, actualizadoPorId: c.usuarioId },
    });
    await c.tx.auditoria.create({
      data: {
        entidad,
        entidadId: creado.id,
        accion: 'CREAR',
        usuarioId: c.usuarioId,
        cambios: instantanea(creado),
      },
    });
    conteo.creados++;
    return;
  }
  const cambios = diferencias(actual, datos);
  if (!Object.keys(cambios).length) {
    conteo.sinCambios++;
    return;
  }
  await modelo.update({ where: { id: actual.id }, data: { ...cambios, actualizadoPorId: c.usuarioId } });
  await c.tx.auditoria.create({
    data: {
      entidad,
      entidadId: actual.id,
      accion: 'EDITAR',
      usuarioId: c.usuarioId,
      cambios: Object.fromEntries(
        Object.entries(cambios).map(([k, v]) => [
          k,
          { antes: paraAuditoria(actual[k]), despues: paraAuditoria(v) },
        ]),
      ) as Prisma.InputJsonValue,
    },
  });
  const legible = (campo: string, v: unknown) =>
    campo.endsWith('Id') && typeof v === 'number'
      ? (c.nombres.get(`${campo}:${v}`) ?? String(v))
      : mostrar(v);
  detalle.push(
    `${etiqueta}: ` +
      Object.entries(cambios)
        .map(([k, v]) => `${k.replace(/Id$/, '')} ${legible(k, actual[k])} → ${legible(k, v)}`)
        .join('; '),
  );
  conteo.actualizados++;
}

async function buscarEmpresa(tx: Tx, razonSocial: string, contexto: string) {
  const clave = normalizar(razonSocial);
  const empresa = (await tx.empresa.findMany({ include: { categoria: true } })).find(
    (e) => normalizar(e.razonSocial) === clave,
  );
  if (!empresa) avisar(`${contexto}: la empresa «${razonSocial}» no existe en Empresas; no se importó.`);
  return empresa ?? null;
}

async function importarMoviles(c: Contexto, ws: ExcelJS.Worksheet) {
  const conteo = resumen['Móviles'];
  const tipos = await c.tx.catalogoItem.findMany({ where: { tipo: 'TIPO_MOVIL' } });
  for (const f of leerTabla(ws, 'PATENTE')) {
    const patente = texto(f['PATENTE'])
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const etiqueta = `Móvil ${patente}`;
    const tipo = tipos.find((t) => normalizar(t.valor) === normalizar(texto(f['TIPO'])));
    const empresa = await buscarEmpresa(c.tx, texto(f['EMPRESA']), etiqueta);
    if (!tipo) avisar(`${etiqueta}: el tipo «${texto(f['TIPO'])}» no existe en el catálogo; no se importó.`);
    if (!tipo || !empresa) {
      conteo.omitidos++;
      continue;
    }
    const tipoEmpresa = texto(f['TIPO EMPRESA']);
    if (tipoEmpresa && normalizar(tipoEmpresa) !== normalizar(empresa.categoria.valor))
      avisar(
        `${etiqueta}: la planilla dice tipo de empresa ${tipoEmpresa}, pero ${empresa.razonSocial} es ` +
          `${empresa.categoria.valor} en Empresas (la app usa la categoría de la empresa).`,
      );
    const datos = {
      tipoId: tipo.id,
      empresaId: empresa.id,
      marca: mayusculas(f['MARCA']),
      modelo: mayusculas(f['MODELO']),
      anio: entero(f['AÑO']),
      color: mayusculas(f['COLOR']),
      numeroMotor: numeroSerie(f['N° MOTOR']),
      numeroChasis: numeroSerie(f['N° CHASIS']),
      vencRevisionTecnica: fecha(f['VENC REVISION TECNICA']),
      vencPermisoCirculacion: fecha(f['VENC PERMISO CIRCULACION']),
      vencSeguro: fecha(f['VENC SEGURO']),
      activo: siNo(f['ACTIVO']),
    };
    const actual = await c.tx.movil.findUnique({ where: { patente } });
    await guardar(c, 'Movil', etiqueta, actual, { patente }, datos, conteo);
  }
}

async function importarConductores(c: Contexto, ws: ExcelJS.Worksheet) {
  const conteo = resumen.Conductores;
  for (const f of leerTabla(ws, 'RUT')) {
    const nombre = texto(f['CONDUCTOR']).toUpperCase();
    const etiqueta = `Conductor ${nombre}`;
    const rut = formatearRut(texto(f['RUT']));
    if (!esRutValido(rut))
      avisar(
        `${etiqueta}: el RUT ${rut} no pasa la validación del dígito verificador. Se importó tal cual; corríjalo en su ficha.`,
      );
    const empresa = await buscarEmpresa(c.tx, texto(f['EMPRESA']), etiqueta);
    const tipoTexto = normalizar(texto(f['TIPO']));
    const tipo = tipoTexto === 'TRABAJADOR' || tipoTexto === 'TERCERO' ? tipoTexto : null;
    if (tipoTexto && !tipo)
      avisar(`${etiqueta}: el tipo «${texto(f['TIPO'])}» no es TRABAJADOR ni TERCERO; no se importó.`);
    if (!empresa || (tipoTexto && !tipo)) {
      conteo.omitidos++;
      continue;
    }
    const actual = await c.tx.conductor.findUnique({ where: { rut } });
    if (!actual) {
      const homonimo = (await c.tx.conductor.findMany()).find(
        (x) => normalizar(x.nombre) === normalizar(nombre),
      );
      if (homonimo)
        avisar(
          `${etiqueta}: ya existe con otro RUT (${homonimo.rut}); se creó como un conductor distinto. Revise si es la misma persona.`,
        );
      if (!tipo) {
        avisar(`${etiqueta}: falta el tipo (TRABAJADOR o TERCERO); no se importó.`);
        conteo.omitidos++;
        continue;
      }
    }
    const datos = {
      nombre,
      tipo,
      empresaId: empresa.id,
      comision: comision(f['COMISION']),
      numeroLicencia: mayusculas(f['N° LICENCIA']),
      vencLicencia: fecha(f['VENC LICENCIA']),
      fechaIngreso: fecha(f['FECHA INGRESO']),
      terminoContrato: fecha(f['TERMINO CONTRATO']),
      direccion: mayusculas(f['DIRECCION']),
      telefono: telefono(f['MOVIL']),
      numeroCuenta: textoONulo(f['N° CUENTA']),
      banco: mayusculas(f['BANCO']),
      activo: siNo(f['ACTIVO']),
    };
    await guardar(c, 'Conductor', etiqueta, actual, { rut }, datos, conteo);
  }
}

const REMOLQUES = [
  ['chasisId', 'CHASIS', 'chasis', 'El chasis'],
  ['thermoId', 'THERMO', 'thermo', 'El thermo'],
  ['plataformaId', 'PLATAFORMA', 'plataforma', 'La plataforma'],
] as const satisfies readonly (readonly [string, string, GrupoMovil, string])[];
const CAMPOS = ['conductorId', 'chasisId', 'thermoId', 'plataformaId'] as const;
type Asignables = Record<(typeof CAMPOS)[number], number | null>;

async function importarAsignaciones(c: Contexto, ws: ExcelJS.Worksheet) {
  const conteo = resumen.Asignaciones;
  const moviles = await c.tx.movil.findMany({ include: { tipo: true } });
  const conductores = await c.tx.conductor.findMany();
  const porPatente = (p: string) =>
    moviles.find((m) => m.patente === p.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const deGrupo = (m: (typeof moviles)[number], g: GrupoMovil) =>
    (GRUPOS_MOVIL[g] as readonly string[]).includes(m.tipo.codigo ?? '');
  const nombreMovil = (id: number | null) => moviles.find((m) => m.id === id)?.patente ?? null;
  const nombreConductor = (id: number | null) => conductores.find((x) => x.id === id)?.nombre ?? null;

  // 1. Lo que pide la planilla, validado.
  const pedidas: { etiqueta: string; camion: (typeof moviles)[number]; desde: Date; valores: Asignables }[] =
    [];
  for (const f of leerTabla(ws, 'CAMION')) {
    const etiqueta = `Asignación del camión ${texto(f['CAMION']).toUpperCase()}`;
    const camion = porPatente(texto(f['CAMION']));
    if (!camion || !deGrupo(camion, 'camion')) {
      avisar(
        `${etiqueta}: ${camion ? `${camion.patente} no es camión ni tractocamión` : 'la patente no existe en Móviles'}; no se importó.`,
      );
      conteo.omitidos++;
      continue;
    }
    const empresaPlanilla = texto(f['EMPRESA']);
    const empresaCamion = c.nombres.get(`empresaId:${camion.empresaId}`);
    if (empresaPlanilla && empresaCamion && normalizar(empresaPlanilla) !== normalizar(empresaCamion))
      avisar(
        `${etiqueta}: la planilla dice ${empresaPlanilla}, pero el camión es de ${empresaCamion}; se usa la empresa del camión.`,
      );
    const valores: Asignables = { conductorId: null, chasisId: null, thermoId: null, plataformaId: null };
    const nombre = texto(f['CONDUCTOR']);
    if (nombre) {
      const conductor = conductores.find((x) => normalizar(x.nombre) === normalizar(nombre));
      if (conductor) valores.conductorId = conductor.id;
      else avisar(`${etiqueta}: el conductor «${nombre}» no existe en Conductores; se asignó sin conductor.`);
    }
    for (const [campo, columna, grupo, articulo] of REMOLQUES) {
      const patente = texto(f[columna]);
      if (!patente) continue;
      const m = porPatente(patente);
      if (m && deGrupo(m, grupo)) valores[campo] = m.id;
      else
        avisar(
          `${etiqueta}: ${articulo.toLowerCase()} ${patente} ${m ? `es ${m.tipo.valor}` : 'no existe en Móviles'}; se dejó fuera.`,
        );
    }
    pedidas.push({
      etiqueta,
      camion,
      desde: fecha(f['DESDE']) ?? new Date(`${hoyIso()}T00:00:00Z`),
      valores,
    });
  }

  // 2. Cierra la asignación vigente de cada camión que cambia.
  const porCrear: typeof pedidas = [];
  for (const p of pedidas) {
    const vigente = await c.tx.asignacion.findFirst({ where: { camionId: p.camion.id, fechaTermino: null } });
    if (vigente && CAMPOS.every((k) => vigente[k] === p.valores[k])) {
      conteo.sinCambios++;
      continue;
    }
    if (vigente && vigente.fechaAsignacion > p.desde) {
      avisar(
        `${p.etiqueta}: la fecha ${fechaCorta(p.desde)} es anterior a la asignación vigente (${fechaCorta(vigente.fechaAsignacion)}); no se cambió.`,
      );
      conteo.omitidos++;
      continue;
    }
    if (vigente) {
      await c.tx.asignacion.update({
        where: { id: vigente.id },
        data: { fechaTermino: p.desde, actualizadoPorId: c.usuarioId },
      });
      detalle.push(
        `${p.etiqueta}: se cierra la vigente desde ${fechaCorta(vigente.fechaAsignacion)} ` +
          `(conductor ${mostrar(nombreConductor(vigente.conductorId))}, chasis ${mostrar(nombreMovil(vigente.chasisId))}).`,
      );
    }
    porCrear.push(p);
  }

  // 3. Crea las nuevas; un conductor o remolque que sigue en otro camión queda fuera.
  for (const p of porCrear) {
    for (const campo of CAMPOS) {
      const id = p.valores[campo];
      if (!id) continue;
      const otra = await c.tx.asignacion.findFirst({
        where: { [campo]: id, fechaTermino: null, camionId: { not: p.camion.id } },
        include: { camion: true },
      });
      if (otra) {
        const quien = campo === 'conductorId' ? nombreConductor(id) : nombreMovil(id);
        avisar(
          `${p.etiqueta}: ${quien} sigue asignado al camión ${otra.camion.patente}; se dejó fuera de esta asignación.`,
        );
        p.valores[campo] = null;
      }
    }
    const nueva = await c.tx.asignacion.create({
      data: {
        empresaId: p.camion.empresaId,
        camionId: p.camion.id,
        ...p.valores,
        fechaAsignacion: p.desde,
        creadoPorId: c.usuarioId,
        actualizadoPorId: c.usuarioId,
      },
    });
    await c.tx.auditoria.create({
      data: {
        entidad: 'Asignacion',
        entidadId: nueva.id,
        accion: 'ASIGNAR',
        usuarioId: c.usuarioId,
        cambios: {
          camion: p.camion.patente,
          nueva: {
            conductor: nombreConductor(p.valores.conductorId),
            chasis: nombreMovil(p.valores.chasisId),
            thermo: nombreMovil(p.valores.thermoId),
            plataforma: nombreMovil(p.valores.plataformaId),
          },
        },
      },
    });
    conteo.creados++;
  }
}

async function main() {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(path.resolve(archivo!));
  const hoja = (nombre: string) => {
    const ws = libro.getWorksheet(nombre);
    if (!ws) throw new Error(`La planilla no tiene la hoja "${nombre}"`);
    return ws;
  };
  const usuario = await prisma.usuario.findFirst({
    where: correoUsuario ? { email: correoUsuario } : { rol: 'ADMIN', activo: true },
    orderBy: { id: 'asc' },
  });
  if (!usuario) throw new Error('No se encontró el usuario a cuyo nombre se registran los cambios.');

  console.log(`${aplicar ? 'Importando' : 'Simulando'} ${path.basename(archivo!)} como ${usuario.email}…`);
  try {
    await prisma.$transaction(
      async (tx) => {
        // Nombres legibles de tipos y empresas para el informe de cambios.
        const nombres = new Map<string, string>();
        for (const t of await tx.catalogoItem.findMany({ where: { tipo: 'TIPO_MOVIL' } }))
          nombres.set(`tipoId:${t.id}`, t.valor);
        for (const e of await tx.empresa.findMany()) nombres.set(`empresaId:${e.id}`, e.razonSocial);
        const c: Contexto = { tx, usuarioId: usuario.id, nombres };
        await importarMoviles(c, hoja('Moviles'));
        await importarConductores(c, hoja('Conductores'));
        await importarAsignaciones(c, hoja('Asignaciones'));
        if (!aplicar) throw new Simulacion();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (!(e instanceof Simulacion)) throw e;
  }

  console.table(resumen);
  if (detalle.length)
    console.log(`\nRegistros existentes que cambian (${detalle.length}):\n  - ${detalle.join('\n  - ')}`);
  if (advertencias.length)
    console.log(`\nAdvertencias (${advertencias.length}):\n  - ${advertencias.join('\n  - ')}`);
  console.log(
    aplicar
      ? '\nCambios guardados.'
      : '\nSimulación: no se guardó ningún cambio. Para guardarlos, repita el comando con --aplicar.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
