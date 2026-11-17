package com.netsentry.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LightPalette =
    lightColorScheme(
        primary = Color(0xFF675080),
        onPrimary = Color.White,
        primaryContainer = Color(0xFFE6D9EF),
        onPrimaryContainer = Color(0xFF513769),
        secondary = Color(0xFF74677E),
        onSecondary = Color.White,
        secondaryContainer = Color(0xFFEADFF0),
        onSecondaryContainer = Color(0xFF4F425A),
        background = Color(0xFFFFFBFE),
        onBackground = Color(0xFF292132),
        surface = Color(0xFFFFFBFE),
        onSurface = Color(0xFF292132),
        surfaceVariant = Color(0xFFF0E9F1),
        onSurfaceVariant = Color(0xFF5F526A),
        surfaceContainer = Color(0xFFF3EDF8),
        outline = Color(0xFF8D7D98),
        outlineVariant = Color(0xFFDED2E8),
        error = Color(0xFFAE3957),
        onError = Color.White,
        errorContainer = Color(0xFFFBE5EC),
        onErrorContainer = Color(0xFF722238),
    )
private val DarkPalette =
    darkColorScheme(
        primary = Color(0xFFD5B8EF),
        onPrimary = Color(0xFF392347),
        primaryContainer = Color(0xFF513B65),
        onPrimaryContainer = Color(0xFFF1DFFF),
        secondary = Color(0xFFCEC0D6),
        onSecondary = Color(0xFF352A3D),
        secondaryContainer = Color(0xFF4D4056),
        onSecondaryContainer = Color(0xFFEEDFF5),
        background = Color(0xFF19151F),
        onBackground = Color(0xFFF0E6F4),
        surface = Color(0xFF19151F),
        onSurface = Color(0xFFF0E6F4),
        surfaceVariant = Color(0xFF292231),
        onSurfaceVariant = Color(0xFFD0C1D8),
        surfaceContainer = Color(0xFF302638),
        outline = Color(0xFFA392B0),
        outlineVariant = Color(0xFF51445C),
        error = Color(0xFFFFADC4),
        onError = Color(0xFF63122F),
        errorContainer = Color(0xFF782440),
        onErrorContainer = Color(0xFFFFD9E4),
    )
private val DefaultTypography = Typography()
private val AppTypography =
    DefaultTypography.copy(
        headlineLarge = DefaultTypography.headlineLarge.copy(fontSize = 32.sp, lineHeight = 38.sp),
        headlineMedium =
            DefaultTypography.headlineMedium.copy(fontSize = 24.sp, lineHeight = 30.sp),
        titleLarge = DefaultTypography.titleLarge.copy(fontSize = 22.sp, lineHeight = 28.sp),
        bodyLarge = DefaultTypography.bodyLarge.copy(fontSize = 14.sp, lineHeight = 21.sp),
        bodyMedium = DefaultTypography.bodyMedium.copy(fontSize = 14.sp, lineHeight = 21.sp),
        bodySmall = DefaultTypography.bodySmall.copy(fontSize = 12.sp, lineHeight = 18.sp),
    )

@Composable
internal fun NetSentryTheme(preference: String, content: @Composable () -> Unit) {
    val dark = preference == "DARK" || (preference != "LIGHT" && isSystemInDarkTheme())
    MaterialTheme(
        colorScheme = if (dark) DarkPalette else LightPalette,
        typography = AppTypography,
        shapes =
            Shapes(
                extraSmall = RoundedCornerShape(5.dp),
                small = RoundedCornerShape(8.dp),
                medium = RoundedCornerShape(13.dp),
                large = RoundedCornerShape(20.dp),
                extraLarge = RoundedCornerShape(28.dp),
            ),
        content = content,
    )
}
