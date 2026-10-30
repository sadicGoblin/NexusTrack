import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';

const _azul = Color(0xFF175B96);

ThemeData tema(Brightness brillo) {
  final claro = brillo == Brightness.light;
  final esquema = ColorScheme.fromSeed(
    seedColor: _azul,
    brightness: brillo,
    dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
  );
  final fondo = claro ? const Color(0xFFF4F6F9) : const Color(0xFF0B1120);
  return ThemeData(
    colorScheme: esquema,
    scaffoldBackgroundColor: fondo,
    appBarTheme: AppBarTheme(
      backgroundColor: fondo,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: esquema.onSurface,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: claro ? Colors.white : const Color(0xFF111A2E),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: esquema.outlineVariant.withValues(alpha: 0.6)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: claro ? Colors.white : const Color(0xFF111A2E),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: esquema.outlineVariant),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: claro ? Colors.white : const Color(0xFF0F172A),
      // Indicador claro con ícono azul: el contenedor primario del esquema es demasiado oscuro.
      indicatorColor: claro ? const Color(0xFFD6E9F7) : const Color(0xFF123E66),
      iconTheme: WidgetStateProperty.resolveWith(
        (estados) => IconThemeData(
          color: estados.contains(WidgetState.selected)
              ? (claro ? const Color(0xFF13497A) : Colors.white)
              : esquema.onSurfaceVariant,
        ),
      ),
    ),
    tabBarTheme: const TabBarThemeData(dividerColor: Colors.transparent),
  );
}

class NexusTrackApp extends ConsumerWidget {
  const NexusTrackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'NexusTrack',
    debugShowCheckedModeBanner: false,
    theme: tema(Brightness.light),
    darkTheme: tema(Brightness.dark),
    locale: const Locale('es', 'CL'),
    supportedLocales: const [Locale('es', 'CL'), Locale('es')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    routerConfig: ref.watch(routerProvider),
  );
}
