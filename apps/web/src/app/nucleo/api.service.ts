import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './config';
import type { ExportarTablaInput } from '@nexustrack/shared';

type Parametros = Record<string, string | number | boolean | null | undefined>;

/** La pantalla muestra el error por su cuenta: el interceptor no levanta el aviso general. */
export const SIN_AVISO = new HttpContextToken<boolean>(() => false);

/** Acceso tipado a la API REST. Las rutas son relativas a la base de la API (ver config.ts). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(ruta: string, parametros?: Parametros, opciones: { sinAviso?: boolean } = {}): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${API_BASE}/${ruta}`, {
        params: this.params(parametros),
        context: new HttpContext().set(SIN_AVISO, !!opciones.sinAviso),
      }),
    );
  }

  post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${API_BASE}/${ruta}`, cuerpo));
  }

  put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${API_BASE}/${ruta}`, cuerpo));
  }

  eliminar(ruta: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/${ruta}`));
  }

  /** Descarga un archivo generado por la API (PDF o Excel) con el nombre que propone el servidor. */
  async descargar(ruta: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.get(`${API_BASE}/${ruta}`, { responseType: 'blob', observe: 'response' }),
    );
    guardarArchivo(r.body!, nombreArchivo(r.headers.get('content-disposition')) ?? 'documento');
  }

  async exportarTabla(entrada: ExportarTablaInput): Promise<void> {
    const r = await firstValueFrom(
      this.http.post(`${API_BASE}/exportacion/tabla`, entrada, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    guardarArchivo(
      r.body!,
      nombreArchivo(r.headers.get('content-disposition')) ?? `listado.${entrada.formato}`,
    );
  }

  private params(p?: Parametros): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(p ?? {})) {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    }
    return params;
  }
}

function nombreArchivo(disposicion: string | null): string | null {
  return disposicion?.match(/filename="?([^";]+)"?/)?.[1] ?? null;
}

function guardarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
