/**
 * Carga órdenes de retiro desde la planilla del cliente (hoja con el encabezado «Fecha de Orden
 * de Retiro», como la hoja «Orden de Retiro»).
 *
 * - Por defecto solo simula: muestra qué órdenes crearía y qué filas no entran, sin guardar.
 * - Con --aplicar crea las filas válidas en una sola transacción.
 * - Cada fila se valida como en la pantalla: trazabilidad, conductor, camión, remolque, empresa,
 *   cliente, ciudades, depósitos, packings y puerto deben existir y estar activos (los nombres se
 *   comparan sin tildes ni mayúsculas). Una fila con datos que no existen no entra.
 * - Una fila igual a una orden ya registrada (fecha, conductor, camión, cliente y carga) se salta,
 *   para poder repetir la carga sin duplicar.
 * - El número lo asigna el sistema, en orden de fecha; la orden queda Abierta y en la auditoría.
 *
 * Uso: npx tsx prisma/importar-retiros.ts <planilla.xlsx> [--aplicar] [--usuario correo]
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { GRUPOS_MOVIL, remolqueSegunTrazabilidad, type GrupoMovil } from '@nexustrack/shared';
import { PrismaClient, type Prisma } from '../apps/api/src/generated/prisma/client.js';
import { fecha, leerTabla, normalizar, texto, textoONulo, type Celda } from './planilla.js';

type Tx = Prisma.TransactionClient;

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes('--aplicar');
const iUsuario = argumentos.indexOf('--usuario');
const correoUsuario = iUsuario >= 0 ? argumentos[iUsuario + 1] : undefined;
const archivo = argumentos.find((a, i) => !a.startsWith('--') && (iUsuario < 0 || i !== iUsuario + 1));
if (!archivo) {
  console.error('Uso: npx tsx prisma/importar-retiros.ts <planilla.xlsx> [--aplicar] [--usuario correo]');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** Error para deshacer la transacción cuando solo se simula. */
class Simulacion extends Error {}

