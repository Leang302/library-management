import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api.dart';
import '../../core/models/cart.dart';
import '../../core/theme.dart';
import '../../core/utils/format.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Digital membership card with the `LMS-MEM:` QR.
class MemberCardScreen extends StatefulWidget {
  const MemberCardScreen({super.key});

  @override
  State<MemberCardScreen> createState() => _MemberCardScreenState();
}

class _MemberCardScreenState extends State<MemberCardScreen> with Loader<MemberCardScreen, MemberCard> {
  late final StudentService _student = context.studentApi;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Future<MemberCard> fetch() => _student.memberCard();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Membership card')),
      body: buildLoaded((card) {
        final m = card.member;
        final valid = m.canBorrow;
        final statusText = valid ? 'Active' : (m.isSuspended ? 'Suspended' : 'Expired');
        return RefreshIndicator(
          onRefresh: load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: valid ? const [AppColors.primary, AppColors.primaryPress] : const [Color(0xFF6A706C), Color(0xFF484D4A)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.local_library_rounded, color: Colors.white),
                        SizedBox(width: 8),
                        Text('Greenleaf Library · Library Card', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text('Member name', style: TextStyle(color: Colors.white.withAlpha(190), fontSize: 12)),
                    Text(m.name, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                    Text(m.year == null ? m.program : '${m.program} · Year ${m.year}',
                        style: TextStyle(color: Colors.white.withAlpha(220))),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _CardField(label: 'Student ID', value: m.studentId),
                        _CardField(label: 'Status', value: statusText),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _CardField(label: 'Member since', value: Fmt.monthYear(m.joinedAt)),
                        _CardField(label: 'Expires', value: Fmt.date(m.expiresAt)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: QrImageView(data: card.qrPayload, size: 200, backgroundColor: Colors.white),
                ),
              ),
              const SizedBox(height: 8),
              const Text('Membership token · rotates if your card is reported lost',
                  textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 12)),
              const SizedBox(height: 14),
              const Text('Show this card at the library counter to identify yourself.',
                  textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
              if (!valid) ...[
                const SizedBox(height: 16),
                const ToneBanner(
                  tone: Tone.red,
                  icon: Icons.error_outline,
                  title: 'Membership inactive',
                  subtitle: 'You can’t borrow books until your membership is renewed. Please visit the library desk.',
                ),
              ],
            ],
          ),
        );
      }),
    );
  }
}

class _CardField extends StatelessWidget {
  const _CardField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.white.withAlpha(190), fontSize: 12)),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
