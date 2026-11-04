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
        bottom: const Pestanas(['Retiros', 'Cargas', 'Rendiciones']),
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
              icono: Icons.assignment_outlined,
              numero: 'N° ${correlativo(o.numero)}',
              fecha: fecha(o.fecha),
              estado: o.estado,
              titulo: o.cliente,
              ruta: (o.origen, o.destino),
              detalles: [
                (Icons.person_outline_rounded, o.conductor),
                (Icons.local_shipping_outlined, _vehiculo(o.camion, o.remolque)),
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
              icono: Icons.inventory_2_outlined,
              numero: 'N° ${correlativo(o.numero)}',
              fecha: fechaHora(o.fechaCarga, o.horaCarga),
              estado: o.estado,
              titulo: o.retiro.cliente,
              ruta: (o.retiro.origen, o.retiro.destino),
              detalles: [
                (Icons.person_outline_rounded, o.retiro.conductor),
                (Icons.local_shipping_outlined, _vehiculo(o.patenteCamion, o.patenteRemolque)),
              ],
              monto: pesos(o.totalNeto),
              etiquetaMonto: 'Total neto',
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
              icono: r.esEstadia ? Icons.hourglass_bottom_rounded : Icons.fact_check_outlined,
              numero: 'N° ${correlativo(r.numero)}',
              fecha: fecha(r.fecha),
              estado: r.estado,
              titulo: r.retiro?.cliente ?? 'Estadía en ${r.destino}',
              ruta: (r.origen, r.destino),
              detalles: [
                if (r.ordenCargaNumero != null)
                  (Icons.inventory_2_outlined, 'Carga N° ${correlativo(r.ordenCargaNumero)}'),
                (Icons.person_outline_rounded, r.conductor),
                (Icons.local_shipping_outlined, _vehiculo(r.patenteCamion, r.patenteRemolque)),
              ],
              monto: pesos(r.totalGeneral),
              etiquetaMonto: 'Total rendido',
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
      appBar: AppBar(title: const Text('Vales'), bottom: const Pestanas(['Dinero', 'Combustible'])),
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
              icono: Icons.payments_outlined,
              numero: 'N° ${correlativo(v.numero)}',
              fecha: fecha(v.fechaEntrega),
              estado: v.estado,
              titulo: v.conductor,
              detalles: [
                v.retiro != null
                    ? (
                        Icons.assignment_outlined,
                        'Retiro N° ${correlativo(v.retiro!.numero)} · ${v.retiro!.cliente}',
                      )
                    : (
                        Icons.hourglass_bottom_rounded,
                        'Estadía N° ${correlativo(v.estadia?.numero)} · ${v.estadia?.destino ?? ''}',
                      ),
                (Icons.place_outlined, v.sitioEntrega),
                (Icons.credit_card_outlined, v.formaPago),
              ],
              monto: pesos(v.monto),
              etiquetaMonto: 'Monto',
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
              icono: Icons.local_gas_station_outlined,
              numero: 'N° ${correlativo(v.numero)}',
              fecha: fechaHora(v.fechaEntrega, v.horaEntrega),
              estado: v.estado,
              titulo: v.retiro.conductor,
              detalles: [
                (Icons.water_drop_outlined, litros(v.totalLitros)),
                (Icons.local_shipping_outlined, _vehiculo(v.camion, v.remolque)),
                (Icons.place_outlined, v.sitioEntrega),
              ],
              monto: pesos(v.total),
              alTocar: () => context.push('/vales-combustible/${v.id}'),
            ),
          ),
        ],
      ),
    ),
  );
}
