import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../datos/repositorio.dart';
import '../nucleo/formato.dart';
import '../tema.dart';
import 'comunes.dart';

/// Minúsculas y sin tildes, para buscar «valparaiso» y encontrar «VALPARAÍSO».
String normalizarBusqueda(String s) {
  const conTilde = 'áéíóúüñ';
  const sinTilde = 'aeiouun';
  final buffer = StringBuffer();
  for (final c in s.toLowerCase().split('')) {
    final i = conTilde.indexOf(c);
    buffer.write(i >= 0 ? sinTilde[i] : c);
  }
  return buffer.toString();
}

/// Listado de documentos con selector de período, búsqueda y «deslizar para actualizar».
class Listado<T> extends ConsumerStatefulWidget {
  const Listado({
    super.key,
    required this.proveedor,
    required this.tarjeta,
    required this.buscable,
    required this.unidad,
    required this.singular,
    this.etiquetaVigentes,
    this.total,
  });

  final FutureProvider<List<T>> Function(Consulta) proveedor;
  final Widget Function(T elemento) tarjeta;

  /// Texto en que se busca (número, cliente, conductor, patentes…).
  final String Function(T elemento) buscable;

  /// Nombre de los documentos en plural y en singular, para el conteo.
  final String unidad;
  final String singular;

  /// Si se indica, ofrece ver lo vigente (o pendiente) además del mes; parte en lo vigente.
  final String? etiquetaVigentes;

  /// Suma que se muestra junto al conteo (por ejemplo, el monto de los vales).
  final String Function(List<T> elementos)? total;

  @override
  ConsumerState<Listado<T>> createState() => _ListadoState<T>();
}

class _ListadoState<T> extends ConsumerState<Listado<T>> with AutomaticKeepAliveClientMixin {
  late Consulta _consulta = consultaInicial(vigentes: widget.etiquetaVigentes != null);
  String _busqueda = '';

  @override
  bool get wantKeepAlive => true;

  void _moverMes(int delta) {
    final fecha = DateTime(_consulta.anio, _consulta.mes + delta);
    setState(() => _consulta = (vigentes: false, anio: fecha.year, mes: fecha.month));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final proveedor = widget.proveedor(_consulta);
    final hoy = DateTime.now();
    final esMesActual = _consulta.anio == hoy.year && _consulta.mes == hoy.month;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            children: [
              if (widget.etiquetaVigentes != null) ...[
                SizedBox(
                  width: double.infinity,
                  child: SegmentedButton<bool>(
                    segments: [
                      ButtonSegment(value: true, label: Text(widget.etiquetaVigentes!)),
                      const ButtonSegment(value: false, label: Text('Por mes')),
                    ],
                    selected: {_consulta.vigentes},
                    showSelectedIcon: false,
                    onSelectionChanged: (s) => setState(
                      () =>
                          _consulta = (vigentes: s.first, anio: _consulta.anio, mes: _consulta.mes),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              if (!_consulta.vigentes) ...[
                _SelectorMes(
                  mes: nombreMes(_consulta.anio, _consulta.mes),
                  alRetroceder: () => _moverMes(-1),
                  alAvanzar: esMesActual ? null : () => _moverMes(1),
                ),
                const SizedBox(height: 10),
              ],
              TextField(
                onChanged: (t) => setState(() => _busqueda = normalizarBusqueda(t.trim())),
                decoration: const InputDecoration(
                  hintText: 'Buscar número, cliente, patente…',
                  prefixIcon: Icon(Icons.search_rounded),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(proveedor.future),
            child: VistaAsincrona(
              valor: ref.watch(proveedor),
              alReintentar: () => ref.invalidate(proveedor),
              datos: (todos) {
                final lista = _busqueda.isEmpty
                    ? todos
                    : todos
                          .where((e) => normalizarBusqueda(widget.buscable(e)).contains(_busqueda))
                          .toList();
                if (lista.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Aviso(
                        icono: todos.isEmpty ? Icons.inbox_outlined : Icons.search_off_rounded,
                        mensaje: todos.isEmpty
                            ? (_consulta.vigentes
                                  ? 'No hay ${widget.unidad} pendientes.'
                                  : 'No hay ${widget.unidad} en ${nombreMes(_consulta.anio, _consulta.mes).toLowerCase()}.')
                            : 'Ningún resultado para la búsqueda.',
                      ),
                    ],
                  );
                }
                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: lista.length + 1,
                  itemBuilder: (context, i) {
                    if (i == 0) {
                      final total = widget.total?.call(lista);
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                        child: Row(
                          children: [
                            Text(
                              '${lista.length} ${lista.length == 1 ? widget.singular : widget.unidad}',
                              style: context.tema.textTheme.labelMedium?.copyWith(
                                color: context.nt.tenue,
                              ),
                            ),
                            const Spacer(),
                            if (total != null)
                              Text(
                                total,
                                style: context.tema.textTheme.labelLarge?.copyWith(
                                  fontFeatures: cifras,
                                ),
                              ),
                          ],
                        ),
                      );
                    }
                    return widget.tarjeta(lista[i - 1]);
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// Mes consultado, con flechas para moverse.
class _SelectorMes extends StatelessWidget {
  const _SelectorMes({required this.mes, required this.alRetroceder, this.alAvanzar});
  final String mes;
  final VoidCallback alRetroceder;
  final VoidCallback? alAvanzar;

  @override
  Widget build(BuildContext context) => Container(
    height: 44,
    decoration: BoxDecoration(
      color: context.nt.tarjeta,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: context.nt.borde),
    ),
    child: Row(
      children: [
        IconButton(
          onPressed: alRetroceder,
          icon: const Icon(Icons.chevron_left_rounded),
          tooltip: 'Mes anterior',
          visualDensity: VisualDensity.compact,
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.calendar_month_outlined, size: 17, color: context.nt.tenue),
              const SizedBox(width: 8),
              Text(mes, style: context.tema.textTheme.titleSmall),
            ],
          ),
        ),
        IconButton(
          onPressed: alAvanzar,
          icon: const Icon(Icons.chevron_right_rounded),
          tooltip: 'Mes siguiente',
          visualDensity: VisualDensity.compact,
        ),
      ],
    ),
  );
}
