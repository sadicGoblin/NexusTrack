import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // En la web se activa la capa de accesibilidad: lectores de pantalla y pruebas automáticas.
  if (kIsWeb) SemanticsBinding.instance.ensureSemantics();
  // Sin reintentos automáticos: un error se muestra de inmediato con su botón «Reintentar».
  runApp(ProviderScope(retry: (_, _) => null, child: const NexusTrackApp()));
}
