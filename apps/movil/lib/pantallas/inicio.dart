import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../componentes/comunes.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';
import '../nucleo/sesion.dart';

/// Resumen del día: indicadores, retiros sin orden de carga, cargas por rendir y vencimientos.
class PantallaInicio extends ConsumerWidget {
  const PantallaInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider);
    final nombre = sesion is ConSesion ? sesion.usuario.nombre : '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('NexusTrack'),
        actions: [
          IconButton(
            tooltip: 'Mi cuenta',
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () => _cuenta(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(inicioProvider.future),
        child: VistaAsincrona(
          valor: ref.watch(inicioProvider),
          alReintentar: () => ref.invalidate(inicioProvider),
          datos: (inicio) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Text(
                  '${saludo(DateTime.now())}, ${nombre.split(' ').first}',
                  style: Theme.of(
                    context,
                  ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              _Indicadores(inicio.contadores),
              _Seccion(
                titulo: 'Retiros sin orden de carga',
                vacio: 'Todas las órdenes de retiro abiertas tienen orden de carga.',
                hijos: [
                  for (final r in inicio.retirosSinCarga)
                    ListTile(
                      title: Text('N° ${correlativo(r.numero)} · ${r.cliente}'),
                      subtitle: Text('${r.origen} → ${r.destino}\n${r.conductor} · ${r.camion}'),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/retiros/${r.id}'),
                    ),
                ],
              ),
              _Seccion(
                titulo: 'Cargas por rendir',
                vacio: 'No hay órdenes de carga pendientes de rendición.',
                hijos: [
                  for (final c in inicio.cargasPorRendir)
                    ListTile(
                      title: Text('N° ${correlativo(c.numero)} · ${c.cliente}'),
                      subtitle: Text(
                        '${fecha(c.fechaCarga)} · ${c.conductor} · ${c.patenteCamion}',
                      ),
                      trailing: Text(pesos(c.totalNeto)),
                      onTap: () => context.push('/cargas/${c.id}'),
                    ),
                ],
              ),
              _Seccion(
                titulo: 'Vencimientos próximos',
                vacio: 'Nada vence en los próximos días.',
                hijos: [for (final v in inicio.vencimientos) _Vencimiento(v)],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _cuenta(BuildContext context, WidgetRef ref) {
    final sesion = ref.read(sesionProvider);
    if (sesion is! ConSesion) return;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: CircleAvatar(child: Text(sesion.usuario.nombre.characters.first)),
              title: Text(sesion.usuario.nombre),
              subtitle: Text(
                '${sesion.usuario.email}\n${etiquetasRol[sesion.usuario.rol] ?? sesion.usuario.rol}',
              ),
              isThreeLine: true,
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Cerrar sesión'),
              onTap: () {
                Navigator.of(context).pop();
                ref.read(sesionProvider.notifier).salir();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _Indicadores extends StatelessWidget {
  const _Indicadores(this.c);
  final Map<String, double> c;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Retiros abiertos', numero(c['retirosAbiertos']), Icons.assignment_outlined),
      ('Sin orden de carga', numero(c['retirosSinCarga']), Icons.pending_actions_outlined),
      ('Cargas por rendir', numero(c['cargasPorRendir']), Icons.inventory_2_outlined),
      (
        'Vales de dinero del mes',
        pesos(c['montoValesDineroMes']),
        Icons.account_balance_wallet_outlined,
      ),
      (
        'Combustible del mes',
        '${numero(c['combustibleMesLitros'], decimales: 0)} L',
        Icons.local_gas_station_outlined,
      ),
      ('Tarifas vencidas', numero(c['tarifasVencidas']), Icons.event_busy_outlined),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 1.9,
        children: [
          for (final (etiqueta, valor, icono) in items)
            Card(
              margin: const EdgeInsets.all(4),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(icono, size: 18, color: Theme.of(context).colorScheme.primary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            etiqueta,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                        ),
                      ],
                    ),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        valor,
                        style: Theme.of(
                          context,
                        ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.vacio, required this.hijos});
  final String titulo;
  final String vacio;
  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(
            hijos.isEmpty ? titulo : '$titulo (${hijos.length})',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        if (hijos.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Text(vacio, style: Theme.of(context).textTheme.bodySmall),
          )
        else
          ...hijos,
      ],
    ),
  );
}

class _Vencimiento extends StatelessWidget {
  const _Vencimiento(this.v);
  final Vencimiento v;

  @override
  Widget build(BuildContext context) {
    final vencido = v.dias < 0;
    final color = vencido ? const Color(0xFFB91C1C) : const Color(0xFFB45309);
    return ListTile(
      leading: Icon(vencido ? Icons.error_outline : Icons.schedule, color: color),
      title: Text('${v.tipo} · ${v.referencia}'),
      subtitle: Text(v.detalle),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(fecha(v.fecha)),
          Text(
            vencido ? 'Vencido' : (v.dias == 0 ? 'Hoy' : 'En ${v.dias} días'),
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
