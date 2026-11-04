import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../componentes/comunes.dart';
import '../componentes/estado.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';
import '../tema.dart';

bool _vacio(String? v) => v == null || v.trim().isEmpty || v == '—';

/// Sección que omite los datos vacíos; si no queda ninguno, no se muestra.
Widget _seccion(String titulo, IconData icono, List<Dato> datos) {
  final visibles = datos.where((d) => !_vacio(d.valor)).toList();
  return visibles.isEmpty
      ? const SizedBox.shrink()
      : SeccionDatos(titulo: titulo, icono: icono, datos: visibles);
}

String _vehiculo(String camion, String? remolque) =>
    remolque == null ? camion : '$camion / $remolque';

/// Encabezado del detalle sobre el degradado de la marca: tipo, número, estado, contexto y monto.
class _Cabecera extends StatelessWidget {
  const _Cabecera({
    required this.icono,
    required this.tipo,
    required this.numero,
    required this.estado,
    required this.subtitulo,
    this.monto,
    this.etiquetaMonto = 'Total',
  });
  final IconData icono;
  final String tipo;
  final int numero;
  final String estado;
  final String subtitulo;
  final String? monto;
  final String etiquetaMonto;

  @override
  Widget build(BuildContext context) {
    final tenue = Colors.white.withValues(alpha: 0.72);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        gradient: Marca.degradado,
        borderRadius: BorderRadius.circular(20),
        boxShadow: context.nt.sombra,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icono, size: 18, color: Marca.celeste),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tipo,
                  style: TextStyle(color: tenue, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              EstadoChip(estado, sobreOscuro: true),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'N° ${correlativo(numero)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              fontFeatures: cifras,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitulo,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.88),
              fontSize: 14,
              height: 1.35,
            ),
          ),
          if (monto != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              ),
              child: Row(
                children: [
                  Text(etiquetaMonto, style: TextStyle(color: tenue, fontSize: 13)),
                  const Spacer(),
                  Text(
                    monto!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      fontFeatures: cifras,
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

/// Esqueleto común: carga, error con reintento y «deslizar para actualizar».
class _Detalle<T> extends ConsumerWidget {
  const _Detalle({required this.titulo, required this.proveedor, required this.contenido});
  final String titulo;
  final FutureProvider<T> proveedor;
  final List<Widget> Function(BuildContext context, T datos) contenido;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: Text(titulo)),
    body: VistaAsincrona(
      valor: ref.watch(proveedor),
      alReintentar: () => ref.invalidate(proveedor),
      datos: (d) => RefreshIndicator(
        onRefresh: () => ref.refresh(proveedor.future),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(top: 4, bottom: 32),
          children: contenido(context, d),
        ),
      ),
    ),
  );
}

/// Datos de la orden de retiro de la que depende un documento, con enlace a ella.
Widget _seccionRetiro(BuildContext context, ResumenRetiro r) =>
    _seccion('Orden de retiro', Icons.assignment_outlined, [
      Dato(
        'Orden de retiro',
        'N° ${correlativo(r.numero)}',
        alTocar: () => context.push('/retiros/${r.id}'),
      ),
      Dato('Cliente', r.cliente),
      Dato('Ruta', '${r.origen} → ${r.destino}'),
      Dato('Conductor', r.conductor),
      Dato('RUT conductor', r.conductorRut),
      Dato('Empresa', r.empresa),
      Dato('Camión / remolque', _vehiculo(r.camion, r.remolque)),
    ]);

Widget _observaciones(String? texto) => _vacio(texto)
    ? const SizedBox.shrink()
    : SeccionDatos(
        titulo: 'Observaciones',
        icono: Icons.notes_rounded,
        datos: [Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 10), child: Text(texto!))],
      );

class DetalleRetiro extends StatelessWidget {
  const DetalleRetiro(this.id, {super.key});
  final int id;

