import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexustrack_movil/datos/repositorio.dart';
import 'package:nexustrack_movil/modelos/modelos.dart';
import 'package:nexustrack_movil/nucleo/sesion.dart';
import 'package:nexustrack_movil/pantallas/detalles.dart';
import 'package:nexustrack_movil/pantallas/flota.dart';
import 'package:nexustrack_movil/pantallas/ingreso.dart';
import 'package:nexustrack_movil/pantallas/listados.dart';

List<Json> leer(String nombre) =>
    (jsonDecode(File('test/datos/$nombre.json').readAsStringSync()) as List).cast<Json>();

class _SesionFija extends SesionNotifier {
  _SesionFija(this.inicial);
  final EstadoSesion inicial;
  String? correo;

  @override
  EstadoSesion build() => inicial;

  @override
  Future<void> ingresar(String email, String password) async => correo = email;
}

Future<void> mostrar(WidgetTester tester, Widget pantalla, {List overrides = const []}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [...overrides],
      retry: (_, _) => null,
      child: MaterialApp(home: pantalla),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el ingreso valida los campos y envía el correo', (tester) async {
    final sesion = _SesionFija(const SinSesion(aviso: 'Su sesión expiró. Ingrese nuevamente.'));
    await mostrar(
      tester,
      const PantallaIngreso(),
      overrides: [sesionProvider.overrideWith(() => sesion)],
    );
    expect(find.text('Su sesión expiró. Ingrese nuevamente.'), findsOneWidget);

    await tester.tap(find.text('Ingresar'));
    await tester.pump();
    expect(find.text('Ingrese su correo.'), findsOneWidget);
    expect(find.text('Ingrese su contraseña.'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).first, 'admin@nexustrack.cl');
    await tester.enterText(find.byType(TextFormField).last, 'secreta');
    await tester.tap(find.text('Ingresar'));
    await tester.pumpAndSettle();
    expect(sesion.correo, 'admin@nexustrack.cl');
  });

  testWidgets('los fletes listan las órdenes vigentes y se pueden buscar', (tester) async {
    final retiros = leer('ordenes-retiro').map(OrdenRetiro.desde).toList();
    await mostrar(
      tester,
      const PantallaFletes(),
      overrides: [
        retirosProvider.overrideWith((ref, consulta) async => consulta.vigentes ? retiros : []),
      ],
    );
    expect(find.text('${retiros.length} órdenes de retiro'), findsOneWidget);
    expect(find.text(retiros.first.cliente), findsWidgets);

    await tester.enterText(find.byType(TextField), 'patente-que-no-existe');
    await tester.pump();
    expect(find.text('Ningún resultado para la búsqueda.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), retiros.first.camion.toLowerCase());
    await tester.pump();
    expect(find.textContaining(retiros.first.camion), findsWidgets);

    await tester.tap(find.text('Por mes'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No hay órdenes de retiro en'), findsOneWidget);
  });

  testWidgets('la flota muestra conductor y remolques, y filtra los sin conductor', (tester) async {
    final flota = leer('flota').map(CamionFlota.desde).toList();
    await mostrar(
      tester,
      const PantallaFlota(),
      overrides: [flotaProvider.overrideWith((ref) async => flota)],
    );
    final conConductor = flota.firstWhere((c) => c.conductor != null);
    expect(find.text(conConductor.conductor!), findsOneWidget);
    expect(find.textContaining('${conConductor.chasis} (chasis)'), findsOneWidget);

    await tester.tap(find.text('Sin conductor'));
    await tester.pumpAndSettle();
    expect(find.text(conConductor.conductor!), findsNothing);
    expect(find.text('Sin conductor asignado'), findsWidgets);
  });

  testWidgets('el detalle de una orden de retiro omite las secciones vacías', (tester) async {
    final json = jsonDecode(File('test/datos/orden-retiro.json').readAsStringSync()) as Json;
    final o = OrdenRetiro.desde(json);
    await mostrar(
      tester,
      DetalleRetiro(o.id),
      overrides: [
        retiroProvider.overrideWith((ref, id) async => o),
        valesDineroDeRetiroProvider.overrideWith((ref, id) async => []),
        valesCombustibleDeRetiroProvider.overrideWith((ref, id) async => []),
      ],
    );
    expect(find.text('Transporte'), findsOneWidget);
    expect(find.text(o.conductorRut), findsOneWidget);
    if (o.nave == null && o.booking == null && o.puertoEmbarque == null) {
      expect(find.text('Embarque'), findsNothing);
    }
    await tester.scrollUntilVisible(find.text('Documentos del flete'), 300);
    expect(find.text('Documentos del flete'), findsOneWidget);
  });
}
