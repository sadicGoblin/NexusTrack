import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'nucleo/sesion.dart';
import 'pantallas/detalles.dart';
import 'pantallas/flota.dart';
import 'pantallas/ingreso.dart';
import 'pantallas/inicio.dart';
import 'pantallas/listados.dart';

final _raiz = GlobalKey<NavigatorState>();

/// Rutas de la app. Sin sesión, todo lleva al ingreso; con sesión, el ingreso lleva al inicio.
final routerProvider = Provider<GoRouter>((ref) {
  final sesion = ValueNotifier<EstadoSesion>(ref.read(sesionProvider));
  ref.listen(sesionProvider, (_, s) => sesion.value = s);
  ref.onDispose(sesion.dispose);

  int id(GoRouterState s) => int.parse(s.pathParameters['id']!);

  return GoRouter(
    navigatorKey: _raiz,
    initialLocation: '/inicio',
    refreshListenable: sesion,
    redirect: (context, estado) {
      final ruta = estado.matchedLocation;
      return switch (sesion.value) {
        SesionCargando() => ruta == '/cargando' ? null : '/cargando',
        SinSesion() => ruta == '/ingreso' ? null : '/ingreso',
        ConSesion() => ruta == '/ingreso' || ruta == '/cargando' ? '/inicio' : null,
      };
    },
    routes: [
      GoRoute(path: '/cargando', builder: (_, _) => const PantallaCargando()),
      GoRoute(path: '/ingreso', builder: (_, _) => const PantallaIngreso()),
      StatefulShellRoute.indexedStack(
        builder: (context, estado, navegacion) => _Marco(navegacion),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/inicio', builder: (_, _) => const PantallaInicio())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/fletes', builder: (_, _) => const PantallaFletes())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/vales', builder: (_, _) => const PantallaVales())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/flota', builder: (_, _) => const PantallaFlota())],
          ),
        ],
      ),
      GoRoute(
        path: '/retiros/:id',
        parentNavigatorKey: _raiz,
        builder: (_, s) => DetalleRetiro(id(s)),
      ),
      GoRoute(
        path: '/cargas/:id',
        parentNavigatorKey: _raiz,
        builder: (_, s) => DetalleCarga(id(s)),
      ),
      GoRoute(
        path: '/rendiciones/:id',
        parentNavigatorKey: _raiz,
        builder: (_, s) => DetalleRendicion(id(s)),
      ),
      GoRoute(
        path: '/vales-dinero/:id',
        parentNavigatorKey: _raiz,
        builder: (_, s) => DetalleValeDinero(id(s)),
      ),
      GoRoute(
        path: '/vales-combustible/:id',
        parentNavigatorKey: _raiz,
        builder: (_, s) => DetalleValeCombustible(id(s)),
      ),
    ],
  );
});

/// Pantallas principales con la barra de navegación inferior.
class _Marco extends StatelessWidget {
  const _Marco(this.navegacion);
  final StatefulNavigationShell navegacion;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: navegacion,
    bottomNavigationBar: NavigationBar(
      selectedIndex: navegacion.currentIndex,
      onDestinationSelected: (i) =>
          navegacion.goBranch(i, initialLocation: i == navegacion.currentIndex),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Inicio',
        ),
        NavigationDestination(
          icon: Icon(Icons.local_shipping_outlined),
          selectedIcon: Icon(Icons.local_shipping),
          label: 'Fletes',
        ),
        NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: 'Vales',
        ),
        NavigationDestination(
          icon: Icon(Icons.groups_outlined),
          selectedIcon: Icon(Icons.groups),
          label: 'Flota',
        ),
      ],
    ),
  );
}
