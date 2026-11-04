import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../componentes/comunes.dart';
import '../componentes/logo.dart';
import '../nucleo/api.dart';
import '../nucleo/sesion.dart';
import '../tema.dart';

class PantallaIngreso extends ConsumerStatefulWidget {
  const PantallaIngreso({super.key});

  @override
  ConsumerState<PantallaIngreso> createState() => _PantallaIngresoState();
}

class _PantallaIngresoState extends ConsumerState<PantallaIngreso> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _ocultar = true;
  bool _ingresando = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _ingresar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() {
      _ingresando = true;
      _error = null;
    });
    try {
      await ref.read(sesionProvider.notifier).ingresar(_email.text, _password.text);
    } on ErrorApi catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _ingresando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = context.tema;
    final sesion = ref.watch(sesionProvider);
    final aviso = _error ?? (sesion is SinSesion ? sesion.aviso : null);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: SingleChildScrollView(
          child: Column(
            children: [
              const _Portada(),
              Transform.translate(
                offset: const Offset(0, -40),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Tarjeta(
                      margin: const EdgeInsets.symmetric(horizontal: 20),
                      padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
                      child: Form(
                        key: _formulario,
                        child: AutofillGroup(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text('Inicie sesión', style: tema.textTheme.titleLarge),
                              const SizedBox(height: 4),
                              Text(
                                'Use el mismo correo y contraseña de NexusTrack en el computador.',
                                style: tema.textTheme.bodySmall?.copyWith(fontSize: 13),
                              ),
                              const SizedBox(height: 22),
                              if (aviso != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: context.nt.peligro.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: context.nt.peligro.withValues(alpha: 0.25),
                                    ),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Icon(
                                        Icons.error_outline_rounded,
                                        size: 20,
                                        color: context.nt.peligro,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(aviso, style: tema.textTheme.bodyMedium),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                              TextFormField(
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                autofillHints: const [AutofillHints.username, AutofillHints.email],
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  labelText: 'Correo',
                                  prefixIcon: Icon(Icons.mail_outline_rounded),
                                ),
                                validator: (v) =>
                                    v == null || !v.contains('@') ? 'Ingrese su correo.' : null,
                              ),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: _password,
                                obscureText: _ocultar,
                                autofillHints: const [AutofillHints.password],
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _ingresar(),
                                decoration: InputDecoration(
                                  labelText: 'Contraseña',
                                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                                  suffixIcon: IconButton(
                                    tooltip: _ocultar ? 'Mostrar contraseña' : 'Ocultar contraseña',
                                    icon: Icon(
                                      _ocultar
                                          ? Icons.visibility_outlined
                                          : Icons.visibility_off_outlined,
                                    ),
                                    onPressed: () => setState(() => _ocultar = !_ocultar),
                                  ),
                                ),
                                validator: (v) =>
                                    v == null || v.isEmpty ? 'Ingrese su contraseña.' : null,
                              ),
                              const SizedBox(height: 22),
                              FilledButton(
                                onPressed: _ingresando ? null : _ingresar,
                                style: FilledButton.styleFrom(
                                  minimumSize: const Size.fromHeight(52),
                                ),
                                child: _ingresando
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2.5),
                                      )
                                    : const Text('Ingresar'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_rounded, size: 13, color: context.nt.tenue),
                    const SizedBox(width: 6),
                    Text('Conexión cifrada · NexusTrack', style: tema.textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Parte superior del ingreso: degradado de la marca, rutas de fondo, logo y nombre.
class _Portada extends StatelessWidget {
  const _Portada();

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    decoration: const BoxDecoration(gradient: Marca.degradado),
    child: CustomPaint(
      painter: const PatronRutas(),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 84),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                ),
                child: const Logo(tamano: 68),
              ),
              const SizedBox(height: 18),
              const Text(
                'NexusTrack',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Gestión de fletes',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.75),
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Rutas punteadas y paradas muy tenues sobre el degradado, como un mapa de fondo.
class PatronRutas extends CustomPainter {
  const PatronRutas();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final trazo = Paint()
      ..color = Colors.white.withValues(alpha: 0.09)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final rutas = [
      Path()
        ..moveTo(-20, h * 0.78)
        ..cubicTo(w * 0.25, h * 0.55, w * 0.45, h * 0.95, w * 0.7, h * 0.62)
        ..cubicTo(w * 0.85, h * 0.42, w * 0.95, h * 0.5, w + 20, h * 0.3),
      Path()
        ..moveTo(w * 0.05, -10)
        ..cubicTo(w * 0.2, h * 0.25, w * 0.05, h * 0.4, w * 0.3, h * 0.5),
      Path()
        ..moveTo(w * 0.62, -10)
        ..cubicTo(w * 0.7, h * 0.18, w * 0.98, h * 0.12, w + 10, h * 0.05),
    ];
    for (final ruta in rutas) {
      for (final tramo in ruta.computeMetrics()) {
        for (double d = 0; d < tramo.length; d += 14) {
          canvas.drawPath(tramo.extractPath(d, d + 7), trazo);
        }
      }
    }
    final parada = Paint()..color = Marca.celeste.withValues(alpha: 0.35);
    final halo = Paint()..color = Marca.celeste.withValues(alpha: 0.12);
    for (final p in [
      Offset(w * 0.7, h * 0.62),
      Offset(w * 0.3, h * 0.5),
      Offset(w * 0.9, h * 0.1),
    ]) {
      canvas.drawCircle(p, 11, halo);
      canvas.drawCircle(p, 4, parada);
    }
  }

  @override
  bool shouldRepaint(PatronRutas antes) => false;
}

/// Mientras se revisa si hay una sesión guardada.
class PantallaCargando extends StatelessWidget {
  const PantallaCargando({super.key});

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light,
    child: Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: Marca.degradado),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Logo(tamano: 72),
              SizedBox(height: 28),
              SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
