import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/api_client.dart';

class AuthRepository {
  AuthRepository({ApiClient? client, FlutterSecureStorage? storage})
    : _client = client ?? ApiClient(),
      _storage = storage ?? const FlutterSecureStorage();

  final ApiClient _client;
  final FlutterSecureStorage _storage;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post('/auth/login', {
      'email': email,
      'password': password,
    });
    await _saveTokens(response);
    return Map<String, dynamic>.from(response['user'] as Map);
  }

  Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password,
  ) async {
    final response = await _client.post('/auth/register', {
      'displayName': name,
      'email': email,
      'password': password,
    });
    await _saveTokens(response);
    return Map<String, dynamic>.from(response['user'] as Map);
  }

  Future<Map<String, dynamic>?> restore() async {
    final accessToken = await _storage.read(key: 'access_token');
    if (accessToken == null) return null;
    try {
      return await _client.get('/auth/me', accessToken: accessToken);
    } on ApiException catch (error) {
      if (error.statusCode != 401) rethrow;
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) return null;
      try {
        final refreshed = await _client.post('/auth/refresh', {
          'refreshToken': refreshToken,
        });
        await _saveTokens(refreshed);
        return Map<String, dynamic>.from(refreshed['user'] as Map);
      } catch (_) {
        await clear();
        return null;
      }
    }
  }

  Future<void> logout() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      try {
        await _client.post('/auth/logout', const {}, accessToken: token);
      } catch (_) {
        // Local credentials must still be removed when offline.
      }
    }
    await clear();
  }

  Future<void> clear() => _storage.deleteAll();

  Future<void> _saveTokens(Map<String, dynamic> response) async {
    await _storage.write(
      key: 'access_token',
      value: response['accessToken'] as String,
    );
    await _storage.write(
      key: 'refresh_token',
      value: response['refreshToken'] as String,
    );
  }
}
