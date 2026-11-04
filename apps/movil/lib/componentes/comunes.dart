import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../nucleo/formato.dart' as f;
import '../tema.dart';
import 'estado.dart';

const cifras = [FontFeature.tabularFigures()];

/// Superficie base: fondo de tarjeta, borde fino, sombra suave y toque opcional.
class Tarjeta extends StatelessWidget {
  const Tarjeta({
    super.key,
    required this.child,
    this.alTocar,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    this.color,
  });

  final Widget child;
  final VoidCallback? alTocar;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final redondeo = BorderRadius.circular(16);
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color ?? context.nt.tarjeta,
          borderRadius: redondeo,
          border: Border.all(color: context.nt.borde),
          boxShadow: context.nt.sombra,
        ),
        child: Material(
          type: MaterialType.transparency,
          borderRadius: redondeo,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: alTocar,
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}

/// Ícono sobre un cuadrado redondeado del mismo color, más claro.
class Insignia extends StatelessWidget {
  const Insignia(this.icono, {super.key, this.color, this.tamano = 40});
  final IconData icono;
  final Color? color;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.tema.colorScheme.primary;
    return Container(
      width: tamano,
      height: tamano,
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(tamano * 0.3),
      ),
      child: Icon(icono, size: tamano * 0.52, color: c),
    );
  }
}

/// Patente con aspecto de placa: borde oscuro, letras gruesas y espaciadas.
class Patente extends StatelessWidget {
  const Patente(this.patente, {super.key, this.grande = false});
  final String patente;
  final bool grande;

  @override
  Widget build(BuildContext context) {
    final claro = context.tema.brightness == Brightness.light;
    final tinta = claro ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: grande ? 10 : 7, vertical: grande ? 4 : 2),
      decoration: BoxDecoration(
        color: claro ? Colors.white : context.nt.relleno,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: tinta.withValues(alpha: 0.75), width: 1.4),
      ),
      child: Text(
        patente,
        style: TextStyle(
          color: tinta,
          fontSize: grande ? 17 : 12.5,
          fontWeight: FontWeight.w800,
          letterSpacing: grande ? 1.6 : 1.1,
          height: 1.2,
          fontFeatures: cifras,
        ),
      ),
    );
  }
}

/// Pestañas con forma de píldora bajo el título (Fletes, Vales).
class Pestanas extends StatelessWidget implements PreferredSizeWidget {
  const Pestanas(this.nombres, {super.key});
  final List<String> nombres;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) => Container(
    height: 44,
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: context.tema.brightness == Brightness.light
          ? const Color(0xFFE8EDF3)
          : context.nt.relleno,
      borderRadius: BorderRadius.circular(12),
    ),
    child: TabBar(tabs: [for (final n in nombres) Tab(text: n, height: 36)]),
  );
}

/// Muestra la carga, el error con reintento o los datos de una consulta.
class VistaAsincrona<T> extends StatelessWidget {
  const VistaAsincrona({
    super.key,
    required this.valor,
    required this.datos,
    required this.alReintentar,
  });

  final AsyncValue<T> valor;
  final Widget Function(T datos) datos;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) => switch (valor) {
    AsyncData(:final value) => datos(value),
    AsyncError(:final error) => Aviso(
      icono: Icons.cloud_off_outlined,
      titulo: 'No se pudo cargar',
      mensaje: error.toString(),
      accion: FilledButton.tonalIcon(
        onPressed: alReintentar,
        icon: const Icon(Icons.refresh),
        label: const Text('Reintentar'),
      ),
    ),
    _ => const Esqueletos(),
  };
}

/// Tarjetas grises que laten mientras llegan los datos.
class Esqueletos extends StatefulWidget {
  const Esqueletos({super.key, this.cantidad = 5});
  final int cantidad;

  @override
  State<Esqueletos> createState() => _EsqueletosState();
}

