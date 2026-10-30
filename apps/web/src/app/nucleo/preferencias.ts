/**
 * Preferencias de este navegador (localStorage). Si el almacenamiento no está disponible
 * (navegación privada, sitio bloqueado), simplemente no se recuerdan.
 */
export function leerPreferencia(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarPreferencia(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible */
  }
}
