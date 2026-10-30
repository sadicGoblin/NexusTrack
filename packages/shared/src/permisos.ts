import type { Rol } from './enums.js';

/**
 * Matriz de permisos por rol. La API la aplica en cada endpoint y la web la usa
 * para mostrar u ocultar acciones.
 */
export const PERMISOS = {
  /** Consultar cualquier mantenedor o documento. */
  ver: ['ADMIN', 'OPERACIONES', 'FINANZAS', 'LECTURA'],
  /** Empresas, clientes, packings, móviles, conductores y asignaciones. */
  editarMantenedores: ['ADMIN', 'OPERACIONES'],
  /** Rutas y tarifas. */
  editarTarifas: ['ADMIN', 'OPERACIONES', 'FINANZAS'],
  /** Listas maestras de BaseDatos. */
  editarCatalogos: ['ADMIN'],
  /** Órdenes de retiro y órdenes de carga. */
  editarOperacion: ['ADMIN', 'OPERACIONES'],
  /** Vales de dinero, vales de combustible y rendiciones. */
  editarFinanzas: ['ADMIN', 'OPERACIONES', 'FINANZAS'],
  /** Anular cualquier documento. */
  anular: ['ADMIN'],
  /** Usuarios, parámetros y auditoría. */
  administrar: ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function tienePermiso(rol: Rol | null | undefined, permiso: Permiso): boolean {
  return !!rol && (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}
