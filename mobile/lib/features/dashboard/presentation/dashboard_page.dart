import 'package:flutter/material.dart';

import '../../../core/state/app_state.dart';
import '../../../theme/app_colors.dart';
import '../../capabilities/data/capability_service.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.state});
  final AppState state;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final capabilityService = CapabilityService();
  late Future<DeviceCapabilities> capabilities = capabilityService.inspect();
  int selectedIndex = 0;
  bool scanning = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      automaticallyImplyLeading: false,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      title: const Row(
        children: [
          _SmallBrandMark(),
          SizedBox(width: 10),
          Text('NetSentry', style: TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Notifications',
          onPressed: () {},
          icon: const Badge(
            smallSize: 7,
            child: Icon(Icons.notifications_none_rounded),
          ),
        ),
        const SizedBox(width: 8),
      ],
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1),
        child: Divider(height: 1, color: AppColors.border),
      ),
    ),
    body: IndexedStack(
      index: selectedIndex,
      children: [
        _overview(),
        const _PlaceholderPage(
          icon: Icons.devices_other_outlined,
          title: 'Registered devices',
          message: 'Linked phones, computers, routers, and gateways will appear here.',
        ),
        const _PlaceholderPage(
          icon: Icons.shield_outlined,
          title: 'Security center',
          message:
              'Verified alerts and network health events will appear here.',
        ),
        _settings(),
      ],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: selectedIndex,
      onDestinationSelected: (index) => setState(() => selectedIndex = index),
      backgroundColor: AppColors.surface,
      indicatorColor: AppColors.lavender,
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Overview',
        ),
        NavigationDestination(
          icon: Icon(Icons.devices_outlined),
          selectedIcon: Icon(Icons.devices),
          label: 'Devices',
        ),
        NavigationDestination(
          icon: Icon(Icons.shield_outlined),
          selectedIcon: Icon(Icons.shield),
          label: 'Security',
        ),
        NavigationDestination(
          icon: Icon(Icons.settings_outlined),
          selectedIcon: Icon(Icons.settings),
          label: 'Settings',
        ),
      ],
    ),
  );

  Widget _overview() => RefreshIndicator(
    color: AppColors.primary,
    onRefresh: _refreshCapabilities,
    child: LayoutBuilder(
      builder: (context, constraints) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(
          horizontal: constraints.maxWidth >= 720 ? 32 : 16,
          vertical: 20,
        ),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 980),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _welcomeHeader(),
                  const SizedBox(height: 18),
                  FutureBuilder<DeviceCapabilities>(
                    future: capabilities,
                    builder: (context, snapshot) => _capabilityCard(snapshot),
                  ),
                  const SizedBox(height: 16),
                  _summaryGrid(constraints.maxWidth),
                  const SizedBox(height: 16),
                  _gettingStartedCard(),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _welcomeHeader() => Row(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PERSONAL NETWORK',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Hello, ${widget.state.user?['displayName'] ?? 'there'}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 5),
            Text(
              'Let’s check what this device can monitor.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      FilledButton.icon(
        onPressed: scanning ? null : _refreshCapabilities,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        icon: scanning
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.radar_rounded, size: 19),
        label: Text(scanning ? 'Checking' : 'Check'),
      ),
    ],
  );

  Widget _capabilityCard(AsyncSnapshot<DeviceCapabilities> snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ),
      );
    }
    final report = snapshot.data;
    if (report == null) {
      return const _NoticeCard(
        icon: Icons.error_outline,
        color: AppColors.danger,
        background: AppColors.dangerSurface,
        title: 'Capability check unavailable',
        message: 'Pull down to try the device check again.',
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const _IconTile(
                  icon: Icons.phone_android_rounded,
                  color: AppColors.primary,
                  background: AppColors.lavender,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.deviceName,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        report.platform,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const _StatusPill(
                  label: 'Detected',
                  color: AppColors.success,
                  background: AppColors.successSurface,
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 12),
            _CapabilityRow(
              label: 'Native device connection',
              available: true,
              detail: 'Ready',
            ),
            _CapabilityRow(
              label: 'App usage permission',
              available: report.usageAccessGranted,
              detail: report.usageAccessGranted
                  ? 'Allowed'
                  : 'Permission required',
            ),
            _CapabilityRow(
              label: 'Hotspot client list',
              available: report.hotspotClientListAvailable,
              detail: report.hotspotClientListAvailable
                  ? 'Available'
                  : 'Restricted by Android',
            ),
            _CapabilityRow(
              label: 'Per-client tethering traffic',
              available: report.tetheringTrafficAvailable,
              detail: report.tetheringTrafficAvailable
                  ? 'Available'
                  : 'Requires supported hardware',
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryGrid(double width) {
    final columns = width >= 720 ? 3 : 1;
    const cards = [
      _SummaryCard(
        icon: Icons.devices_outlined,
        value: '1',
        label: 'Registered device',
        note: 'This phone',
        tone: AppColors.primary,
        surface: AppColors.lavender,
      ),
      _SummaryCard(
        icon: Icons.shield_outlined,
        value: 'Setup',
        label: 'Protection status',
        note: 'Capability check active',
        tone: AppColors.success,
        surface: AppColors.successSurface,
      ),
      _SummaryCard(
        icon: Icons.data_usage_rounded,
        value: '—',
        label: 'Usage measured',
        note: 'Waiting for verified data',
        tone: AppColors.secondary,
        surface: AppColors.rose,
      ),
    ];
    return GridView.count(
      crossAxisCount: columns,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: columns == 1 ? 3.15 : 1.35,
      children: cards,
    );
  }

  Widget _gettingStartedCard() => const _NoticeCard(
    icon: Icons.info_outline_rounded,
    color: AppColors.primary,
    background: AppColors.lavender,
    title: 'Capability-first monitoring',
    message: 'NetSentry only enables measurements verified on this device. Restricted hotspot features stay clearly labelled instead of showing estimated data.',
  );

  Widget _settings() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Text('Settings', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 16),
      Card(
        child: Column(
          children: [
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: AppColors.lavender,
                foregroundColor: AppColors.primary,
                child: Icon(Icons.person_outline),
              ),
              title: Text(
                widget.state.user?['displayName']?.toString() ??
                    'NetSentry user',
              ),
              subtitle: Text(widget.state.user?['email']?.toString() ?? ''),
            ),
            const Divider(height: 1, color: AppColors.border),
            ListTile(
              leading: const Icon(
                Icons.logout_rounded,
                color: AppColors.danger,
              ),
              title: const Text('Sign out'),
              onTap: widget.state.busy ? null : widget.state.logout,
            ),
          ],
        ),
      ),
    ],
  );

  Future<void> _refreshCapabilities() async {
    setState(() {
      scanning = true;
      capabilities = capabilityService.inspect();
    });
    await capabilities;
    if (mounted) setState(() => scanning = false);
  }
}

