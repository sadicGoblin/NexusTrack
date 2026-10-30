import 'package:flutter/material.dart';

/// Logo de NexusTrack: la «N» blanca sobre azul con el punto celeste.
class Logo extends StatelessWidget {
  const Logo({super.key, this.tamano = 56});
  final double tamano;

  @override
  Widget build(BuildContext context) => Container(
    width: tamano,
    height: tamano,
    decoration: BoxDecoration(
      color: const Color(0xFF0B3D66),
      borderRadius: BorderRadius.circular(tamano * 0.22),
    ),
    child: Stack(
      children: [
        Center(
          child: Text(
            'N',
            style: TextStyle(
              color: Colors.white,
              fontSize: tamano * 0.52,
              fontWeight: FontWeight.w800,
              height: 1,
            ),
          ),
        ),
        Positioned(
          right: tamano * 0.19,
          bottom: tamano * 0.22,
          child: Container(
            width: tamano * 0.13,
            height: tamano * 0.13,
            decoration: const BoxDecoration(color: Color(0xFF38BDF8), shape: BoxShape.circle),
          ),
        ),
      ],
    ),
  );
}
