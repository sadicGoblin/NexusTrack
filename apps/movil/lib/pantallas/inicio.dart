import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../componentes/comunes.dart';
import '../componentes/logo.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';
import '../nucleo/sesion.dart';
import '../tema.dart';

/// Resumen del día: indicadores, retiros sin orden de carga, cargas por rendir y vencimientos.
class PantallaInicio extends ConsumerWidget {
  const PantallaInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider);
    final nombre = sesion is ConSesion ? sesion.usuario.nombre : '';
    final valor = ref.watch(inicioProvider);
    final inicio = valor.value;
    return Scaffold(
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(inicioProvider.future),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _Cabecera(
                  nombre: nombre,
                  contadores: inicio?.contadores,
                  alTocarCuenta: () => _cuenta(context, ref),
                ),
              ),
              if (inicio != null)
                ..._contenido(context, inicio)
              else
                SliverToBoxAdapter(
                  child: VistaAsincrona(
                    valor: valor,
                    alReintentar: () => ref.invalidate(inicioProvider),
                    datos: (_) => const SizedBox.shrink(),
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 28)),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _contenido(BuildContext context, Inicio inicio) => [
    SliverToBoxAdapter(child: _Indicadores(inicio.contadores)),
    SliverToBoxAdapter(
      child: EncabezadoSeccion('Retiros sin orden de carga', conteo: inicio.retirosSinCarga.length),
    ),
    if (inicio.retirosSinCarga.isEmpty)
      const SliverToBoxAdapter(
        child: _AlDia('Todas las órdenes de retiro abiertas tienen orden de carga.'),
      ),
    SliverList.list(
      children: [
        for (final r in inicio.retirosSinCarga)
          TarjetaDocumento(
            icono: Icons.assignment_outlined,
            numero: 'N° ${correlativo(r.numero)}',
            fecha: fecha(r.fecha),
            estado: r.estado,
            titulo: r.cliente,
            ruta: (r.origen, r.destino),
            detalles: [
              (Icons.person_outline_rounded, r.conductor),
              (Icons.local_shipping_outlined, r.camion),
            ],
            alTocar: () => context.push('/retiros/${r.id}'),
          ),
      ],
    ),
    SliverToBoxAdapter(
      child: EncabezadoSeccion('Cargas por rendir', conteo: inicio.cargasPorRendir.length),
    ),
    if (inicio.cargasPorRendir.isEmpty)
      const SliverToBoxAdapter(child: _AlDia('No hay órdenes de carga pendientes de rendición.')),
    SliverList.list(
      children: [
        for (final c in inicio.cargasPorRendir)
          TarjetaDocumento(
            icono: Icons.inventory_2_outlined,
            numero: 'N° ${correlativo(c.numero)}',
            fecha: fecha(c.fechaCarga),
            titulo: c.cliente,
            detalles: [
              (Icons.person_outline_rounded, c.conductor),
              (Icons.local_shipping_outlined, c.patenteCamion),
            ],
            monto: pesos(c.totalNeto),
            etiquetaMonto: 'Total neto',
            alTocar: () => context.push('/cargas/${c.id}'),
          ),
      ],
    ),
    SliverToBoxAdapter(
      child: EncabezadoSeccion('Vencimientos próximos', conteo: inicio.vencimientos.length),
    ),
    SliverToBoxAdapter(
      child: inicio.vencimientos.isEmpty
          ? const _AlDia('Nada vence en los próximos días.')
          : Tarjeta(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, v) in inicio.vencimientos.indexed) ...[
                    if (i > 0) const Divider(indent: 76),
                    _Vencimiento(v),
                  ],
                ],
              ),
            ),
    ),
  ];

  void _cuenta(BuildContext context, WidgetRef ref) {
    final sesion = ref.read(sesionProvider);
    if (sesion is! ConSesion) return;
    final u = sesion.usuario;
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Avatar(u.nombre, tamano: 64),
              const SizedBox(height: 12),
              Text(u.nombre, style: context.tema.textTheme.titleMedium),
              const SizedBox(height: 2),
              Text(u.email, style: context.tema.textTheme.bodySmall),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: context.tema.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  etiquetasRol[u.rol] ?? u.rol,
                  style: context.tema.textTheme.labelMedium?.copyWith(
                    color: context.tema.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    foregroundColor: context.nt.peligro,
                    side: BorderSide(color: context.nt.peligro.withValues(alpha: 0.35)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Cerrar sesión'),
                  onPressed: () {
                    Navigator.of(context).pop();
                    ref.read(sesionProvider.notifier).salir();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Iniciales del usuario sobre el degradado de la marca.
class _Avatar extends StatelessWidget {
  const _Avatar(this.nombre, {this.tamano = 40});
  final String nombre;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final iniciales = nombre
        .split(' ')
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p.characters.first.toUpperCase())
        .join();
    return Container(
      width: tamano,
      height: tamano,
      alignment: Alignment.center,
      decoration: const BoxDecoration(gradient: Marca.degradado, shape: BoxShape.circle),
      child: Text(
        iniciales,
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: tamano * 0.36),
      ),
    );
  }
}

/// Cabecera azul con saludo, fecha y los montos del mes.
class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.nombre, required this.contadores, required this.alTocarCuenta});
  final String nombre;
  final Map<String, double>? contadores;
  final VoidCallback alTocarCuenta;

  @override
  Widget build(BuildContext context) {
    final c = contadores;
    final blanco = Colors.white.withValues(alpha: 0.72);
    return Container(
      decoration: const BoxDecoration(
        gradient: Marca.degradado,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 14, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Logo(fondo: false),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'NexusTrack',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  Tooltip(
                    message: 'Mi cuenta',
                    child: InkResponse(
                      onTap: alTocarCuenta,
                      radius: 26,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                        ),
                        child: _Avatar(nombre.isEmpty ? '?' : nombre, tamano: 34),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                fechaLarga(DateTime.now()),
                style: TextStyle(color: blanco, fontSize: 13.5, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 4),
              Text(
                '${saludo(DateTime.now())}, ${nombre.split(' ').first}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 25,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'ESTE MES',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _CifraCabecera(
                      icono: Icons.account_balance_wallet_outlined,
                      etiqueta: 'Vales de dinero',
                      valor: c == null ? '—' : pesos(c['montoValesDineroMes']),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _CifraCabecera(
                      icono: Icons.local_gas_station_outlined,
                      etiqueta: 'Combustible',
                      valor: c == null
                          ? '—'
                          : '${numero(c['combustibleMesLitros'], decimales: 0)} L',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CifraCabecera extends StatelessWidget {
  const _CifraCabecera({required this.icono, required this.etiqueta, required this.valor});
  final IconData icono;
  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icono, size: 16, color: Marca.celeste),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                etiqueta,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.75),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            valor,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 21,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              fontFeatures: cifras,
            ),
          ),
        ),
      ],
    ),
  );
}