  @override
  Widget build(BuildContext context) => _Detalle<OrdenRetiro>(
    titulo: 'Orden de retiro',
    proveedor: retiroProvider(id),
    contenido: (context, o) => [
      _Cabecera(
        icono: Icons.assignment_outlined,
        tipo: 'Orden de retiro',
        numero: o.numero,
        estado: o.estado,
        subtitulo: '${o.cliente} · ${o.origen} → ${o.destino}',
      ),
      if (o.estado == 'ANULADA') AvisoAnulado(o.motivoAnulacion),
      _seccion('Flete', Icons.route_outlined, [
        Dato('Fecha', fecha(o.fecha)),
        Dato('Trazabilidad', o.trazabilidad),
        Dato('Cliente', o.cliente),
        Dato('Ruta', '${o.origen} → ${o.destino}'),
        Dato('Destino final', o.destinoFinal),
      ]),
      _seccion('Transporte', Icons.local_shipping_outlined, [
        Dato('Conductor', o.conductor),
        Dato('RUT conductor', o.conductorRut),
        Dato('Empresa', o.empresa),
        Dato('Camión', o.camion),
        Dato('Remolque', o.remolque == null ? null : '${o.remolque} · ${texto(o.tipoRemolque)}'),
      ]),
      _seccion('Retiro y carga', Icons.warehouse_outlined, [
        Dato('Depósito de retiro', o.depositoRetiro),
        Dato('Packing de carga', o.packingCarga),
        Dato('Carga programada', fechaHora(o.fechaCarga, o.horaCarga)),
        Dato('Depósito de entrega', o.depositoEntrega),
        Dato('Packing de entrega', o.packingEntrega),
      ]),
      _seccion('Embarque', Icons.directions_boat_outlined, [
        Dato('Nave', o.nave),
        Dato('MTB', o.mtb),
        Dato('Booking', o.booking),
        Dato('Puerto de embarque', o.puertoEmbarque),
        Dato('Embarque', fechaHora(o.fechaEmbarque, o.horaEmbarque)),
        Dato('OP N°', o.opNumero),
        Dato('O/C', o.ordenCompra),
      ]),
      _observaciones(o.observaciones),
      _DocumentosDelRetiro(o),
    ],
  );
}

/// Orden de carga y vales de una orden de retiro.
class _DocumentosDelRetiro extends ConsumerWidget {
  const _DocumentosDelRetiro(this.o);
  final OrdenRetiro o;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dinero = ref.watch(valesDineroDeRetiroProvider(o.id)).value ?? const [];
    final combustible = ref.watch(valesCombustibleDeRetiroProvider(o.id)).value ?? const [];
    return SeccionDatos(
      titulo: 'Documentos del flete',
      icono: Icons.folder_open_outlined,
      datos: [
        o.ordenCargaId == null
            ? const Dato('Orden de carga', 'Aún no tiene', icono: Icons.inventory_2_outlined)
            : Dato(
                'Orden de carga',
                'N° ${correlativo(o.ordenCargaNumero)}',
                icono: Icons.inventory_2_outlined,
                alTocar: () => context.push('/cargas/${o.ordenCargaId}'),
              ),
        if (dinero.isEmpty)
          const Dato('Vales de dinero', 'Aún no tiene', icono: Icons.payments_outlined),
        for (final v in dinero)
          Dato(
            'Vale de dinero N° ${correlativo(v.numero)}',
            '${pesos(v.monto)}${v.estado == 'ANULADO' ? ' (anulado)' : ''}',
            icono: Icons.payments_outlined,
            alTocar: () => context.push('/vales-dinero/${v.id}'),
          ),
        if (combustible.isEmpty)
          const Dato(
            'Vales de combustible',
            'Aún no tiene',
            icono: Icons.local_gas_station_outlined,
          ),
        for (final v in combustible)
          Dato(
            'Vale de combustible N° ${correlativo(v.numero)}',
            '${litros(v.totalLitros)}${v.estado == 'ANULADO' ? ' (anulado)' : ''}',
            icono: Icons.local_gas_station_outlined,
            alTocar: () => context.push('/vales-combustible/${v.id}'),
          ),
      ],
    );
  }
}

class DetalleCarga extends StatelessWidget {
  const DetalleCarga(this.id, {super.key});
  final int id;

  @override
  Widget build(BuildContext context) => _Detalle<OrdenCarga>(
    titulo: 'Orden de carga',
    proveedor: cargaProvider(id),
    contenido: (context, o) => [
      _Cabecera(
        icono: Icons.inventory_2_outlined,
        tipo: 'Orden de carga',
        numero: o.numero,
        estado: o.estado,
        subtitulo: '${o.retiro.cliente} · ${o.tramo ?? '${o.retiro.origen} → ${o.retiro.destino}'}',
        monto: pesos(o.totalNeto),
        etiquetaMonto: 'Total neto',
      ),
      if (o.estado == 'ANULADA') AvisoAnulado(o.motivoAnulacion),
      _seccion('Carga', Icons.inventory_2_outlined, [
        Dato('Fecha de carga', fechaHora(o.fechaCarga, o.horaCarga)),
        Dato('Tramo', o.tramo),
        Dato('Packing de carga', o.packingCarga),
        Dato('Camión / remolque', _vehiculo(o.patenteCamion, o.patenteRemolque)),
        Dato('Hoja de ruta', o.hojaRuta == null ? null : 'N° ${correlativo(o.hojaRuta)}'),
        Dato('Guías confirmadas', o.guiasConfirmadas == null ? null : momento(o.guiasConfirmadas)),
        Dato('Total neto', pesos(o.totalNeto), destacado: true),
        if (o.rendicionId != null)
          Dato(
            'Rendición',
            'N° ${correlativo(o.rendicionNumero)}',
            alTocar: () => context.push('/rendiciones/${o.rendicionId}'),
          ),
      ]),
      if (o.guias.isNotEmpty)
        SeccionDatos(
          titulo: 'Guías del flete (${o.guias.length})',
          icono: Icons.description_outlined,
          datos: [for (final g in o.guias) _GuiaFlete(g)],
        ),
      _observaciones(o.observaciones),
      _seccionRetiro(context, o.retiro),
    ],
  );
}

