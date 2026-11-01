import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  ClienteDto,
  ClienteInput,
  UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { exigirRutValido, enUso, noEncontrado } from '../comun/errores.js';
import { Booleano, Correo, Rut, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Cliente } from '../generated/prisma/client.js';

class ClienteDtoIn implements ClienteInput {
  @Rut('RUT') rut!: string;
  @Texto('Cliente', { max: 150, mayusculas: true }) nombre!: string;
  @Booleano('Activo', { opcional: true }) activo?: boolean;
  @Texto('Giro', { opcional: true, max: 150, mayusculas: true }) giro?:
    string | null;
  @Texto('Dirección', { opcional: true, max: 250, mayusculas: true })
  direccion?: string | null;
  @Texto('Contacto operaciones', { opcional: true, max: 150 })
  contactoOperaciones?: string | null;
  @Texto('Contacto administrativo', { opcional: true, max: 150 })
  contactoAdministrativo?: string | null;
  @Texto('Fono', { opcional: true, max: 40 }) fono?: string | null;
  @Correo('Email', { opcional: true }) email?: string | null;
}

class FiltroClientes {
  @Booleano('Solo activos', { opcional: true }) activos?: boolean;
}

export function aClienteDto(c: Cliente): ClienteDto {
  return {
    id: c.id,
    rut: c.rut,
    nombre: c.nombre,
    activo: c.activo,
    giro: c.giro,
    direccion: c.direccion,
    contactoOperaciones: c.contactoOperaciones,
    contactoAdministrativo: c.contactoAdministrativo,
    fono: c.fono,
    email: c.email,
  };
}

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(f: FiltroClientes): Promise<ClienteDto[]> {
    const filas = await this.prisma.cliente.findMany({
      where: f.activos ? { activo: true } : {},
      orderBy: { nombre: 'asc' },
    });
    return filas.map(aClienteDto);
  }

  async obtener(id: number): Promise<ClienteDto> {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (!c) throw noEncontrado('El cliente');
    return aClienteDto(c);
  }

  async crear(dto: ClienteDtoIn, u: UsuarioSesion): Promise<ClienteDto> {
    exigirRutValido(dto.rut);
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.cliente.create({
        data: {
          ...dto,
          activo: dto.activo ?? true,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Cliente',
        entidadId: c.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(c),
      });
      return aClienteDto(c);
    });
  }

  async actualizar(
    id: number,
    dto: ClienteDtoIn,
    u: UsuarioSesion,
  ): Promise<ClienteDto> {
    const antes = await this.prisma.cliente.findUnique({ where: { id } });
    if (!antes) throw noEncontrado('El cliente');
    exigirRutValido(dto.rut, antes.rut);
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.cliente.update({
        where: { id },
        data: {
          ...dto,
          activo: dto.activo ?? antes.activo,
          actualizadoPorId: u.id,
        },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Cliente',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, c),
      });
      return aClienteDto(c);
    });
  }
  /** Solo si nada lo usa; si no, el registro se desactiva. */
  async eliminar(id: number, u: UsuarioSesion): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.cliente.findUnique({ where: { id } });
      if (!r) throw noEncontrado('El cliente');
      await tx.cliente
        .delete({ where: { id } })
        .catch((e: unknown) =>
          enUso(
            e,
            'No se puede eliminar el cliente: tiene packings, tarifas o documentos asociados. Si ya no se usa, desactívelo.',
          ),
        );
      await this.auditoria.registrar(tx, {
        entidad: 'Cliente',
        entidadId: id,
        accion: 'ELIMINAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(r),
      });
    });
  }
}

@ApiTags('Mantenedores')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly servicio: ClientesService) {}

  @Get() listar(@Query() f: FiltroClientes) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  crear(@Body() dto: ClienteDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ClienteDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }

  @RequierePermiso('eliminar')
  @Delete(':id')
  @HttpCode(204)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.eliminar(id, u);
  }
}

@Module({ controllers: [ClientesController], providers: [ClientesService] })
export class ClientesModule {}
