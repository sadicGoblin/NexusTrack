import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { SesionDto, UsuarioSesion } from '@nexustrack/shared';
import { invalido } from '../comun/errores.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Usuario } from '../generated/prisma/client.js';
import { passwordSegura } from './auth.dto.js';
import type { PayloadAcceso } from './jwt.strategy.js';

interface PayloadRefresh {
  sub: number;
  tv: number;
}

export interface Tokens {
  sesion: SesionDto;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

/** Hash de referencia para igualar el tiempo de respuesta cuando el correo no existe. */
const HASH_SEÑUELO = hash('nexustrack-señuelo');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<Tokens> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    });
    const valido = usuario
      ? await verify(usuario.passwordHash, password)
      : (await verify(await HASH_SEÑUELO, password), false);
    if (!usuario || !valido || !usuario.activo) {
      this.logger.warn(`Inicio de sesión rechazado para ${email}`);
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });
    return this.emitir(usuario);
  }

  async refrescar(refreshToken: string | undefined): Promise<Tokens> {
    if (!refreshToken) throw new UnauthorizedException('Sesión expirada.');
    let payload: PayloadRefresh;
    try {
      payload = await this.jwt.verifyAsync<PayloadRefresh>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sesión expirada.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (!usuario || !usuario.activo || usuario.versionToken !== payload.tv) {
      throw new UnauthorizedException('Sesión expirada.');
    }
    return this.emitir(usuario);
  }

  async cambiarPassword(
    usuarioId: number,
    actual: string,
    nueva: string,
  ): Promise<Tokens> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
    });
    if (!(await verify(usuario.passwordHash, actual)))
      throw invalido('La contraseña actual no es correcta.');
    if (!passwordSegura(nueva))
      throw invalido(
        'La nueva contraseña debe tener al menos 8 caracteres, con letras y números.',
      );
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await hash(nueva), versionToken: { increment: 1 } },
    });
    return this.emitir(actualizado);
  }

  aSesion(u: Pick<Usuario, 'id' | 'email' | 'nombre' | 'rol'>): UsuarioSesion {
    return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
  }

  private async emitir(usuario: Usuario): Promise<Tokens> {
    const acceso: PayloadAcceso = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
    const ttl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const accessToken = await this.jwt.signAsync(acceso, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: ttl as never,
    });
    const dias = Number(this.config.get('JWT_REFRESH_TTL_DIAS') ?? 7);
    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id, tv: usuario.versionToken } satisfies PayloadRefresh,
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: `${dias}d` as never,
      },
    );
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(
      accessToken,
    );
    return {
      sesion: {
        accessToken,
        expiraEn: exp - iat,
        usuario: this.aSesion(usuario),
      },
      refreshToken,
      refreshMaxAgeMs: dias * 86_400_000,
    };
  }
}
