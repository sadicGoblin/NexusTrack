import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  ParametroDto,
  ParametroInput,
  UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { invalido, noEncontrado } from '../comun/errores.js';
import { renumerarHojasRuta } from '../documentos/numeracion-hoja-ruta.js';
import { Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

class ParametroDtoIn implements ParametroInput {
  @Texto('Valor', { opcional: true, max: 300 }) valor!: string;
}

@ApiTags('Administración')
@Controller('parametros')
export class ParametrosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Visible para todos los perfiles: los formularios usan los valores por defecto. */
  @Get()
  async listar(): Promise<ParametroDto[]> {
    const filas = await this.prisma.parametro.findMany({
      orderBy: { clave: 'asc' },
    });
    return filas.map(({ clave, valor, descripcion }) => ({
      clave,
      valor,
      descripcion,
    }));
  }

  @RequierePermiso('administrar')
  @Put(':clave')
  async actualizar(
    @Param('clave') clave: string,
    @Body() dto: ParametroDtoIn,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<ParametroDto> {
    const antes = await this.prisma.parametro.findUnique({ where: { clave } });
    if (!antes) throw noEncontrado('El parámetro');
    const hojaRuta = clave === 'HOJA_RUTA_INICIAL';
    if (hojaRuta && !/^[1-9]\d{0,8}$/.test(dto.valor ?? ''))
      throw invalido(
        'El N° de la primera hoja de ruta debe ser un entero positivo.',
      );
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.parametro.update({
        where: { clave },
        data: { valor: dto.valor ?? '' },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Parametro',
        entidadId: 0,
        accion: 'EDITAR',
        usuarioId: usuario.id,
        cambios: { [clave]: { antes: antes.valor, despues: p.valor } },
      });
      // Todas las hojas de ruta se numeran desde este valor.
      if (hojaRuta) await renumerarHojasRuta(tx);
      return { clave: p.clave, valor: p.valor, descripcion: p.descripcion };
    });
  }
}
