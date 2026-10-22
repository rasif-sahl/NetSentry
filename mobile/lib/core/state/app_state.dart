import 'package:flutter/foundation.dart';

import '../../features/auth/data/auth_repository.dart';

class AppState extends ChangeNotifier {
  AppState({AuthRepository? auth, this.booting = true, this.user})
    : _auth = auth ?? AuthRepository();

  final AuthRepository _auth;
  bool booting;
  bool busy = false;
  Map<String, dynamic>? user;
  String? error;

  Future<void> hydrate() async {
    try {
      user = await _auth.restore();
    } catch (_) {
      error = 'We could not reach NetSentry. Check the API connection.';
    } finally {
      booting = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) =>
      _perform(() => _auth.login(email, password));

  Future<bool> register(String name, String email, String password) =>
      _perform(() => _auth.register(name, email, password));

  Future<bool> _perform(
    Future<Map<String, dynamic>> Function() operation,
  ) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      user = await operation();
      return true;
    } catch (reason) {
      error = reason.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    busy = true;
    notifyListeners();
    await _auth.logout();
    user = null;
    busy = false;
    notifyListeners();
  }
}
