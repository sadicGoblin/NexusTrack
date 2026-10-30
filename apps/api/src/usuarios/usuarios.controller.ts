import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { hash } from '@node-rs/argon2';
import {
  Rol,
  type UsuarioDto,
  type UsuarioInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { invalido, noEncontrado } from '../comun/errores.js';
import { Booleano, Correo, Opcion, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { passwordSegura } from '../auth/auth.dto.js';
import type { Usuario } from '../generated/prisma/client.js';

class UsuarioDtoIn implements UsuarioInput {
  @Correo('Correo') email!: string;
  @Texto('Nombre', { max: 120 }) nombre!: string;
  @Opcion('Rol', Object.values(Rol)) rol!: Rol;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Texto('Contraseña', { opcional: true, max: 200 }) password?: string;
}

function aDto(u: Usuario): UsuarioDto {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
    creadoEn: u.creadoEn.toISOString(),
  };
}

@ApiTags('Administración')
@RequierePermiso('administrar')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  async listar(): Promise<UsuarioDto[]> {
    return (
      await this.prisma.usuario.findMany({ orderBy: { nombre: 'asc' } })
    ).map(aDto);
  }

  @Post()
  async crear(
    @Body() dto: UsuarioDtoIn,
    @UsuarioActual() actual: UsuarioSesion,
  ): Promise<UsuarioDto> {
    if (!dto.password || !passwordSegura(dto.password)) {
      throw invalido(
        'La contraseña debe tener al menos 8 caracteres, con letras y números.',
      );
    }
    const passwordHash = await hash(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          email: dto.email,
          nombre: dto.nombre,
          rol: dto.rol,
          activo: dto.activo ?? true,
          passwordHash,
        },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Usuario',
        entidadId: u.id,
        accion: 'CREAR',
        usuarioId: actual.id,
        cambios: this.auditoria.instantanea(u),
      });
      return aDto(u);
    });
  }

  @Put(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UsuarioDtoIn,
    @UsuarioActual() actual: UsuarioSesion,
  ): Promise<UsuarioDto> {
    const antes = await this.prisma.usuario.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El usuario');
    if (id === actual.id && (dto.activo === false || dto.rol !== 'ADMIN')) {
      throw invalido(
        'No puede desactivar su propio usuario ni quitarse el rol de administrador.',
      );
    }
    if (dto.password && !passwordSegura(dto.password)) {
      throw invalido(
        'La contraseña debe tener al menos 8 caracteres, con letras y números.',
      );
    }
    const activo = dto.activo ?? antes.activo;
    const invalidarSesiones =
      !!dto.password || (antes.activo && !activo) || antes.rol !== dto.rol;
    const passwordHash = dto.password ? await hash(dto.password) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({
        where: { id },
        data: {
          email: dto.email,
          nombre: dto.nombre,
          rol: dto.rol,
          activo,
          ...(passwordHash ? { passwordHash } : {}),
          ...(invalidarSesiones ? { versionToken: { increment: 1 } } : {}),
        },
      });
      const cambios = this.auditoria.diferencias(antes, u);
      if (dto.password)
        cambios['password'] = { antes: '***', despues: '*** (cambiada)' };
      await this.auditoria.registrar(tx, {
        entidad: 'Usuario',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: actual.id,
        cambios,
      });
      return aDto(u);
    });
  }
}
