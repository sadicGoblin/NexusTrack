/**
 * Dirección de la API.
 * - Desarrollo y despliegue con Caddy: vacía, la API está en el mismo origen (/api).
 * - Firebase Hosting: se define al compilar, por ejemplo
 *   ng build --define NT_API_URL="'https://api.nexustrack.midominio.cl'"
 */
declare const NT_API_URL: string | undefined;

const ORIGEN_API = typeof NT_API_URL !== 'undefined' ? NT_API_URL.replace(/\/+$/, '') : '';

export const API_BASE = `${ORIGEN_API}/api`;