class _GuiaFlete extends StatelessWidget {
  const _GuiaFlete(this.g);
  final Guia g;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final tenue = tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant);
    final especie = [
      g.especie,
      if (g.cantidadEspecie != null) '${numero(g.cantidadEspecie)} ${g.umEspecie ?? ''}'.trim(),
    ].whereType<String>().join(' · ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Guía ${g.numeroGuia}',
                style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: 8),
              Text(fecha(g.fechaGuia), style: tenue),
              const Spacer(),
              Text(
                pesos(g.total),
                style: tema.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFeatures: cifras,
                ),
              ),
            ],
          ),
          Text(g.tramo, style: tenue),
          if (especie.isNotEmpty) Text(especie, style: tenue),
          if (!_vacio(g.numeroContenedor)) Text('Contenedor ${g.numeroContenedor}', style: tenue),
          Text(
            '${numero(g.cantidadTarifa, decimales: 2)} ${g.umTarifa ?? ''} × ${pesos(g.valorUnitario)}',
            style: tenue,
          ),
        ],
      ),
    );
  }
}

class DetalleValeDinero extends StatelessWidget {
  const DetalleValeDinero(this.id, {super.key});
  final int id;

  @override
  Widget build(BuildContext context) => _Detalle<ValeDinero>(
    titulo: 'Vale de dinero',
    proveedor: valeDineroProvider(id),
    contenido: (context, v) => [
      _Cabecera(
        icono: Icons.payments_outlined,
        tipo: 'Vale de dinero',
        numero: v.numero,
        estado: v.estado,
        subtitulo: v.conductor,
        monto: pesos(v.monto),
        etiquetaMonto: 'Monto',
      ),
      if (v.estado == 'ANULADO') AvisoAnulado(v.motivoAnulacion),
      _seccion('Vale', Icons.payments_outlined, [
        Dato('Fecha de entrega', fecha(v.fechaEntrega)),
        Dato('Concepto', v.concepto),
        Dato('Glosa', v.glosa),
        Dato('Sitio de entrega', v.sitioEntrega),
        Dato('Forma de pago', v.formaPago),
        Dato('Monto', pesos(v.monto), destacado: true),
      ]),
      if (v.retiro != null) _seccionRetiro(context, v.retiro!),
      if (v.estadia != null)
        _seccion('Estadía', Icons.hourglass_bottom_rounded, [
          Dato(
            'Estadía',
            'N° ${correlativo(v.estadia!.numero)}',
            alTocar: () => context.push('/rendiciones/${v.estadia!.id}'),
          ),
          Dato('Lugar', v.estadia!.destino),
          Dato('Conductor', v.estadia!.conductor),
        ]),
    ],
  );
}

class DetalleValeCombustible extends StatelessWidget {
  const DetalleValeCombustible(this.id, {super.key});
  final int id;

  @override
  Widget build(BuildContext context) => _Detalle<ValeCombustible>(
    titulo: 'Vale de combustible',
    proveedor: valeCombustibleProvider(id),
    contenido: (context, v) => [
      _Cabecera(
        icono: Icons.local_gas_station_outlined,
        tipo: 'Vale de combustible',
        numero: v.numero,
        estado: v.estado,
        subtitulo: '${v.retiro.conductor} · ${litros(v.totalLitros)}',
        monto: pesos(v.total),
      ),
      if (v.estado == 'ANULADO') AvisoAnulado(v.motivoAnulacion),
      _seccion('Entrega', Icons.place_outlined, [
        Dato('Fecha de entrega', fechaHora(v.fechaEntrega, v.horaEntrega)),
        Dato('Sitio de entrega', v.sitioEntrega),
        Dato('Forma de pago', v.formaPago),
        Dato('Tipo de documento', v.tipoDocumento),
      ]),
      _seccion('Combustible', Icons.local_gas_station_outlined, [
        Dato('Camión ${v.camion}', litros(v.litrosCamion)),
        if (v.remolque != null) Dato('Remolque ${v.remolque}', litros(v.litrosRemolque)),
        Dato('Total litros', litros(v.totalLitros)),
        Dato('Valor litro', pesos(v.valorLitro)),
        Dato('Total', pesos(v.total), destacado: true),
      ]),
      _observaciones(v.observaciones),
      _seccionRetiro(context, v.retiro),
    ],
  );
}

