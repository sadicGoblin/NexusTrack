import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validarEntorno } from './comun/entorno.js';
import { FiltroErroresPrisma } from './comun/filtro-errores.js';
import { JwtGuard, PermisosGuard } from './comun/guards.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SaludController } from './salud/salud.controller.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { ParametrosModule } from './parametros/parametros.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { EmpresasModule } from './empresas/empresas.js';
import { ClientesModule } from './clientes/clientes.js';
import { PackingsModule } from './packings/packings.js';
import { MovilesModule } from './moviles/moviles.js';
import { ConductoresModule } from './conductores/conductores.js';
import { AsignacionesModule } from './asignaciones/asignaciones.js';
import { RutasTarifasModule } from './rutas-tarifas/rutas-tarifas.js';
import { ExportacionModule } from './exportacion/exportacion.js';
import { OrdenesRetiroModule } from './documentos/ordenes-retiro.js';
import { ValesDineroModule } from './documentos/vales-dinero.js';
import { OrdenesCargaModule } from './documentos/ordenes-carga.js';
import { ValesCombustibleModule } from './documentos/vales-combustible.js';
import { RendicionesModule } from './documentos/rendiciones.js';
import { InicioModule } from './inicio/inicio.js';
import { CuentasModule } from './cuentas/cuentas.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validarEntorno,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    ParametrosModule,
    AuditoriaModule,
    CatalogosModule,
    EmpresasModule,
    ClientesModule,
    PackingsModule,
    MovilesModule,
    ConductoresModule,
    AsignacionesModule,
    RutasTarifasModule,
    ExportacionModule,
    OrdenesRetiroModule,
    ValesDineroModule,
    OrdenesCargaModule,
    ValesCombustibleModule,
    RendicionesModule,
    CuentasModule,
    InicioModule,
  ],
  controllers: [SaludController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
    { provide: APP_FILTER, useClass: FiltroErroresPrisma },
  ],
})
export class AppModule {}
