import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../componentes/comunes.dart';
import '../componentes/listado.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';
import '../tema.dart';

/// Qué conductor y qué remolque van con cada camión.
class PantallaFlota extends ConsumerStatefulWidget {
  const PantallaFlota({super.key});

  @override
  ConsumerState<PantallaFlota> createState() => _PantallaFlotaState();
}

enum _Filtro { todos, conConductor, sinConductor }

class _PantallaFlotaState extends ConsumerState<PantallaFlota> {
  String _busqueda = '';
  _Filtro _filtro = _Filtro.todos;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Flota')),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            children: [
              TextField(
                onChanged: (t) => setState(() => _busqueda = normalizarBusqueda(t.trim())),
                decoration: const InputDecoration(
                  hintText: 'Buscar camión, conductor o remolque…',
                  prefixIcon: Icon(Icons.search_rounded),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<_Filtro>(
                  segments: const [
                    ButtonSegment(value: _Filtro.todos, label: Text('Todos')),
                    ButtonSegment(value: _Filtro.conConductor, label: Text('Asignados')),
                    ButtonSegment(value: _Filtro.sinConductor, label: Text('Sin conductor')),
                  ],
                  selected: {_filtro},
                  showSelectedIcon: false,
                  onSelectionChanged: (s) => setState(() => _filtro = s.first),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(flotaProvider.future),
            child: VistaAsincrona(
              valor: ref.watch(flotaProvider),
              alReintentar: () => ref.invalidate(flotaProvider),
              datos: (todos) {
                final lista = todos.where((c) {
                  final pasaFiltro = switch (_filtro) {
                    _Filtro.todos => true,
                    _Filtro.conConductor => c.conductor != null,
                    _Filtro.sinConductor => c.conductor == null,
                  };
                  final texto = normalizarBusqueda(
                    '${c.camion} ${c.conductor ?? ''} ${c.remolques.join(' ')} ${c.empresa}',
                  );
                  return pasaFiltro && (_busqueda.isEmpty || texto.contains(_busqueda));
                }).toList()..sort((a, b) => a.camion.compareTo(b.camion));
                final conConductor = todos.where((c) => c.conductor != null).length;
                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: lista.isEmpty ? 2 : lista.length + 1,
                  itemBuilder: (context, i) {
                    if (i == 0) {
                      final estilo = context.tema.textTheme.labelMedium?.copyWith(
                        color: context.nt.tenue,
                      );
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                        child: Row(
                          children: [
                            Text('${todos.length} camiones', style: estilo),
                            const Spacer(),
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: context.nt.exito,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text('$conConductor con conductor', style: estilo),
                          ],
                        ),
                      );
                    }
                    if (lista.isEmpty) {
                      return const Aviso(
                        icono: Icons.search_off_rounded,
                        mensaje: 'Ningún camión coincide.',
                      );
                    }
                    return _TarjetaCamion(lista[i - 1]);
                  },
                );
              },
            ),
          ),
        ),
      ],
    ),
  );
}

class _TarjetaCamion extends StatelessWidget {
  const _TarjetaCamion(this.c);
  final CamionFlota c;

  @override
  Widget build(BuildContext context) {
    final tema = context.tema;
    final remolques = [
      if (c.chasis != null) ('Chasis', c.chasis!),
      if (c.thermo != null) ('Thermo', c.thermo!),
      if (c.plataforma != null) ('Plataforma', c.plataforma!),
    ];
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Patente(c.camion, grande: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.tipo,
                      style: tema.textTheme.labelMedium?.copyWith(color: context.nt.tenue),
                    ),
                    Text(
                      c.empresa,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.nt.relleno,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Insignia(
                      c.conductor == null ? Icons.person_off_outlined : Icons.person_rounded,
                      color: c.conductor == null ? context.nt.tenue : null,
                      tamano: 34,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.conductor ?? 'Sin conductor asignado',
                            style: tema.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: c.conductor == null ? context.nt.tenue : null,
                            ),
                          ),
                          if (c.desde != null)
                            Text(
                              'Asignado desde ${fecha(c.desde)}',
                              style: tema.textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (remolques.isEmpty)
                  Text('Sin remolque', style: tema.textTheme.bodySmall)
                else
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      for (final (tipo, patente) in remolques)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(tipo, style: tema.textTheme.bodySmall),
                            const SizedBox(width: 6),
                            Patente(patente),
                          ],
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
