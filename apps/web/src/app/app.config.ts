import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { interceptorErrores, interceptorSesion } from './nucleo/interceptores';
import { TemaNexus } from './nucleo/tema';
import { TRADUCCION_ES } from './nucleo/traduccion';

registerLocaleData(localeEsCl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([interceptorSesion, interceptorErrores])),
    providePrimeNG({
      theme: { preset: TemaNexus, options: { darkModeSelector: '.nt-oscuro', cssLayer: false } },
      translation: TRADUCCION_ES,
      ripple: false,
    }),
    { provide: LOCALE_ID, useValue: 'es-CL' },
    MessageService,
    ConfirmationService,
  ],
};