class _EsqueletosState extends State<Esqueletos> with SingleTickerProviderStateMixin {
  late final _latido = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 850),
    lowerBound: 0.45,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _latido.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gris = context.nt.relleno;
    Widget barra(double ancho, double alto) => Container(
      width: ancho,
      height: alto,
      decoration: BoxDecoration(color: gris, borderRadius: BorderRadius.circular(6)),
    );
    return Semantics(
      label: 'Cargando',
      child: FadeTransition(
        opacity: _latido,
        child: ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 10),
          itemCount: widget.cantidad,
          itemBuilder: (_, _) => Tarjeta(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: gris, borderRadius: BorderRadius.circular(12)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      barra(90, 11),
                      const SizedBox(height: 9),
                      barra(180, 14),
                      const SizedBox(height: 14),
                      barra(double.infinity, 10),
                      const SizedBox(height: 8),
                      barra(140, 10),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Mensaje centrado con ícono (lista vacía, error).
class Aviso extends StatelessWidget {
  const Aviso({super.key, required this.icono, required this.mensaje, this.titulo, this.accion});
  final IconData icono;
  final String mensaje;
  final String? titulo;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final tema = context.tema;
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 40, 32, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(color: context.nt.relleno, shape: BoxShape.circle),
              child: Icon(icono, size: 34, color: context.nt.tenue),
            ),
            const SizedBox(height: 16),
            if (titulo != null) ...[
              Text(titulo!, style: tema.textTheme.titleMedium, textAlign: TextAlign.center),
              const SizedBox(height: 6),
            ],
            Text(
              mensaje,
              textAlign: TextAlign.center,
              style: tema.textTheme.bodyMedium?.copyWith(color: context.nt.tenue),
            ),
            if (accion != null) ...[const SizedBox(height: 20), accion!],
          ],
        ),
      ),
    );
  }
}

/// Título de un bloque de la pantalla, con su conteo.
class EncabezadoSeccion extends StatelessWidget {
  const EncabezadoSeccion(this.titulo, {super.key, this.conteo});
  final String titulo;
  final int? conteo;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 22, 20, 8),
    child: Row(
      children: [
        Flexible(child: Text(titulo, style: context.tema.textTheme.titleMedium)),
        if (conteo != null && conteo! > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: context.tema.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$conteo',
              style: context.tema.textTheme.labelMedium?.copyWith(
                color: context.tema.colorScheme.onPrimaryContainer,
                fontFeatures: cifras,
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

/// Origen → destino en una línea, con puntos de inicio y fin.
class Ruta extends StatelessWidget {
  const Ruta(this.origen, this.destino, {super.key});
  final String origen;
  final String destino;

  @override
  Widget build(BuildContext context) {
    final primario = context.tema.colorScheme.primary;
    final estilo = context.tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600);
    return Row(
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: primario, width: 2),
          ),
        ),
        const SizedBox(width: 7),
        Flexible(
          child: Text(origen, maxLines: 1, overflow: TextOverflow.ellipsis, style: estilo),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Icon(Icons.arrow_forward_rounded, size: 16, color: context.nt.tenue),
        ),
        Icon(Icons.location_on_rounded, size: 15, color: primario),
        const SizedBox(width: 4),
        Flexible(
          child: Text(destino, maxLines: 1, overflow: TextOverflow.ellipsis, style: estilo),
        ),
      ],
    );
  }
}

/// Ícono pequeño y texto tenue (fecha, conductor, patentes…).
class DatoBreve extends StatelessWidget {
  const DatoBreve(this.icono, this.texto, {super.key});
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icono, size: 15, color: context.nt.tenue),
      const SizedBox(width: 5),
      Flexible(
        child: Text(
          texto,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.tema.textTheme.bodySmall,
        ),
      ),
    ],
  );
}

/// Tarjeta de un documento en un listado.
class TarjetaDocumento extends StatelessWidget {
  const TarjetaDocumento({
    super.key,
    required this.icono,
    required this.numero,
    required this.titulo,
    this.estado,
    this.fecha,
    this.ruta,
    this.detalles = const [],
    this.monto,
    this.etiquetaMonto = 'Total',
    this.alTocar,
  });

  final IconData icono;
  final String numero;

  /// Sin estado no se muestra el chip (por ejemplo, en las cargas por rendir del inicio).
  final String? estado;

