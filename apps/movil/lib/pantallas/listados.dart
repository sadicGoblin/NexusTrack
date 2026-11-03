import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../componentes/comunes.dart';
import '../componentes/listado.dart';
import '../datos/repositorio.dart';
import '../modelos/modelos.dart';
import '../nucleo/formato.dart';

String _vehiculo(String camion, String? remolque) =>
    remolque == null ? camion : '$camion / $remolque';

/// Órdenes de retiro, órdenes de carga y rendiciones.
class PantallaFletes extends StatelessWidget {
  const PantallaFletes({super.key});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Fletes'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Retiros'),
            Tab(text: 'Cargas'),
            Tab(text: 'Rendiciones'),
          ],
        ),
      ),
      body: TabBarView(
        children: [
          Listado<OrdenRetiro>(
            proveedor: retirosProvider.call,
            unidad: 'órdenes de retiro',
            singular: 'orden de retiro',
            etiquetaVigentes: 'Vigentes',
            buscable: (o) =>
                '${o.numero} ${o.cliente} ${o.conductor} ${o.camion} ${o.remolque ?? ''} ${o.origen} ${o.destino}',
            tarjeta: (o) => TarjetaDocumento(
              titulo: 'N° ${correlativo(o.numero)}',
              estado: o.estado,
              lineas: [
                o.cliente,
                '${o.origen} → ${o.destino} · ${fecha(o.fecha)}',
                '${o.conductor} · ${_vehiculo(o.camion, o.remolque)}',
              ],
              alTocar: () => context.push('/retiros/${o.id}'),
            ),
          ),
          Listado<OrdenCarga>(
            proveedor: cargasProvider.call,
            unidad: 'órdenes de carga',
            singular: 'orden de carga',
            etiquetaVigentes: 'Por rendir',
            buscable: (o) =>
                '${o.numero} ${o.retiro.cliente} ${o.retiro.conductor} ${o.patenteCamion} ${o.patenteRemolque ?? ''} ${o.tramo ?? ''}',
            total: (l) => pesos(
              l.where((o) => o.estado != 'ANULADA').fold<int>(0, (s, o) => s + o.totalNeto),
            ),
            tarjeta: (o) => TarjetaDocumento(
              titulo: 'N° ${correlativo(o.numero)}',
              estado: o.estado,
              monto: pesos(o.totalNeto),
              lineas: [
                o.retiro.cliente,
                '${o.tramo ?? '${o.retiro.origen} → ${o.retiro.destino}'} · ${fechaHora(o.fechaCarga, o.horaCarga)}',
                '${o.retiro.conductor} · ${_vehiculo(o.patenteCamion, o.patenteRemolque)}',
              ],
              alTocar: () => context.push('/cargas/${o.id}'),
            ),
          ),
          Listado<Rendicion>(
            proveedor: rendicionesProvider.call,
            unidad: 'rendiciones',
            singular: 'rendición',
            buscable: (r) =>
                '${r.numero} ${r.ordenCargaNumero ?? ''} ${r.retiro?.cliente ?? ''} ${r.conductor} ${r.destino} ${r.patenteCamion}',
            total: (l) => pesos(
              l.where((r) => r.estado != 'ANULADO').fold<int>(0, (s, r) => s + r.totalGeneral),
            ),
            tarjeta: (r) => TarjetaDocumento(
              titulo: 'N° ${correlativo(r.numero)}',
              estado: r.estado,
              monto: pesos(r.totalGeneral),
              lineas: [
                r.retiro?.cliente ?? 'Estadía en ${r.destino}',
                r.ordenCargaNumero == null
                    ? 'Estadía · ${fecha(r.fecha)}'
                    : 'Orden de carga N° ${correlativo(r.ordenCargaNumero)} · ${fecha(r.fecha)}',
                '${r.conductor} · ${_vehiculo(r.patenteCamion, r.patenteRemolque)}',
              ],
              alTocar: () => context.push('/rendiciones/${r.id}'),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Vales de dinero y de combustible.
class PantallaVales extends StatelessWidget {
  const PantallaVales({super.key});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Vales'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Dinero'),
            Tab(text: 'Combustible'),
          ],
        ),
      ),
      body: TabBarView(
        children: [
          Listado<ValeDinero>(
            proveedor: valesDineroProvider.call,
            unidad: 'vales de dinero',
            singular: 'vale de dinero',
            buscable: (v) =>
                '${v.numero} ${v.retiro?.numero ?? ''} ${v.conductor} ${v.retiro?.cliente ?? ''} ${v.sitioEntrega}',
            total: (l) =>
                pesos(l.where((v) => v.estado != 'ANULADO').fold<int>(0, (s, v) => s + v.monto)),
            tarjeta: (v) => TarjetaDocumento(
              titulo: 'N° ${correlativo(v.numero)}',
              estado: v.estado,
              monto: pesos(v.monto),
              lineas: [
                v.conductor,
                v.retiro != null
                    ? 'Retiro N° ${correlativo(v.retiro!.numero)} · ${v.retiro!.cliente}'
                    : 'Estadía N° ${correlativo(v.estadia?.numero)} · ${v.estadia?.destino ?? ''}',
                'Entregado el ${fecha(v.fechaEntrega)} en ${v.sitioEntrega} · ${v.formaPago}',
              ],
              alTocar: () => context.push('/vales-dinero/${v.id}'),
            ),
          ),
          Listado<ValeCombustible>(
            proveedor: valesCombustibleProvider.call,
            unidad: 'vales de combustible',
            singular: 'vale de combustible',
            buscable: (v) =>
                '${v.numero} ${v.retiro.numero} ${v.retiro.conductor} ${v.camion} ${v.remolque ?? ''} ${v.sitioEntrega}',
            total: (l) {
              final vigentes = l.where((v) => v.estado != 'ANULADO');
              final totalLitros = vigentes.fold<double>(0, (s, v) => s + v.totalLitros);
              return '${litros(totalLitros)} · ${pesos(vigentes.fold<int>(0, (s, v) => s + v.total))}';
            },
            tarjeta: (v) => TarjetaDocumento(
              titulo: 'N° ${correlativo(v.numero)}',
              estado: v.estado,
              monto: pesos(v.total),
              lineas: [
                v.retiro.conductor,
                '${litros(v.totalLitros)} · ${_vehiculo(v.camion, v.remolque)}',
                'Entregado el ${fechaHora(v.fechaEntrega, v.horaEntrega)} en ${v.sitioEntrega}',
              ],
              alTocar: () => context.push('/vales-combustible/${v.id}'),
            ),
          ),
        ],
      ),
    ),
  );
}
