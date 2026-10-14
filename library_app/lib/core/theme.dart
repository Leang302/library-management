import 'package:flutter/material.dart';

/// Greenleaf Library palette (copied from the prototype's `:root` tokens).
class AppColors {
  AppColors._();

  static const brand = Color(0xFF65B874);
  static const primary = Color(0xFF3D8B4D);
  static const primaryPress = Color(0xFF2E6B3A);
  static const primaryText = Color(0xFF2F7440);
  static const primary50 = Color(0xFFF0F7F1);
  static const primary100 = Color(0xFFDCEEDF);

  static const text = Color(0xFF1C1F1D);
  static const text2 = Color(0xFF484D4A);
  static const muted = Color(0xFF6A706C);
  static const faint = Color(0xFF9BA09D);

  static const bg = Color(0xFFFFFFFF);
  static const bgSubtle = Color(0xFFF6F7F6);
  static const bgMuted = Color(0xFFEEF0EE);
  static const border = Color(0xFFE6E8E6);
  static const borderStrong = Color(0xFFD3D7D4);

  static const red = Color(0xFFCC3D3D);
  static const red50 = Color(0xFFFDF1F1);
  static const amber = Color(0xFFA86A12);
  static const amber50 = Color(0xFFFDF6EA);
  static const amberDot = Color(0xFFE9A23B);
  static const blue = Color(0xFF3466C4);
  static const blue50 = Color(0xFFEFF4FC);
  static const purple = Color(0xFF6E54C2);
  static const purple50 = Color(0xFFF4F1FC);
}

/// Semantic colour tones used by chips, banners and stat tiles.
enum Tone { green, amber, red, blue, gray, purple }

extension ToneColors on Tone {
  Color get fg {
    switch (this) {
      case Tone.green:
        return AppColors.primaryText;
      case Tone.amber:
        return AppColors.amber;
      case Tone.red:
        return AppColors.red;
      case Tone.blue:
        return AppColors.blue;
      case Tone.purple:
        return AppColors.purple;
      case Tone.gray:
        return AppColors.muted;
    }
  }

  Color get bg {
    switch (this) {
      case Tone.green:
        return AppColors.primary50;
      case Tone.amber:
        return AppColors.amber50;
      case Tone.red:
        return AppColors.red50;
      case Tone.blue:
        return AppColors.blue50;
      case Tone.purple:
        return AppColors.purple50;
      case Tone.gray:
        return AppColors.bgMuted;
    }
  }
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.brand,
    primary: AppColors.primary,
    error: AppColors.red,
    surface: AppColors.bg,
  );
  final radius = BorderRadius.circular(10);
  OutlineInputBorder outline(Color c, [double w = 1]) =>
      OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    dividerColor: AppColors.border,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.text,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.text),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgSubtle,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: outline(AppColors.border),
      enabledBorder: outline(AppColors.border),
      focusedBorder: outline(AppColors.primary, 1.5),
      errorBorder: outline(AppColors.red),
      focusedErrorBorder: outline(AppColors.red, 1.5),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        foregroundColor: AppColors.text,
        side: const BorderSide(color: AppColors.borderStrong),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
