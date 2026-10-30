import type { CambiarPasswordInput, LoginInput } from '@nexustrack/shared';
import { Correo, Texto } from '../comun/validacion.js';

export class LoginDto implements LoginInput {
  @Correo('Correo')
  email!: string;

  @Texto('Contraseña', { max: 200 })
  password!: string;
}

export class CambiarPasswordDto implements CambiarPasswordInput {
  @Texto('Contraseña actual', { max: 200 })
  actual!: string;

  @Texto('Nueva contraseña', { max: 200 })
  nueva!: string;
}

/** Política mínima de contraseñas: 8 caracteres con letras y números. */
export function passwordSegura(password: string): boolean {
  return (
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
  );
}
