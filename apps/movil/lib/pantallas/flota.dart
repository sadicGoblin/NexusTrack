import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../componentes/comunes.dart';
import '../componentes/listado.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';

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
                  prefixIcon: Icon(Icons.search),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<_Filtro>(
                  segments: const [
                    ButtonSegment(value: _Filtro.todos, label: Text('Todos')),
                    ButtonSegment(value: _Filtro.conConductor, label: Text('Con conductor')),
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
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 6),
                        child: Text(
                          '${todos.length} camiones · $conConductor con conductor',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      );
                    }
                    if (lista.isEmpty) {
                      return const Aviso(
                        icono: Icons.local_shipping_outlined,
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
    final tema = Theme.of(context);
    final tenue = tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.local_shipping_outlined, color: tema.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  c.camion,
                  style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(width: 8),
                Text(c.tipo, style: tenue),
                const Spacer(),
                if (c.desde != null) Text('Desde ${fecha(c.desde)}', style: tenue),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(left: 32, top: 2),
              child: Text(c.empresa, style: tenue),
            ),
            const SizedBox(height: 8),
            _Fila(
              icono: Icons.person_outline,
              texto: c.conductor ?? 'Sin conductor asignado',
              apagado: c.conductor == null,
            ),
            _Fila(
              icono: Icons.link,
              texto: c.remolques.isEmpty
                  ? 'Sin remolque'
                  : [
                      if (c.chasis != null) '${c.chasis} (chasis)',
                      if (c.thermo != null) '${c.thermo} (thermo)',
                      if (c.plataforma != null) '${c.plataforma} (plataforma)',
                    ].join(' · '),
              apagado: c.remolques.isEmpty,
            ),
          ],
        ),
      ),
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.icono, required this.texto, this.apagado = false});
  final IconData icono;
  final String texto;
  final bool apagado;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final color = apagado ? tema.colorScheme.outline : tema.colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icono, size: 18, color: color),
          const SizedBox(width: 14),
          Expanded(
            child: Text(texto, style: tema.textTheme.bodyMedium?.copyWith(color: color)),
          ),
        ],
      ),
    );
  }
}
