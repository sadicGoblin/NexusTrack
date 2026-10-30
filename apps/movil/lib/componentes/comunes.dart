import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../nucleo/formato.dart' as f;
import 'estado.dart';

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
      mensaje: error.toString(),
      accion: FilledButton.tonalIcon(
        onPressed: alReintentar,
        icon: const Icon(Icons.refresh),
        label: const Text('Reintentar'),
      ),
    ),
    _ => const Center(child: CircularProgressIndicator()),
  };
}

/// Mensaje centrado con ícono (lista vacía, error).
class Aviso extends StatelessWidget {
  const Aviso({super.key, required this.icono, required this.mensaje, this.accion});
  final IconData icono;
  final String mensaje;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 44, color: tema.colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              mensaje,
              textAlign: TextAlign.center,
              style: tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            ),
            if (accion != null) ...[const SizedBox(height: 16), accion!],
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de un documento en un listado.
class TarjetaDocumento extends StatelessWidget {
  const TarjetaDocumento({
    super.key,
    required this.titulo,
    required this.estado,
    required this.lineas,
    this.monto,
    this.alTocar,
  });

  final String titulo;
  final String estado;
  final List<String> lineas;
  final String? monto;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    titulo,
                    style: tema.textTheme.titleMedium?.copyWith(
                      color: tema.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const Spacer(),
                  if (monto != null) ...[
                    Text(monto!, style: tema.textTheme.titleSmall),
                    const SizedBox(width: 8),
                  ],
                  EstadoChip(estado),
                ],
              ),
              const SizedBox(height: 6),
              for (final (i, linea) in lineas.indexed)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    linea,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: i == 0
                        ? tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)
                        : tema.textTheme.bodySmall?.copyWith(
                            color: tema.colorScheme.onSurfaceVariant,
                          ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Grupo de datos de un detalle, en una tarjeta con título.
class SeccionDatos extends StatelessWidget {
  const SeccionDatos({super.key, required this.titulo, required this.datos});
  final String titulo;
  final List<Widget> datos;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            ...datos,
          ],
        ),
      ),
    );
  }
}

/// Una fila etiqueta / valor; con [alTocar] el valor se muestra como enlace.
class Dato extends StatelessWidget {
  const Dato(this.etiqueta, this.valor, {super.key, this.alTocar, this.destacado = false});
  final String etiqueta;
  final String? valor;
  final VoidCallback? alTocar;
  final bool destacado;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final estilo = tema.textTheme.bodyMedium?.copyWith(
      fontWeight: destacado || alTocar != null ? FontWeight.w700 : FontWeight.w500,
      color: alTocar != null ? tema.colorScheme.primary : null,
      decoration: alTocar != null ? TextDecoration.underline : null,
      decorationColor: tema.colorScheme.primary,
    );
    return InkWell(
      onTap: alTocar,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 4,
              child: Text(
                etiqueta,
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 6,
              child: Text(f.texto(valor), textAlign: TextAlign.right, style: estilo),
            ),
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
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.fromLTRB(16, 8, 16, 6),
    color: Theme.of(context).colorScheme.errorContainer,
    child: ListTile(
      leading: Icon(Icons.block, color: Theme.of(context).colorScheme.onErrorContainer),
      title: Text(
        'Documento anulado',
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
      subtitle: Text(
        f.texto(motivo),
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    ),
  );
}
