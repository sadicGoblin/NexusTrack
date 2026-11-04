import 'package:flutter/material.dart';

/// Colores de la marca, los mismos del logo y de la web.
abstract final class Marca {
  static const marino = Color(0xFF0B3D66);
  static const azul = Color(0xFF175B96);
  static const celeste = Color(0xFF38BDF8);

  /// Degradado de las cabeceras (inicio, ingreso y detalle de documentos).
  static const degradado = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF082C4A), marino, Color(0xFF1A6AAE)],
    stops: [0, 0.55, 1],
  );
}

/// Colores que Material no trae (estados, bordes, sombras), en claro y oscuro.
@immutable
class ColoresNt extends ThemeExtension<ColoresNt> {
  const ColoresNt({
    required this.exito,
    required this.alerta,
    required this.peligro,
    required this.info,
    required this.tarjeta,
    required this.borde,
    required this.tenue,
    required this.relleno,
    required this.sombra,
  });

  final Color exito, alerta, peligro, info;
  final Color tarjeta, borde, tenue;

  /// Fondo de controles y bloques secundarios dentro de una tarjeta.
  final Color relleno;
  final List<BoxShadow> sombra;

  static const claro = ColoresNt(
    exito: Color(0xFF15803D),
    alerta: Color(0xFFB45309),
    peligro: Color(0xFFB91C1C),
    info: Color(0xFF1D4ED8),
    tarjeta: Colors.white,
    borde: Color(0xFFE5E9F0),
    tenue: Color(0xFF64748B),
    relleno: Color(0xFFF1F4F8),
    sombra: [
      BoxShadow(color: Color(0x0D0F172A), blurRadius: 14, offset: Offset(0, 4)),
      BoxShadow(color: Color(0x080F172A), blurRadius: 2, offset: Offset(0, 1)),
    ],
  );

  static const oscuro = ColoresNt(
    exito: Color(0xFF4ADE80),
    alerta: Color(0xFFFBBF24),
    peligro: Color(0xFFF87171),
    info: Color(0xFF60A5FA),
    tarjeta: Color(0xFF111A2E),
    borde: Color(0xFF1F2A40),
    tenue: Color(0xFF94A3B8),
    relleno: Color(0xFF17223A),
    sombra: [],
  );

  @override
  ColoresNt copyWith() => this;

  @override
  ColoresNt lerp(ColoresNt? otro, double t) => t < 0.5 || otro == null ? this : otro;
}

extension TemaContexto on BuildContext {
  ThemeData get tema => Theme.of(this);
  ColoresNt get nt {
    final t = Theme.of(this);
    return t.extension<ColoresNt>() ??
        (t.brightness == Brightness.light ? ColoresNt.claro : ColoresNt.oscuro);
  }
}

ThemeData tema(Brightness brillo) {
  final claro = brillo == Brightness.light;
  final nt = claro ? ColoresNt.claro : ColoresNt.oscuro;
  final fondo = claro ? const Color(0xFFF4F6F9) : const Color(0xFF0B1120);
  final texto = claro ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0);
  final primario = claro ? Marca.azul : const Color(0xFF7DB9EC);
  final esquema =
      ColorScheme.fromSeed(
        seedColor: Marca.azul,
        brightness: brillo,
        dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
      ).copyWith(
        primary: primario,
        onPrimary: claro ? Colors.white : const Color(0xFF07243D),
        primaryContainer: claro ? const Color(0xFFE1EDF8) : const Color(0xFF123A5E),
        onPrimaryContainer: claro ? Marca.marino : Colors.white,
        surface: nt.tarjeta,
        onSurface: texto,
        onSurfaceVariant: nt.tenue,
        outline: claro ? const Color(0xFFCBD5E1) : const Color(0xFF334155),
        outlineVariant: nt.borde,
        error: nt.peligro,
      );

  final base = ThemeData(
    useMaterial3: true,
    brightness: brillo,
    colorScheme: esquema,
    fontFamily: 'Inter',
  ).textTheme;
  final letras = base
      .copyWith(
        headlineMedium: base.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
        ),
        headlineSmall: base.headlineSmall?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.6,
        ),
        titleLarge: base.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4),
        titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
        titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        bodyLarge: base.bodyLarge?.copyWith(letterSpacing: -0.1),
        bodyMedium: base.bodyMedium?.copyWith(letterSpacing: -0.1, height: 1.35),
        bodySmall: base.bodySmall?.copyWith(color: nt.tenue, height: 1.35, letterSpacing: 0),
        labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0),
        labelMedium: base.labelMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.1),
        labelSmall: base.labelSmall?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.4),
      )
      .apply(bodyColor: texto, displayColor: texto);

  final redondeo = BorderRadius.circular(12);
  return ThemeData(
    useMaterial3: true,
    brightness: brillo,
    colorScheme: esquema,
    fontFamily: 'Inter',
    textTheme: letras,
    scaffoldBackgroundColor: fondo,
    extensions: [nt],
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: DividerThemeData(color: nt.borde, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: fondo,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleSpacing: 20,
      titleTextStyle: letras.titleLarge?.copyWith(fontSize: 22, fontWeight: FontWeight.w800),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: nt.tarjeta,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: nt.borde),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: nt.tarjeta,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: letras.bodyMedium?.copyWith(color: nt.tenue),
      prefixIconColor: nt.tenue,
      border: OutlineInputBorder(
        borderRadius: redondeo,
        borderSide: BorderSide(color: nt.borde),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: redondeo,
        borderSide: BorderSide(color: nt.borde),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: redondeo,
        borderSide: BorderSide(color: primario, width: 1.6),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 48),
        shape: RoundedRectangleBorder(borderRadius: redondeo),
        textStyle: letras.labelLarge?.copyWith(fontSize: 15),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: redondeo)),
        side: WidgetStatePropertyAll(BorderSide(color: nt.borde)),
        textStyle: WidgetStatePropertyAll(letras.labelLarge),
        backgroundColor: WidgetStateProperty.resolveWith(
          (e) => e.contains(WidgetState.selected) ? esquema.primaryContainer : nt.tarjeta,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (e) => e.contains(WidgetState.selected) ? esquema.onPrimaryContainer : nt.tenue,
        ),
      ),
    ),
    tabBarTheme: TabBarThemeData(
      dividerColor: Colors.transparent,
      indicatorSize: TabBarIndicatorSize.tab,
      indicator: BoxDecoration(
        color: nt.tarjeta,
        borderRadius: BorderRadius.circular(10),
        boxShadow: claro
            ? const [BoxShadow(color: Color(0x140F172A), blurRadius: 6, offset: Offset(0, 2))]
            : null,
        border: claro ? null : Border.all(color: nt.borde),
      ),
      labelColor: claro ? Marca.marino : Colors.white,
      unselectedLabelColor: nt.tenue,
      labelStyle: letras.labelLarge,
      unselectedLabelStyle: letras.labelLarge,
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      splashFactory: NoSplash.splashFactory,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 68,
      elevation: 0,
      backgroundColor: nt.tarjeta,
      surfaceTintColor: Colors.transparent,
      indicatorColor: esquema.primaryContainer,
      indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (e) => letras.labelSmall?.copyWith(
          fontSize: 11.5,
          letterSpacing: 0,
          color: e.contains(WidgetState.selected) ? esquema.onPrimaryContainer : nt.tenue,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (e) => IconThemeData(
          size: 24,
          color: e.contains(WidgetState.selected) ? esquema.onPrimaryContainer : nt.tenue,
        ),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: nt.tarjeta,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    listTileTheme: ListTileThemeData(iconColor: nt.tenue),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: primario),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: redondeo),
    ),
  );
}
