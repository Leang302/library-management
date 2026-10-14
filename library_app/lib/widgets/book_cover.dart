import 'package:flutter/material.dart';

import '../core/utils/format.dart';

/// Coloured placeholder cover with the title's initials (no images in the API).
class BookCover extends StatelessWidget {
  const BookCover({super.key, required this.title, this.author, this.width = 56, this.height = 80});

  const BookCover.small({super.key, required this.title, this.author})
      : width = 40,
        height = 56;

  const BookCover.large({super.key, required this.title, this.author})
      : width = 120,
        height = 172;

  final String title;
  final String? author;
  final double width;
  final double height;

  static const List<Color> _palette = [
    Color(0xFF3D8B4D),
    Color(0xFF3466C4),
    Color(0xFF6E54C2),
    Color(0xFFA86A12),
    Color(0xFFCC3D3D),
    Color(0xFF2F7C8A),
    Color(0xFF8A4F7D),
    Color(0xFF5B6B2F),
  ];

  static Color colorFor(String title) {
    var h = 0;
    for (final c in title.codeUnits) {
      h = (h * 31 + c) & 0x7fffffff;
    }
    return _palette[h % _palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final c = colorFor(title);
    final big = width >= 90;
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(big ? 8 : 5),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [c, Color.lerp(c, Colors.black, 0.25) ?? c],
        ),
        boxShadow: big
            ? const [BoxShadow(color: Color(0x33000000), blurRadius: 16, offset: Offset(0, 6))]
            : const [BoxShadow(color: Color(0x1F000000), blurRadius: 3, offset: Offset(0, 1))],
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Container(width: big ? 8 : 4, color: Colors.black.withAlpha(30)),
          ),
          Center(
            child: Text(
              Fmt.initials(title),
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: big ? 34 : (width >= 50 ? 18 : 14),
                letterSpacing: 1,
              ),
            ),
          ),
          if (big && author != null)
            Positioned(
              left: 14,
              right: 8,
              bottom: 10,
              child: Text(
                author!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white.withAlpha(210), fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }
}
