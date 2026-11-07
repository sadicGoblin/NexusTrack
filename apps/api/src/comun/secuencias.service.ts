import { Injectable } from '@nestjs/common';
import type { TipoSecuencia } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

/**
 * Correlativos sin saltos ni duplicados: el UPDATE ... SET ultimo = ultimo + 1 bloquea la fila
 * hasta que termina la transacción que crea el documento. Si la transacción falla, el número
 * se libera junto con el resto de los cambios.
 */
@Injectable()
export class SecuenciasService {
  async siguiente(tx: Tx, tipo: TipoSecuencia): Promise<number> {
    const sec = await tx.secuencia.update({
      where: { tipo },
      data: { ultimo: { increment: 1 } },
    });
    return sec.ultimo;
  }

  /**
   * Código con prefijo para mantenedores (PK-001, RT-001). Salta los que ya existen, por
   * ejemplo uno escrito a mano cuando el código no era automático.
   */
  async siguienteCodigo(
    tx: Tx,
    tipo: 'PACKING' | 'RUTA_TARIFA',
    prefijo: string,
  ): Promise<string> {
    const usado = (codigo: string) =>
      tipo === 'PACKING'
        ? tx.packing.findUnique({ where: { codigo }, select: { id: true } })
        : tx.rutaTarifa.findUnique({ where: { codigo }, select: { id: true } });
    for (;;) {
      const codigo = `${prefijo}-${String(await this.siguiente(tx, tipo)).padStart(3, '0')}`;
      if (!(await usado(codigo))) return codigo;
    }
  }
}
