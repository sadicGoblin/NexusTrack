import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'tema.dart';

class NexusTrackApp extends ConsumerWidget {
  const NexusTrackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'NexusTrack',
    debugShowCheckedModeBanner: false,
    theme: tema(Brightness.light),
    darkTheme: tema(Brightness.dark),
    locale: const Locale('es', 'CL'),
    supportedLocales: const [Locale('es', 'CL'), Locale('es')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    routerConfig: ref.watch(routerProvider),
  );
}
