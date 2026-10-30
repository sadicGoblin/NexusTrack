import { prepararBaseDePruebas } from '../prisma/preparar-pruebas';

export default function globalSetup(): void {
  prepararBaseDePruebas();
}
