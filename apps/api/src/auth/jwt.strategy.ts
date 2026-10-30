import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import passportJwt from 'passport-jwt';
import type { Rol, UsuarioSesion } from '@nexustrack/shared';

const { ExtractJwt, Strategy } = passportJwt;

export interface PayloadAcceso {
  sub: number;
  email: string;
  nombre: string;
  rol: Rol;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: PayloadAcceso): UsuarioSesion {
    return {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
  }
}