class _CapabilityRow extends StatelessWidget {
  const _CapabilityRow({
    required this.label,
    required this.available,
    required this.detail,
  });
  final String label;
  final bool available;
  final String detail;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Icon(
          available ? Icons.check_circle_outline : Icons.info_outline,
          size: 18,
          color: available ? AppColors.success : AppColors.warning,
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ),
        Text(
          detail,
          textAlign: TextAlign.right,
          style: TextStyle(
            fontSize: 11,
            color: available ? AppColors.success : AppColors.warning,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.note,
    required this.tone,
    required this.surface,
  });
  final IconData icon;
  final String value;
  final String label;
  final String note;
  final Color tone;
  final Color surface;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(15),
      child: Row(
        children: [
          _IconTile(icon: icon, color: tone, background: surface),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  note,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.icon,
    required this.color,
    required this.background,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final Color color;
  final Color background;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(fontWeight: FontWeight.w700, color: color),
              ),
              const SizedBox(height: 4),
              Text(
                message,
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.5,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _IconTile extends StatelessWidget {
  const _IconTile({
    required this.icon,
    required this.color,
    required this.background,
  });
  final IconData icon;
  final Color color;
  final Color background;
  @override
  Widget build(BuildContext context) => Container(
    width: 42,
    height: 42,
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(icon, color: color, size: 21),
  );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.color,
    required this.background,
  });
  final String label;
  final Color color;
  final Color background;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10),
    ),
  );
}

class _SmallBrandMark extends StatelessWidget {
  const _SmallBrandMark();
  @override
  Widget build(BuildContext context) => Container(
    width: 36,
    height: 36,
    decoration: BoxDecoration(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(11),
    ),
    child: const Icon(Icons.shield_outlined, color: Colors.white, size: 21),
  );
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.lavender,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, color: AppColors.primary, size: 30),
          ),
          const SizedBox(height: 18),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ),
  );
}
