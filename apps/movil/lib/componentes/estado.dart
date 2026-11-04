import 'package:flutter/material.dart';

import '../nucleo/formato.dart';
import '../tema.dart';

/// Color de cada estado, con el mismo código que la web.
Color colorEstado(BuildContext context, String estado) => switch (estado) {
  'ABIERTA' => context.nt.info,
  'CON_CARGA' => context.nt.alerta,
  'ANULADA' || 'ANULADO' => context.nt.peligro,
  _ => context.nt.exito,
};

/// Estado de un documento: punto de color y nombre. [sobreOscuro] para las cabeceras azules.
class EstadoChip extends StatelessWidget {
  const EstadoChip(this.estado, {super.key, this.sobreOscuro = false});
  final String estado;
  final bool sobreOscuro;

  @override
  Widget build(BuildContext context) {
    final color = colorEstado(context, estado);
    final punto = sobreOscuro ? Color.lerp(color, Colors.white, 0.45)! : color;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
      decoration: BoxDecoration(
        color: sobreOscuro ? Colors.white.withValues(alpha: 0.14) : color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: sobreOscuro ? Colors.white.withValues(alpha: 0.18) : color.withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: punto, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            etiquetasEstado[estado] ?? estado,
            style: TextStyle(
              color: sobreOscuro ? Colors.white : color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
