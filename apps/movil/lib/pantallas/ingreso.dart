import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../componentes/logo.dart';
import '../nucleo/api.dart';
import '../nucleo/sesion.dart';

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
    final tema = Theme.of(context);
    final sesion = ref.watch(sesionProvider);
    final aviso = _error ?? (sesion is SinSesion ? sesion.aviso : null);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: Logo(tamano: 64)),
                      const SizedBox(height: 16),
                      Text(
                        'NexusTrack',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'Gestión de fletes',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.bodyMedium?.copyWith(
                          color: tema.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 32),
                      if (aviso != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: tema.colorScheme.errorContainer,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            aviso,
                            style: TextStyle(color: tema.colorScheme.onErrorContainer),
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
                          prefixIcon: Icon(Icons.mail_outline),
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
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _ocultar ? 'Mostrar contraseña' : 'Ocultar contraseña',
                            icon: Icon(
                              _ocultar ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(() => _ocultar = !_ocultar),
                          ),
                        ),
                        validator: (v) => v == null || v.isEmpty ? 'Ingrese su contraseña.' : null,
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _ingresando ? null : _ingresar,
                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                        child: _ingresando
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2.5),
                              )
                            : const Text('Ingresar'),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Use el mismo correo y contraseña de NexusTrack en el computador.',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.bodySmall?.copyWith(
                          color: tema.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Mientras se revisa si hay una sesión guardada.
class PantallaCargando extends StatelessWidget {
  const PantallaCargando({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [Logo(tamano: 64), SizedBox(height: 24), CircularProgressIndicator()],
      ),
    ),
  );
}
