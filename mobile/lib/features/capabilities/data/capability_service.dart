import 'package:flutter/services.dart';

class DeviceCapabilities {
  const DeviceCapabilities({
    required this.platform,
    required this.deviceName,
    required this.usageAccessGranted,
    required this.hotspotClientListAvailable,
    required this.tetheringTrafficAvailable,
  });

  final String platform;
  final String deviceName;
  final bool usageAccessGranted;
  final bool hotspotClientListAvailable;
  final bool tetheringTrafficAvailable;
}

class CapabilityService {
  static const _channel = MethodChannel('netsentry/capabilities');

  Future<DeviceCapabilities> inspect() async {
    try {
      final result = await _channel.invokeMapMethod<String, dynamic>('inspect');
      return DeviceCapabilities(
        platform: result?['platform']?.toString() ?? 'Unknown',
        deviceName: result?['deviceName']?.toString() ?? 'This device',
        usageAccessGranted: result?['usageAccessGranted'] == true,
        hotspotClientListAvailable:
            result?['hotspotClientListAvailable'] == true,
        tetheringTrafficAvailable: result?['tetheringTrafficAvailable'] == true,
      );
    } on MissingPluginException {
      return const DeviceCapabilities(
        platform: 'Unsupported platform',
        deviceName: 'This device',
        usageAccessGranted: false,
        hotspotClientListAvailable: false,
        tetheringTrafficAvailable: false,
      );
    }
  }
}