class DetalleRendicion extends StatelessWidget {
  const DetalleRendicion(this.id, {super.key});
  final int id;

  @override
  Widget build(BuildContext context) => _Detalle<Rendicion>(
    titulo: 'Rendición',
    proveedor: rendicionProvider(id),
    contenido: (context, r) => [
      _Cabecera(
        icono: r.esEstadia ? Icons.hourglass_bottom_rounded : Icons.fact_check_outlined,
        tipo: r.esEstadia ? 'Rendición de estadía' : 'Rendición de fletes',
        numero: r.numero,
        estado: r.estado,
        subtitulo: '${r.retiro?.cliente ?? r.conductor} · ${r.origen} → ${r.destino}',
        monto: pesos(r.totalGeneral),
        etiquetaMonto: 'Total rendido',
      ),
      if (r.estado == 'ANULADO') AvisoAnulado(r.motivoAnulacion),
      _seccion(r.esEstadia ? 'Estadía' : 'Viaje', Icons.route_outlined, [
        if (r.ordenCargaId != null)
          Dato(
            'Orden de carga',
            'N° ${correlativo(r.ordenCargaNumero)}',
            alTocar: () => context.push('/cargas/${r.ordenCargaId}'),
          ),
        if (r.esEstadia) ...[
          Dato('Conductor', r.conductor),
          Dato('Ruta', '${r.origen} → ${r.destino}'),
          Dato('Camión / remolque', _vehiculo(r.patenteCamion, r.patenteRemolque)),
        ],
        Dato('Fecha de rendición', fecha(r.fecha)),
        Dato('Tramo', r.tramo),
        Dato('Salida', fechaHora(r.fechaSalida, r.horaSalida)),
        Dato('Llegada', fechaHora(r.fechaLlegada, r.horaLlegada)),
        Dato('Odómetro inicial', r.odometroInicial == null ? null : numero(r.odometroInicial)),
        Dato('Odómetro final', r.odometroFinal == null ? null : numero(r.odometroFinal)),
        Dato('Km recorridos', r.kmRecorridos == null ? null : '${numero(r.kmRecorridos)} km'),
        Dato('Sitio de entrega', r.sitioEntrega),
      ]),
      SeccionDatos(
        titulo: 'Totales',
        icono: Icons.calculate_outlined,
        datos: [
          Dato('Peajes', pesos(r.peajes)),
          Dato('Carga', pesos(r.carga)),
          Dato('Descarga', pesos(r.descarga)),
          Dato('Viáticos', pesos(r.totalViaticos)),
          Dato('Otros gastos', pesos(r.totalOtrosGastos)),
          Dato('Total rendido', pesos(r.totalGeneral), destacado: true),
        ],
      ),
      if (r.viaticos.isNotEmpty)
        SeccionDatos(
          titulo: 'Viáticos (${r.viaticos.length})',
          icono: Icons.restaurant_outlined,
          datos: [
            for (final v in r.viaticos)
              Dato(
                '${fecha(v.fecha)} · desayuno ${pesos(v.desayuno)}, almuerzo ${pesos(v.almuerzo)}, comida ${pesos(v.comida)}',
                pesos(v.total),
              ),
          ],
        ),
      if (r.gastos.isNotEmpty)
        SeccionDatos(
          titulo: 'Otros gastos (${r.gastos.length})',
          icono: Icons.receipt_outlined,
          datos: [
            for (final g in r.gastos)
              Dato(
                [
                  g.item ?? g.tipoDocumento ?? 'Gasto',
                  if (!_vacio(g.numeroDocumento)) 'N° ${g.numeroDocumento}',
                  if (!_vacio(g.fecha)) fecha(g.fecha),
                ].join(' · '),
                pesos(g.monto),
              ),
          ],
        ),
      _observaciones(r.observaciones),
      if (r.retiro != null) _seccionRetiro(context, r.retiro!),
    ],
  );
}
