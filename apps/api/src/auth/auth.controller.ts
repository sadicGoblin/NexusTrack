import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SesionDto, UsuarioSesion } from '@nexustrack/shared';
import { Publico, UsuarioActual } from '../comun/decoradores.js';
import { CambiarPasswordDto, LoginDto } from './auth.dto.js';
import { AuthService, type Tokens } from './auth.service.js';

const COOKIE = 'nt_refresh';
const RUTA_COOKIE = '/api/auth';

@ApiTags('Acceso')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionDto> {
    return this.responder(await this.auth.login(dto.email, dto.password), res);
  }

  @Publico()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionDto> {
    return this.responder(
      await this.auth.refrescar(req.cookies?.[COOKIE]),
      res,
    );
  }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE, this.opcionesCookie());
  }

  @Get('me')
  me(@UsuarioActual() usuario: UsuarioSesion): UsuarioSesion {
    return usuario;
  }

  @Post('cambiar-password')
  @HttpCode(200)
  async cambiarPassword(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() dto: CambiarPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionDto> {
    return this.responder(
      await this.auth.cambiarPassword(usuario.id, dto.actual, dto.nueva),
      res,
    );
  }

  private responder(tokens: Tokens, res: Response): SesionDto {
    res.cookie(COOKIE, tokens.refreshToken, {
      ...this.opcionesCookie(),
      maxAge: tokens.refreshMaxAgeMs,
    });
    return tokens.sesion;
  }

  /** SameSite configurable: "none" cuando la web está en otro sitio (exige HTTPS). */
  private opcionesCookie() {
    const sameSite =
      this.config.get<'strict' | 'lax' | 'none'>('COOKIE_SAMESITE') ?? 'strict';
    return {
      httpOnly: true,
      sameSite,
      secure:
        sameSite === 'none' || this.config.get('NODE_ENV') === 'production',
      path: RUTA_COOKIE,
    };
  }
}