const fechaCorta = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
const correlativo = (n: number) => String(n).padStart(6, '0');
const mayusculas = (v: Celda) => textoONulo(v)?.toUpperCase() ?? null;
const patente = (v: Celda) =>
  texto(v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** Hora «HH:mm»: Excel la guarda como fecha de 1899, como fracción del día o como texto. */
function hora(v: Celda): string | null {
  const dos = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date) return `${dos(v.getUTCHours())}:${dos(v.getUTCMinutes())}`;
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const minutos = Math.round(v * 24 * 60);
    return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
  }
  const m = texto(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${dos(Number(m[1]))}:${m[2]}` : null;
}

/** Grupo de remolque que indica la columna «Tipo Remolque» (CHASIS, THERMO, PLATAFORMA). */
function grupoDeTipo(tipo: string): GrupoMovil | null {
  const t = normalizar(tipo);
  if (t.includes('THERMO')) return 'thermo';
  if (t.includes('CHASIS')) return 'chasis';
  if (t.includes('PLATAFORMA')) return 'plataforma';
  return null;
}

async function main() {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(path.resolve(archivo!));
  const ws = libro.worksheets.find((h) => {
    try {
      leerTabla(h, 'Fecha de Orden de Retiro');
      return true;
    } catch {
      return false;
    }
  });
  if (!ws) throw new Error('La planilla no tiene una hoja con el encabezado «Fecha de Orden de Retiro».');
  const usuario = await prisma.usuario.findFirst({
    where: correoUsuario ? { email: correoUsuario } : { rol: 'ADMIN', activo: true },
    orderBy: { id: 'asc' },
  });
  if (!usuario) throw new Error('No se encontró el usuario a cuyo nombre se registran las órdenes.');
  console.log(
    `${aplicar ? 'Importando' : 'Simulando'} ${path.basename(archivo!)} (hoja ${ws.name}) como ${usuario.email}…`,
  );

  const creadas: string[] = [];
  const existentes: string[] = [];
  const errores: string[] = [];
  const advertencias: string[] = [];
  let filas = 0;

  try {
    await prisma.$transaction(
      async (tx: Tx) => {
        const catalogo = await tx.catalogoItem.findMany();
        const conductores = await tx.conductor.findMany();
        const moviles = await tx.movil.findMany({ include: { tipo: true } });
        const empresas = await tx.empresa.findMany();
        const clientes = await tx.cliente.findMany();
        const packings = await tx.packing.findMany();

        // Encabezado en la fila de la tabla: los datos parten en la siguiente.
        let filaExcel = 0;
        ws.eachRow((row, n) => {
          if (
            !filaExcel &&
            row.values &&
            (row.values as Celda[]).some((v) => texto(v) === 'Fecha de Orden de Retiro')
          )
            filaExcel = n;
        });

        const pedidas: {
          fila: number;
          datos: Prisma.OrdenRetiroUncheckedCreateInput;
          resumen: string;
          clave: string;
        }[] = [];
        for (const f of leerTabla(ws, 'Fecha de Orden de Retiro')) {
          filaExcel++;
          filas++;
          const fila = filaExcel;
          const faltan: string[] = [];

          const deCatalogo = (columna: string, tipo: string, obligatorio: boolean) => {
            const valor = texto(f[columna]);
            if (!valor) {
              if (obligatorio) faltan.push(`${columna} vacío`);
              return null;
            }
            const item = catalogo.find((c) => c.tipo === tipo && normalizar(c.valor) === normalizar(valor));
            if (!item) faltan.push(`${columna} «${valor}» no existe`);
            else if (!item.activo) faltan.push(`${columna} «${valor}» está inactivo`);
            return item ?? null;
          };
          const unico = <T extends { activo: boolean }>(
            columna: string,
            lista: T[],
            nombre: (x: T) => string,
            obligatorio: boolean,
          ) => {
            const valor = texto(f[columna]);
            if (!valor) {
              if (obligatorio) faltan.push(`${columna} vacío`);
              return null;
            }
            const x = lista.find((e) => normalizar(nombre(e)) === normalizar(valor));
            if (!x) faltan.push(`${columna} «${valor}» no existe`);
            else if (!x.activo) faltan.push(`${columna} «${valor}» está inactivo`);
            return x ?? null;
          };
          const movil = (columna: string, grupos: GrupoMovil[], obligatorio: boolean) => {
            const p = patente(f[columna]);
            if (!p) {
              if (obligatorio) faltan.push(`${columna} vacía`);
              return null;
            }
            const m = moviles.find((x) => x.patente === p);
            const codigos = grupos.flatMap((g) => GRUPOS_MOVIL[g] as readonly string[]);
            if (!m) faltan.push(`${columna} ${p} no existe en Móviles`);
            else if (!codigos.includes(m.tipo.codigo ?? ''))
              faltan.push(`${columna} ${p} es ${m.tipo.valor}`);
            else if (!m.activo) faltan.push(`${columna} ${p} está inactiva`);
            return m ?? null;
          };

          const fechaOrden = fecha(f['Fecha de Orden de Retiro']);
          if (!fechaOrden) faltan.push('Fecha de Orden de Retiro vacía o no válida');
          const trazabilidad = deCatalogo('Trazabilidad', 'TRAZABILIDAD', true);
          const conductor = unico('Conductor', conductores, (c) => c.nombre, true);
          const camion = movil('Patente Camión', ['camion'], true);
          const remolque = movil('Patente Remolque', ['chasis', 'thermo', 'plataforma'], false);
          const empresa = unico('Empresa', empresas, (e) => e.razonSocial, true);
          const cliente = unico('Cliente', clientes, (c) => c.nombre, true);
          const origen = deCatalogo('Origen', 'CIUDAD', true);
          const destino = deCatalogo('Destino', 'CIUDAD', true);
          const depositoRetiro = deCatalogo('Depósito de Retiro', 'DEPOSITO', false);
          const depositoEntrega = deCatalogo('Depósito de Entrega', 'DEPOSITO', false);
          const puerto = deCatalogo('Puerto de Embarque', 'PUERTO_EMBARQUE', false);
          // El packing es del cliente, como en la pantalla.
          const packing = (columna: string) => {
            const valor = texto(f[columna]);
            if (!valor) return null;
            const delCliente = packings.find(
              (p) => normalizar(p.nombre) === normalizar(valor) && p.clienteId === cliente?.id,
            );
            if (delCliente) {
              if (!delCliente.activo) faltan.push(`${columna} «${valor}» está inactivo`);
              return delCliente;
            }
            const otro = packings.find((p) => normalizar(p.nombre) === normalizar(valor));
            faltan.push(
              otro ? `${columna} «${valor}» es de otro cliente` : `${columna} «${valor}» no existe`,
            );
            return null;
          };
          const packingCarga = packing('Packing de Carga');
          const packingEntrega = packing('Packing de Entrega');

          const etiqueta = `Fila ${fila}`;
          if (faltan.length) {
            errores.push(`${etiqueta}: ${faltan.join('; ')}.`);
            continue;
          }

          // Avisos que no impiden la carga.
          const tipoPlanilla = texto(f['Tipo Remolque']);
          const grupoRemolque = remolque
            ? (Object.entries(GRUPOS_MOVIL).find(([, c]) =>
                (c as readonly string[]).includes(remolque.tipo.codigo ?? ''),
              )?.[0] as GrupoMovil)
            : null;
          if (
            remolque &&
            tipoPlanilla &&
            grupoDeTipo(tipoPlanilla) &&
            grupoDeTipo(tipoPlanilla) !== grupoRemolque
          )
            advertencias.push(
              `${etiqueta}: la planilla dice ${tipoPlanilla}, pero ${remolque.patente} es ${remolque.tipo.valor}; se usa el tipo de Móviles.`,
            );
          const pedido = remolqueSegunTrazabilidad(trazabilidad!.valor);
          if (remolque && pedido && grupoRemolque !== pedido)
            advertencias.push(
              `${etiqueta}: ${trazabilidad!.valor} lleva ${pedido}, pero el remolque ${remolque.patente} es ${remolque.tipo.valor}.`,
            );

          const fechaCarga = fecha(f['Fecha de Carga']);
          const horaCarga = hora(f['Hora de Carga']);
          const datos: Prisma.OrdenRetiroUncheckedCreateInput = {
            numero: 0,
            fecha: fechaOrden!,
            estado: 'ABIERTA',
            trazabilidadId: trazabilidad!.id,
            conductorId: conductor!.id,
            camionId: camion!.id,
            remolqueId: remolque?.id ?? null,
            tipoRemolque: remolque?.tipo.valor ?? null,
            empresaId: empresa!.id,
            clienteId: cliente!.id,
            origenId: origen!.id,
            destinoId: destino!.id,
            depositoRetiroId: depositoRetiro?.id ?? null,
            packingCargaId: packingCarga?.id ?? null,
            fechaCarga,
            horaCarga,
            depositoEntregaId: depositoEntrega?.id ?? null,
            packingEntregaId: packingEntrega?.id ?? null,
            destinoFinal: mayusculas(f['Destino2']),
            nave: mayusculas(f['Nave']),
            mtb: mayusculas(f['MTB']),
            booking: mayusculas(f['Booking']),
            puertoEmbarqueId: puerto?.id ?? null,
            fechaEmbarque: fecha(f['Fecha de Embarque']),
            horaEmbarque: hora(f['Hora Embarque']),
            opNumero: mayusculas(f['OP N°']),
            ordenCompra: mayusculas(f['O/C']),
            observaciones: textoONulo(f['Observaciones']),
            creadoPorId: usuario.id,
            actualizadoPorId: usuario.id,
          };
          const clave = [
            fechaOrden!.getTime(),
            conductor!.id,
            camion!.id,
            cliente!.id,
            fechaCarga?.getTime(),
            horaCarga,
          ].join('|');
          const repetida = pedidas.find((p) => p.clave === clave);
          if (repetida) {
            existentes.push(`${etiqueta}: repite la fila ${repetida.fila}; se carga una sola vez.`);
            continue;
          }
          const ya = await tx.ordenRetiro.findFirst({
            where: {
              estado: { not: 'ANULADA' },
              fecha: fechaOrden!,
              conductorId: conductor!.id,
              camionId: camion!.id,
              clienteId: cliente!.id,
              fechaCarga,
              horaCarga,
            },
          });
          if (ya) {
            existentes.push(`${etiqueta}: ya está registrada como N° ${correlativo(ya.numero)}.`);
            continue;
          }
          pedidas.push({
            fila,
            datos,
            clave,
            resumen: `${fechaCorta(fechaOrden!)} · ${trazabilidad!.valor} · ${cliente!.nombre} · ${origen!.valor} → ${destino!.valor} · ${conductor!.nombre} · ${camion!.patente}${remolque ? ` / ${remolque.patente}` : ''}`,
          });
        }

        // Números en orden de fecha; a igual fecha, en el orden de la planilla.
        pedidas.sort(
          (a, b) => (a.datos.fecha as Date).getTime() - (b.datos.fecha as Date).getTime() || a.fila - b.fila,
        );
        for (const p of pedidas) {
          const { ultimo: numero } = await tx.secuencia.update({
            where: { tipo: 'ORDEN_RETIRO' },
            data: { ultimo: { increment: 1 } },
          });
          const o = await tx.ordenRetiro.create({ data: { ...p.datos, numero } });
          await tx.auditoria.create({
            data: {
              entidad: 'OrdenRetiro',
              entidadId: o.id,
              accion: 'CREAR',
              usuarioId: usuario.id,
              cambios: {
                importadoDe: `${path.basename(archivo!)}, fila ${p.fila}`,
                ...Object.fromEntries(
                  Object.entries(o)
                    .filter(
                      ([k]) =>
                        !['id', 'creadoEn', 'actualizadoEn', 'creadoPorId', 'actualizadoPorId'].includes(k),
                    )
                    .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
                ),
              },
            },
          });
          creadas.push(`Fila ${p.fila} → N° ${correlativo(numero)} · ${p.resumen}`);
        }
        if (!aplicar) throw new Simulacion();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (!(e instanceof Simulacion)) throw e;
  }

  console.table({
    'Filas de la planilla': filas,
    [aplicar ? 'Órdenes creadas' : 'Órdenes que se crearían']: creadas.length,
    'Ya registradas o repetidas': existentes.length,
    'Con errores (no entran)': errores.length,
  });
  if (creadas.length)
    console.log(
      `\n${aplicar ? 'Creadas' : 'Se crearían'} (${creadas.length}):\n  - ${creadas.join('\n  - ')}`,
    );
  if (existentes.length) console.log(`\nSaltadas (${existentes.length}):\n  - ${existentes.join('\n  - ')}`);
  if (errores.length) console.log(`\nErrores (${errores.length}):\n  - ${errores.join('\n  - ')}`);
  if (advertencias.length)
    console.log(`\nAdvertencias (${advertencias.length}):\n  - ${advertencias.join('\n  - ')}`);
  console.log(
    aplicar
      ? '\nÓrdenes guardadas.'
      : '\nSimulación: no se guardó nada. Para guardar, repita el comando con --aplicar.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
