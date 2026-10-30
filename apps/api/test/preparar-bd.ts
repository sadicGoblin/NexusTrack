import { prepararBaseDePruebas } from '../../../prisma/preparar-pruebas.js';

/** globalSetup de Vitest. Los errores se muestran explícitamente porque Vitest los imprime mal. */
export default function (): void {
  try {
    prepararBaseDePruebas();
  } catch (error) {
    console.error(
      '\nNo se pudo preparar la base de pruebas:',
      (error as Error).message,
    );
    throw error;
  }
}
