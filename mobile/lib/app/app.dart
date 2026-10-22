import 'package:flutter/material.dart';

import '../core/state/app_state.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

class NetSentryApp extends StatefulWidget {
  const NetSentryApp({super.key, this.state});
  final AppState? state;

  @override
  State<NetSentryApp> createState() => _NetSentryAppState();
}

class _NetSentryAppState extends State<NetSentryApp> {
  late final AppState state = widget.state ?? AppState();

  @override
  void initState() {
    super.initState();
    if (state.booting) state.hydrate();
  }

  @override
  void dispose() {
    if (widget.state == null) state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'NetSentry',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light(),
    home: ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        if (state.booting) return const _LaunchScreen();
        if (state.user == null) return LoginPage(state: state);
        return DashboardPage(state: state);
      },
    ),
  );
}

class _LaunchScreen extends StatelessWidget {
  const _LaunchScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _BrandMark(size: 64),
          SizedBox(height: 18),
          Text(
            'NetSentry',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 22),
          SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    ),
  );
}

class BrandMark extends _BrandMark {
  const BrandMark({super.key, super.size});
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({super.key, this.size = 48});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(size * .3),
      boxShadow: const [
        BoxShadow(
          color: Color(0x3380658F),
          blurRadius: 20,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: Icon(Icons.shield_outlined, color: Colors.white, size: size * .55),
  );
}
