import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { SesionService } from '../../nucleo/sesion.service';

@Component({
  selector: 'nt-login',
  imports: [FormsModule, InputText, Password, Button, Message],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  async ingresar(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Ingrese su correo y contraseña.');
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.sesion.iniciar(this.email.trim(), this.password);
      const volver = this.ruta.snapshot.queryParamMap.get('volver');
      await this.router.navigateByUrl(
        volver && volver.startsWith('/') && !volver.startsWith('/login') ? volver : '/inicio',
      );
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.error.set(
        status === 401
          ? 'Correo o contraseña incorrectos.'
          : status === 429
            ? 'Demasiados intentos. Espere un minuto e intente nuevamente.'
            : 'No se pudo conectar con el servidor.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
