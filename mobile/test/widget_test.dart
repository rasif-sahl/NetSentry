import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/core/state/app_state.dart';

void main() {
  testWidgets('shows the NetSentry launch and sign-in experience', (
    WidgetTester tester,
  ) async {
    final state = AppState(booting: false);
    await tester.pumpWidget(NetSentryApp(state: state));
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