  /// Cliente o conductor: lo primero que se lee.
  final String titulo;
  final String? fecha;
  final (String, String)? ruta;
  final List<(IconData, String)> detalles;
  final String? monto;
  final String etiquetaMonto;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tema = context.tema;
    final anulado = estado == 'ANULADA' || estado == 'ANULADO';
    return Tarjeta(
      alTocar: alTocar,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Insignia(icono, color: anulado ? context.nt.tenue : null),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fecha == null ? numero : '$numero · $fecha',
                      style: tema.textTheme.labelMedium?.copyWith(
                        color: context.nt.tenue,
                        fontFeatures: cifras,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      titulo,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.titleSmall?.copyWith(
                        fontSize: 15,
                        decoration: anulado ? TextDecoration.lineThrough : null,
                        decorationColor: context.nt.tenue,
                      ),
                    ),
                  ],
                ),
              ),
              if (estado != null) ...[const SizedBox(width: 8), EstadoChip(estado!)],
            ],
          ),
          if (ruta != null) ...[const SizedBox(height: 14), Ruta(ruta!.$1, ruta!.$2)],
          if (detalles.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 16,
              runSpacing: 6,
              children: [for (final (icono, texto) in detalles) DatoBreve(icono, texto)],
            ),
          ],
          if (monto != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: context.nt.relleno,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Text(etiquetaMonto, style: tema.textTheme.bodySmall),
                  const Spacer(),
                  Text(
                    monto!,
                    style: tema.textTheme.titleSmall?.copyWith(
                      fontSize: 15,
                      fontFeatures: cifras,
                      color: anulado ? context.nt.tenue : null,
                      decoration: anulado ? TextDecoration.lineThrough : null,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Grupo de datos de un detalle, en una tarjeta con ícono y título; filas separadas por líneas.
class SeccionDatos extends StatelessWidget {
  const SeccionDatos({super.key, required this.titulo, required this.datos, this.icono});
  final String titulo;
  final List<Widget> datos;
  final IconData? icono;

  @override
  Widget build(BuildContext context) => Tarjeta(
    padding: EdgeInsets.zero,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
          child: Row(
            children: [
              if (icono != null) ...[
                Icon(icono, size: 18, color: context.tema.colorScheme.primary),
                const SizedBox(width: 8),
              ],
              Expanded(child: Text(titulo, style: context.tema.textTheme.titleSmall)),
            ],
          ),
        ),
        for (final (i, dato) in datos.indexed) ...[
          if (i > 0) const Divider(indent: 16, endIndent: 16),
          dato,
        ],
        const SizedBox(height: 4),
      ],
    ),
  );
}

/// Una fila etiqueta / valor; con [alTocar] lleva a otro documento.
class Dato extends StatelessWidget {
  const Dato(
    this.etiqueta,
    this.valor, {
    super.key,
    this.alTocar,
    this.destacado = false,
    this.icono,
  });
  final String etiqueta;
  final String? valor;
  final VoidCallback? alTocar;
  final bool destacado;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final tema = context.tema;
    final enlace = alTocar != null;
    final estilo = destacado
        ? tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontFeatures: cifras)
        : tema.textTheme.bodyMedium?.copyWith(
            fontWeight: enlace ? FontWeight.w700 : FontWeight.w600,
            color: enlace ? tema.colorScheme.primary : null,
            fontFeatures: cifras,
          );
    return InkWell(
      onTap: alTocar,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          destacado ? 12 : 10,
          enlace ? 10 : 16,
          destacado ? 12 : 10,
        ),
        child: Row(
          children: [
            if (icono != null) ...[
              Icon(icono, size: 18, color: context.nt.tenue),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: 4,
              child: Text(
                etiqueta,
                style: destacado
                    ? tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)
                    : tema.textTheme.bodySmall?.copyWith(fontSize: 13),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 6,
              child: Text(f.texto(valor), textAlign: TextAlign.right, style: estilo),
            ),
            if (enlace) ...[
              const SizedBox(width: 2),
              Icon(Icons.chevron_right_rounded, size: 20, color: tema.colorScheme.primary),
            ],
          ],
        ),
      ),
    );
  }
}

/// Aviso de documento anulado, con su motivo.
class AvisoAnulado extends StatelessWidget {
  const AvisoAnulado(this.motivo, {super.key});
  final String? motivo;

  @override
  Widget build(BuildContext context) {
    final rojo = context.nt.peligro;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: rojo.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: rojo.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.block_rounded, color: rojo, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Documento anulado',
                  style: context.tema.textTheme.titleSmall?.copyWith(color: rojo),
                ),
                const SizedBox(height: 2),
                Text(f.texto(motivo), style: context.tema.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
