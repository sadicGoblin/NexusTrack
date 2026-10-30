import 'package:flutter/material.dart';

import '../nucleo/formato.dart';

/// Estado de un documento con el mismo código de colores que la web.
class EstadoChip extends StatelessWidget {
  const EstadoChip(this.estado, {super.key});
  final String estado;

  @override
  Widget build(BuildContext context) {
    final oscuro = Theme.of(context).brightness == Brightness.dark;
    final (Color fondo, Color texto) = switch (estado) {
      'ABIERTA' => (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)),
      'CON_CARGA' => (const Color(0xFFFEF3C7), const Color(0xFFB45309)),
      'ANULADA' || 'ANULADO' => (const Color(0xFFFEE2E2), const Color(0xFFB91C1C)),
      _ => (const Color(0xFFDCFCE7), const Color(0xFF15803D)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: oscuro ? texto.withValues(alpha: 0.22) : fondo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        etiquetasEstado[estado] ?? estado,
        style: TextStyle(color: oscuro ? fondo : texto, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
