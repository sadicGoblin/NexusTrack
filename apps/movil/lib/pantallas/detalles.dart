import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../componentes/comunes.dart';
import '../componentes/estado.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';

bool _vacio(String? v) => v == null || v.trim().isEmpty || v == '—';

/// Sección que omite los datos vacíos; si no queda ninguno, no se muestra.
Widget _seccion(String titulo, List<Dato> datos) {
  final visibles = datos.where((d) => !_vacio(d.valor)).toList();
  return visibles.isEmpty ? const SizedBox.shrink() : SeccionDatos(titulo: titulo, datos: visibles);
}

String _vehiculo(String camion, String? remolque) =>
    remolque == null ? camion : '$camion / $remolque';

/// Encabezado del detalle: número, estado y una línea de contexto.
class _Cabecera extends StatelessWidget {
  const _Cabecera({
    required this.tipo,
    required this.numero,
    required this.estado,
    required this.subtitulo,
  });
  final String tipo;
  final int numero;
  final String estado;
  final String subtitulo;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tipo,
            style: tema.textTheme.labelLarge?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Text(
                'N° ${correlativo(numero)}',
                style: tema.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: tema.colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              EstadoChip(estado),
            ],
          ),
          const SizedBox(height: 4),
          Text(subtitulo, style: tema.textTheme.bodyMedium),
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
          padding: const EdgeInsets.only(bottom: 32),
          children: contenido(context, d),
        ),
      ),
    ),
  );
}

/// Datos de la orden de retiro de la que depende un documento, con enlace a ella.
Widget _seccionRetiro(BuildContext context, ResumenRetiro r) => _seccion('Orden de retiro', [
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
        datos: [Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(texto!))],
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
        tipo: 'Orden de retiro',
        numero: o.numero,
        estado: o.estado,
        subtitulo: '${o.cliente} · ${o.origen} → ${o.destino}',
      ),
      if (o.estado == 'ANULADA') AvisoAnulado(o.motivoAnulacion),
      _seccion('Flete', [
        Dato('Fecha', fecha(o.fecha)),
        Dato('Trazabilidad', o.trazabilidad),
        Dato('Cliente', o.cliente),
        Dato('Ruta', '${o.origen} → ${o.destino}'),
        Dato('Destino final', o.destinoFinal),
      ]),
      _seccion('Transporte', [
        Dato('Conductor', o.conductor),
        Dato('RUT conductor', o.conductorRut),
        Dato('Empresa', o.empresa),
        Dato('Camión', o.camion),
        Dato('Remolque', o.remolque == null ? null : '${o.remolque} · ${texto(o.tipoRemolque)}'),
      ]),
      _seccion('Retiro y carga', [
        Dato('Depósito de retiro', o.depositoRetiro),
        Dato('Packing de carga', o.packingCarga),
        Dato('Carga programada', fechaHora(o.fechaCarga, o.horaCarga)),
        Dato('Depósito de entrega', o.depositoEntrega),
        Dato('Packing de entrega', o.packingEntrega),
      ]),
      _seccion('Embarque', [
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
      datos: [
        o.ordenCargaId == null
            ? const Dato('Orden de carga', 'Aún no tiene')
            : Dato(
                'Orden de carga',
                'N° ${correlativo(o.ordenCargaNumero)}',
                alTocar: () => context.push('/cargas/${o.ordenCargaId}'),
              ),
        if (dinero.isEmpty) const Dato('Vales de dinero', 'Aún no tiene'),
        for (final v in dinero)
          Dato(
            'Vale de dinero N° ${correlativo(v.numero)}',
            '${pesos(v.monto)}${v.estado == 'ANULADO' ? ' (anulado)' : ''}',
            alTocar: () => context.push('/vales-dinero/${v.id}'),
          ),
        if (combustible.isEmpty) const Dato('Vales de combustible', 'Aún no tiene'),
        for (final v in combustible)
          Dato(
            'Vale de combustible N° ${correlativo(v.numero)}',
            '${litros(v.totalLitros)}${v.estado == 'ANULADO' ? ' (anulado)' : ''}',
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
        tipo: 'Orden de carga',
        numero: o.numero,
        estado: o.estado,
        subtitulo: '${o.retiro.cliente} · ${o.tramo ?? '${o.retiro.origen} → ${o.retiro.destino}'}',
      ),
      if (o.estado == 'ANULADA') AvisoAnulado(o.motivoAnulacion),
      _seccion('Carga', [
        Dato('Fecha de carga', fechaHora(o.fechaCarga, o.horaCarga)),
        Dato('Tramo', o.tramo),
        Dato('Packing de carga', o.packingCarga),
        Dato('Camión / remolque', _vehiculo(o.patenteCamion, o.patenteRemolque)),
        Dato('Hoja de ruta', o.hojaRuta == null ? null : 'N° ${correlativo(o.hojaRuta)}'),
        Dato('Guías confirmadas', o.guiasConfirmadas),
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
      padding: const EdgeInsets.symmetric(vertical: 8),
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
                style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
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
        tipo: 'Vale de dinero',
        numero: v.numero,
        estado: v.estado,
        subtitulo: '${v.conductor} · ${pesos(v.monto)}',
      ),
      if (v.estado == 'ANULADO') AvisoAnulado(v.motivoAnulacion),
      _seccion('Vale', [
        Dato('Fecha de entrega', fecha(v.fechaEntrega)),
        Dato('Concepto', v.concepto),
        Dato('Glosa', v.glosa),
        Dato('Sitio de entrega', v.sitioEntrega),
        Dato('Forma de pago', v.formaPago),
        Dato('Monto', pesos(v.monto), destacado: true),
      ]),
      if (v.retiro != null) _seccionRetiro(context, v.retiro!),
      if (v.estadia != null)
        _seccion('Estadía', [
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
        tipo: 'Vale de combustible',
        numero: v.numero,
        estado: v.estado,
        subtitulo: '${v.retiro.conductor} · ${litros(v.totalLitros)}',
      ),
      if (v.estado == 'ANULADO') AvisoAnulado(v.motivoAnulacion),
      _seccion('Entrega', [
        Dato('Fecha de entrega', fechaHora(v.fechaEntrega, v.horaEntrega)),
        Dato('Sitio de entrega', v.sitioEntrega),
        Dato('Forma de pago', v.formaPago),
        Dato('Tipo de documento', v.tipoDocumento),
      ]),
      _seccion('Combustible', [
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
        tipo: r.esEstadia ? 'Rendición de estadía' : 'Rendición de fletes',
        numero: r.numero,
        estado: r.estado,
        subtitulo: '${r.retiro?.cliente ?? r.conductor} · ${pesos(r.totalGeneral)}',
      ),
      if (r.estado == 'ANULADO') AvisoAnulado(r.motivoAnulacion),
      _seccion(r.esEstadia ? 'Estadía' : 'Viaje', [
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
        datos: [
          Dato('Peajes', pesos(r.peajes)),
          Dato('Carga', pesos(r.carga)),
          Dato('Descarga', pesos(r.descarga)),
          Dato('Viáticos', pesos(r.totalViaticos)),
          Dato('Otros gastos', pesos(r.totalOtrosGastos)),
          Dato('Total', pesos(r.totalGeneral), destacado: true),
        ],
      ),
      if (r.viaticos.isNotEmpty)
        SeccionDatos(
          titulo: 'Viáticos (${r.viaticos.length})',
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