/// Contadores de la operación, en una grilla de 2 × 2.
class _Indicadores extends StatelessWidget {
  const _Indicadores(this.c);
  final Map<String, double> c;

  @override
  Widget build(BuildContext context) {
    final vencidas = (c['tarifasVencidas'] ?? 0) > 0;
    final items = [
      ('Retiros abiertos', c['retirosAbiertos'], Icons.assignment_outlined, context.nt.info),
      (
        'Sin orden de carga',
        c['retirosSinCarga'],
        Icons.pending_actions_outlined,
        context.nt.alerta,
      ),
      (
        'Cargas por rendir',
        c['cargasPorRendir'],
        Icons.inventory_2_outlined,
        context.tema.colorScheme.primary,
      ),
      (
        'Tarifas vencidas',
        c['tarifasVencidas'],
        Icons.event_busy_outlined,
        vencidas ? context.nt.peligro : context.nt.exito,
      ),
    ];
    Widget tarjeta((String, double?, IconData, Color) item) {
      final (etiqueta, valor, icono, color) = item;
      return Expanded(
        child: Tarjeta(
          margin: const EdgeInsets.all(5),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Insignia(icono, color: color, tamano: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      numero(valor),
                      style: context.tema.textTheme.headlineSmall?.copyWith(
                        fontSize: 22,
                        height: 1.1,
                        fontFeatures: cifras,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      etiqueta,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.tema.textTheme.bodySmall?.copyWith(fontSize: 12, height: 1.2),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(11, 14, 11, 0),
      child: Column(
        children: [
          for (final fila in [items.sublist(0, 2), items.sublist(2)])
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: fila.map(tarjeta).toList(),
              ),
            ),
        ],
      ),
    );
  }
}

/// Bloque sin pendientes: un visto verde y el mensaje.
class _AlDia extends StatelessWidget {
  const _AlDia(this.mensaje);
  final String mensaje;

  @override
  Widget build(BuildContext context) => Tarjeta(
    padding: const EdgeInsets.all(14),
    child: Row(
      children: [
        Insignia(Icons.check_circle_outline_rounded, color: context.nt.exito, tamano: 36),
        const SizedBox(width: 12),
        Expanded(child: Text(mensaje, style: context.tema.textTheme.bodyMedium)),
      ],
    ),
  );
}

class _Vencimiento extends StatelessWidget {
  const _Vencimiento(this.v);
  final Vencimiento v;

  @override
  Widget build(BuildContext context) {
    final color = v.dias < 0
        ? context.nt.peligro
        : v.dias <= 7
        ? context.nt.alerta
        : context.nt.info;
    final cuando = switch (v.dias) {
      < -1 => 'Venció hace ${-v.dias} días',
      -1 => 'Venció ayer',
      0 => 'Vence hoy',
      1 => 'Vence mañana',
      _ => 'En ${v.dias} días',
    };
    final partes = v.fecha.length >= 10 ? v.fecha.substring(0, 10).split('-') : null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 16, 12),
      child: Row(
        children: [
          Container(
            width: 48,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  partes == null ? '—' : '${int.parse(partes[2])}',
                  style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                    fontFeatures: cifras,
                  ),
                ),
                Text(
                  partes == null ? '' : mesCorto(int.parse(partes[1])),
                  style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${v.tipo} · ${v.referencia}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  v.detalle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.tema.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            cuando,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
