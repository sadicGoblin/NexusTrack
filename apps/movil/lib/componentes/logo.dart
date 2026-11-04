import 'package:flutter/material.dart';

import '../tema.dart';

/// Logo de NexusTrack, el mismo trazo del favicon de la web: la «N» blanca sobre azul marino
/// con el punto celeste. Con [fondo] en falso dibuja solo la «N» y el punto (sobre el degradado).
class Logo extends StatelessWidget {
  const Logo({super.key, this.tamano = 56, this.fondo = true});
  final double tamano;
  final bool fondo;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(tamano), painter: _PintorLogo(fondo));
}

class _PintorLogo extends CustomPainter {
  const _PintorLogo(this.fondo);
  final bool fondo;

  @override
  void paint(Canvas canvas, Size size) {
    // El trazo está en una grilla de 64 × 64, como el SVG.
    canvas.scale(size.width / 64);
    if (fondo) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 64, 64), const Radius.circular(14)),
        Paint()..color = Marca.marino,
      );
    }
    final n = Path()
      ..moveTo(14, 44)
      ..lineTo(14, 20)
      ..lineTo(20, 20)
      ..lineTo(34, 35)
      ..lineTo(34, 20)
      ..lineTo(40, 20)
      ..lineTo(40, 44)
      ..lineTo(34, 44)
      ..lineTo(20, 29)
      ..lineTo(20, 44)
      ..close();
    canvas.drawPath(n, Paint()..color = Colors.white);
    canvas.drawCircle(const Offset(48, 42), 4, Paint()..color = Marca.celeste);
  }

  @override
  bool shouldRepaint(_PintorLogo antes) => antes.fondo != fondo;
}
