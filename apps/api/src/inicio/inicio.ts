import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  diasEntre,
  hoyIso,
  rangoMes,
  sumarDias,
  type InicioDto,
  type VencimientoDto,
} from '@nexustrack/shared';
import { aFecha, aIso } from '../comun/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { aResumenRetiro, includeRetiro } from '../documentos/retiro.mapper.js';

@Injectable()
export class InicioService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(): Promise<InicioDto> {
    const hoy = hoyIso();
    const [anio, mes] = hoy.split('-').map(Number);
    const mesActual = rangoMes(anio, mes);
    const diasAlerta = Number(
      (
        await this.prisma.parametro.findUnique({
          where: { clave: 'DIAS_ALERTA_VENCIMIENTO' },
        })
      )?.valor || 30,
    );
    const limite = aFecha(sumarDias(hoy, diasAlerta))!;
    const enMes = {
      gte: aFecha(mesActual.desde)!,
      lte: aFecha(mesActual.hasta)!,
    };

    const [
      retirosAbiertos,
      sinCarga,
      porRendir,
      sinConfirmar,
      valesMes,
      combustibleMes,
      rutas,
      moviles,
      conductores,
    ] = await Promise.all([
      this.prisma.ordenRetiro.count({
        where: { estado: { in: ['ABIERTA', 'CON_CARGA'] } },
      }),
      this.prisma.ordenRetiro.findMany({
        where: { estado: 'ABIERTA' },
        include: includeRetiro,
        orderBy: { fecha: 'asc' },
        take: 50,
      }),
      this.prisma.ordenCarga.findMany({
        where: { estado: 'ABIERTA', hojaRuta: { not: null } },
        include: {
          ordenRetiro: { include: { cliente: true, conductor: true } },
        },
        orderBy: { fechaCarga: 'asc' },
        take: 50,
      }),
      this.prisma.ordenCarga.count({
        where: { estado: 'ABIERTA', hojaRuta: null },
      }),
      this.prisma.valeDinero.aggregate({
        where: { estado: 'EMITIDO', fechaEntrega: enMes },
        _count: true,
        _sum: { monto: true },
      }),
      this.prisma.valeCombustible.aggregate({
        where: { estado: 'EMITIDO', fechaEntrega: enMes },
        _sum: { totalLitros: true },
      }),
      this.prisma.rutaTarifa.findMany({
        where: { activo: true },
        select: { vigenciaHasta: true },
      }),
      this.prisma.movil.findMany({
        where: {
          activo: true,
          OR: [
            { vencRevisionTecnica: { lte: limite } },
            { vencPermisoCirculacion: { lte: limite } },
            { vencSeguro: { lte: limite } },
          ],
        },
        include: { tipo: true },
      }),
      this.prisma.conductor.findMany({
        where: { activo: true, vencLicencia: { lte: limite } },
      }),
    ]);

    const vencimientos: VencimientoDto[] = [];
    const agregar = (
      tipo: VencimientoDto['tipo'],
      referencia: string,
      detalle: string,
      fecha: Date | null,
      ruta: string,
    ) => {
      const iso = aIso(fecha);
      if (iso && iso <= aIso(limite)!)
        vencimientos.push({
          tipo,
          referencia,
          detalle,
          fecha: iso,
          dias: diasEntre(hoy, iso),
          ruta,
        });
    };
    for (const m of moviles) {
      agregar(
        'Revisión técnica',
        m.patente,
        m.tipo.valor,
        m.vencRevisionTecnica,
        '/mantenedores/moviles',
      );
      agregar(
        'Permiso de circulación',
        m.patente,
        m.tipo.valor,
        m.vencPermisoCirculacion,
        '/mantenedores/moviles',
      );
      agregar(
        'Seguro',
        m.patente,
        m.tipo.valor,
        m.vencSeguro,
        '/mantenedores/moviles',
      );
    }
    for (const c of conductores)
      agregar(
        'Licencia',
        c.nombre,
        c.rut,
        c.vencLicencia,
        '/mantenedores/conductores',
      );
    vencimientos.sort((a, b) => a.dias - b.dias);

    return {
      hoy,
      contadores: {
        retirosAbiertos,
        retirosSinCarga: sinCarga.length,
        cargasPorRendir: porRendir.length,
        cargasSinConfirmar: sinConfirmar,
        valesDineroMes: valesMes._count,
        montoValesDineroMes: valesMes._sum.monto ?? 0,
        combustibleMesLitros: combustibleMes._sum.totalLitros ?? 0,
        tarifasVencidas: rutas.filter(
          (r) => r.vigenciaHasta && aIso(r.vigenciaHasta)! < hoy,
        ).length,
      },
      retirosSinCarga: sinCarga.map(aResumenRetiro),
      cargasPorRendir: porRendir.map((o) => ({
        id: o.id,
        numero: o.numero,
        fechaCarga: aIso(o.fechaCarga)!,
        cliente: o.ordenRetiro.cliente.nombre,
        conductor: o.ordenRetiro.conductor.nombre,
        patenteCamion: o.patenteCamion,
        totalNeto: o.totalNeto,
        hojaRuta: o.hojaRuta,
      })),
      vencimientos,
    };
  }
}

@ApiTags('Inicio')
@Controller('inicio')
export class InicioController {
  constructor(private readonly servicio: InicioService) {}

  @Get() resumen() {
    return this.servicio.resumen();
  }
}

@Module({ controllers: [InicioController], providers: [InicioService] })
export class InicioModule {}
