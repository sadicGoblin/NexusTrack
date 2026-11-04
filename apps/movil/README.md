# NexusTrack móvil

App Flutter para que el personal de la empresa **consulte** desde el teléfono lo que se registra
en NexusTrack. Usa las mismas cuentas y la misma API que la web; no modifica datos.

| Pantalla | Qué muestra                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| Inicio   | Indicadores del día, retiros sin orden de carga, cargas por rendir y vencimientos.  |
| Fletes   | Órdenes de retiro (vigentes o por mes), órdenes de carga (por rendir o por mes) y rendiciones. |
| Vales    | Vales de dinero y de combustible por mes, con sus totales.                          |
| Flota    | Qué conductor y qué remolque van con cada camión.                                   |

Cada documento abre su detalle, con enlaces entre ellos (retiro → carga → rendición, vales).

## Requisitos

- Flutter 3.32 o superior (`flutter doctor`).
- Android: Android Studio con su SDK. Teléfonos con Android 6.0 o superior.
- iPhone: macOS con Xcode instalado (no lo está en el equipo donde se creó la app).

## Uso

```bash
cd apps/movil
flutter pub get
flutter run                     # en un teléfono o emulador conectado
flutter test                    # pruebas
flutter analyze                 # revisión de código
```

Por defecto la app usa la API de producción. Para otra API:

```bash
flutter run --dart-define=NT_API_URL=http://192.168.1.10:3100
```

Desde un teléfono, `localhost` es el propio teléfono: use la IP del computador. La API solo
acepta orígenes web de `CORS_ORIGIN`; esto afecta a la versión web, no a Android ni iPhone.

## Instalar en teléfonos

- **Android, prueba rápida:** `flutter build apk --release` genera
  `build/app/outputs/flutter-apk/app-release.apk`, que se puede enviar e instalar directamente.
  Para Google Play hace falta una clave de firma propia (`flutter build appbundle`).
- **iPhone:** requiere Xcode y una cuenta de Apple Developer; se distribuye por TestFlight o App Store.

## Estructura

```
lib/
  config.dart        Dirección de la API (NT_API_URL)
  tema.dart          Colores de la marca, letra Inter, modo claro y oscuro, estilo de los controles
  nucleo/            Cliente de la API, sesión, credenciales cifradas, formatos chilenos
  modelos/           Documentos de la API
  datos/             Repositorio y proveedores de datos (Riverpod)
  componentes/       Logo, tarjetas, listados con período y búsqueda, estados, esqueletos de carga
  pantallas/         Ingreso, inicio, fletes, vales, flota y detalles
assets/
  fonts/             Inter (la letra de la web; licencia OFL en Inter-OFL.txt)
  icono/             Ícono y pantalla de arranque, hechos con el trazo del logo de la web
test/
  datos/             Respuestas reales de la API usadas en las pruebas
```

## Diseño

Usa los colores y el logo de la web (azul marino `#0B3D66`, celeste `#38BDF8`) y la letra Inter
incluida en la app. Las cabeceras del inicio, del ingreso y de cada documento van sobre el
degradado de la marca; los estados tienen el mismo código de colores que la web. Sigue el modo
claro u oscuro del teléfono. Los colores propios (estados, bordes, sombras) están en `ColoresNt`
(`lib/tema.dart`) y se leen con `context.nt`.

## Ícono y pantalla de arranque

Se generan desde `assets/icono` (configuración en `flutter_launcher_icons.yaml` y
`flutter_native_splash.yaml`):

```bash
dart run flutter_launcher_icons          # Android (ícono adaptable), iPhone y web
dart run flutter_native_splash:create    # arranque azul con el logo (incluye Android 12)
```

`flutter_launcher_icons` cambia por error una línea de `ios/Runner.xcodeproj/project.pbxproj`
(`ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS`): descartar ese cambio.

## Sesión

El ingreso devuelve un token de acceso (15 minutos) y una cookie de renovación (7 días). La app
guarda la cookie en el almacén cifrado del teléfono y renueva el acceso sin pedir la contraseña
mientras se use al menos una vez por semana. «Cerrar sesión» la borra del teléfono y del servidor.

## Ideas para choferes (pendiente, no implementado)

- Recibir en el teléfono la orden de retiro cuando se emite (notificaciones push con Firebase
  Cloud Messaging), además de la llamada habitual.
- Hacer la rendición desde el teléfono al terminar el flete: viáticos, gastos con foto de la boleta
  y odómetro, para que la oficina solo la revise y apruebe.

Ambas requieren cambios en la API: un rol de chofer vinculado a su ficha de conductor y que solo
vea sus propios fletes, registro de dispositivos y almacenamiento de fotos.
