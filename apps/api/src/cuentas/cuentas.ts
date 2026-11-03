import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  armarCuenta,
  ORIGEN_ESTADIA,
  resumirCuenta,
  type CuentaConductorDto,
  type DetalleCuentaDto,
  type FleteSinCalcular,
} from '@nexustrack/shared';
import { noEncontrado } from '../comun/errores.js';
import { aIso } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Datos de cada flete que mueven la cuenta: anticipos emitidos y rendiciones emitidas. */
const seleccion = {
  id: true,
  numero: true,
  fecha: true,
  conductorId: true,
  cliente: { select: { nombre: true } },
  origen: { select: { valor: true } },
  destino: { select: { valor: true } },
  valesDinero: {
    where: { estado: 'EMITIDO' },
    select: { id: true, numero: true, fechaEntrega: true, monto: true },
    orderBy: { numero: 'asc' },
  },
  ordenesCarga: {
    where: { estado: { not: 'ANULADA' } },
    select: {
      rendiciones: {
        where: { estado: 'EMITIDO' },
        select: { id: true, numero: true, fecha: true, totalGeneral: true },
      },
    },
  },
} satisfies Prisma.OrdenRetiroSelect;

/** Una estadía emitida es su propia rendición; sus anticipos son los vales que la apuntan. */
const seleccionEstadia = {
  id: true,
  numero: true,
  fecha: true,
  fechaSalida: true,
  totalGeneral: true,
  conductorId: true,
  destino: { select: { valor: true } },
  valesDinero: {
    where: { estado: 'EMITIDO' },
    select: { id: true, numero: true, fechaEntrega: true, monto: true },
    orderBy: { numero: 'asc' },
  },
} satisfies Prisma.RendicionSelect;

const conductorSeleccion = {
  id: true,
  nombre: true,
  rut: true,
  empresa: { select: { razonSocial: true } },
} satisfies Prisma.ConductorSelect;

/**
 * Cuenta corriente de cada conductor: anticipos (vales de dinero) contra lo rendido, flete a
 * flete. Se calcula al vuelo desde los documentos; no guarda nada propio.
 */
@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  private async fletes(
    conductorId?: number,
  ): Promise<{ conductorId: number; flete: FleteSinCalcular }[]> {
    const filas = await this.prisma.ordenRetiro.findMany({
      where: {
        estado: { not: 'ANULADA' },
        ...(conductorId ? { conductorId } : {}),
        OR: [
          { valesDinero: { some: { estado: 'EMITIDO' } } },
          {
            ordenesCarga: {
              some: {
                estado: { not: 'ANULADA' },
                rendiciones: { some: { estado: 'EMITIDO' } },
              },
            },
          },
        ],
      },
      select: seleccion,
    });
    const estadias = await this.prisma.rendicion.findMany({
      where: {
        tipo: 'ESTADIA',
        estado: 'EMITIDO',
        ...(conductorId ? { conductorId } : {}),
      },
      select: seleccionEstadia,
    });
    const vales = (
      lista: {
        id: number;
        numero: number;
        fechaEntrega: Date;
        monto: number;
      }[],
    ) =>
      lista.map((v) => ({
        id: v.id,
        numero: v.numero,
        fecha: aIso(v.fechaEntrega)!,
        monto: v.monto,
      }));
    const deEstadias = estadias.map((e) => ({
      conductorId: e.conductorId!,
      flete: {
        clave: `E${e.id}`,
        tipo: 'ESTADIA' as const,
        ordenRetiroId: null,
        ordenRetiroNumero: null,
        fecha: aIso(e.fechaSalida)!,
        cliente: null,
        origen: ORIGEN_ESTADIA,
        destino: e.destino!.valor,
        vales: vales(e.valesDinero),
        rendicionId: e.id,
        rendicionNumero: e.numero,
        fechaRendicion: aIso(e.fecha),
        rendido: e.totalGeneral,
      },
    }));
    const deFletes = filas.map((o) => {
      const rendiciones = o.ordenesCarga.flatMap((c) => c.rendiciones);
      const r = rendiciones[0];
      return {
        conductorId: o.conductorId,
        flete: {
          clave: `R${o.id}`,
          tipo: 'FLETE' as const,
          ordenRetiroId: o.id,
          ordenRetiroNumero: o.numero,
          fecha: aIso(o.fecha)!,
          cliente: o.cliente.nombre,
          origen: o.origen.valor,
          destino: o.destino.valor,
          vales: vales(o.valesDinero),
          rendicionId: r?.id ?? null,
          rendicionNumero: r?.numero ?? null,
          fechaRendicion: r ? aIso(r.fecha) : null,
          rendido: r
            ? rendiciones.reduce((s, x) => s + x.totalGeneral, 0)
            : null,
        },
      };
    });
    return [...deFletes, ...deEstadias];
  }

  /** Conductores con anticipos o rendiciones, con su saldo. */
  async listar(): Promise<CuentaConductorDto[]> {
    const fletes = await this.fletes();
    const porConductor = new Map<number, FleteSinCalcular[]>();
    for (const { conductorId, flete } of fletes) {
      if (!porConductor.has(conductorId)) porConductor.set(conductorId, []);
      porConductor.get(conductorId)!.push(flete);
    }
    const conductores = await this.prisma.conductor.findMany({
      where: { id: { in: [...porConductor.keys()] } },
      select: conductorSeleccion,
      orderBy: { nombre: 'asc' },
    });
    return conductores.map((c) => ({
      conductorId: c.id,
      conductor: c.nombre,
      rut: c.rut,
      empresa: c.empresa.razonSocial,
      ...resumirCuenta(armarCuenta(porConductor.get(c.id)!)),
    }));
  }

  async detalle(conductorId: number): Promise<DetalleCuentaDto> {
    const c = await this.prisma.conductor.findUnique({
      where: { id: conductorId },
      select: conductorSeleccion,
    });
    if (!c) throw noEncontrado('El conductor');
    const fletes = armarCuenta(
      (await this.fletes(conductorId)).map((f) => f.flete),
    );
    return {
      conductorId: c.id,
      conductor: c.nombre,
      rut: c.rut,
      empresa: c.empresa.razonSocial,
      ...resumirCuenta(fletes),
      fletes,
    };
  }
}

@ApiTags('Documentos')
@Controller('cuentas-conductores')
export class CuentasController {
  constructor(private readonly servicio: CuentasService) {}

  @Get() listar() {
    return this.servicio.listar();
  }

  @Get(':conductorId') detalle(
    @Param('conductorId', ParseIntPipe) conductorId: number,
  ) {
    return this.servicio.detalle(conductorId);
  }
}

@Module({
  controllers: [CuentasController],
  providers: [CuentasService],
})
export class CuentasModule {}
