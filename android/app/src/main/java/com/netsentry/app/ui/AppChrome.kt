package com.netsentry.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// Small code-native icons keep the dock consistent with the design without bitmap assets.
private fun dockIcon(
    name: String,
    draw: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit,
): ImageVector =
    ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        .apply {
            path(
                fill = null,
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 1.7f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                pathFillType = PathFillType.NonZero,
                pathBuilder = draw,
            )
        }
        .build()

private val UsageIcon =
    dockIcon("Usage") {
        moveTo(4f, 4f)
        lineTo(4f, 20f)
        lineTo(21f, 20f)
        moveTo(8f, 16f)
        lineTo(8f, 11f)
        moveTo(13f, 16f)
        lineTo(13f, 6f)
        moveTo(18f, 16f)
        lineTo(18f, 9f)
    }
private val ComputerIcon =
    dockIcon("Computers") {
        moveTo(3f, 4f)
        lineTo(21f, 4f)
        lineTo(21f, 17f)
        lineTo(3f, 17f)
        close()
        moveTo(12f, 17f)
        lineTo(12f, 21f)
        moveTo(7f, 21f)
        lineTo(17f, 21f)
    }
private val FamilyIcon =
    dockIcon("Family") {
        moveTo(9f, 4f)
        curveTo(5f, 4f, 5f, 10f, 9f, 10f)
        curveTo(13f, 10f, 13f, 4f, 9f, 4f)
        moveTo(3f, 20f)
        lineTo(3f, 17f)
        curveTo(3f, 10f, 15f, 10f, 15f, 17f)
        lineTo(15f, 20f)
        moveTo(16f, 4f)
        curveTo(20f, 4f, 20f, 10f, 16f, 10f)
        moveTo(18f, 13f)
        curveTo(21f, 14f, 21f, 16f, 21f, 20f)
    }
private val MoreIcon =
    dockIcon("More") {
        moveTo(4f, 12f)
        lineTo(5f, 12f)
        moveTo(11.5f, 12f)
        lineTo(12.5f, 12f)
        moveTo(19f, 12f)
        lineTo(20f, 12f)
    }

@Composable
internal fun FloatingNavigation(selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        mobileDestinations.keys.forEach { label ->
            val active = selected == label
            val color =
                if (active) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            Column(
                Modifier.weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        if (active) MaterialTheme.colorScheme.primaryContainer
                        else Color.Transparent
                    )
                    .selectable(selected = active, role = Role.Tab, onClick = { onSelect(label) })
                    .heightIn(min = 56.dp)
                    .padding(horizontal = 2.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                val icon =
                    when (label) {
                        "Home" -> Icons.Default.Home
                        "Usage" -> UsageIcon
                        "Family" -> FamilyIcon
                        "Computers" -> ComputerIcon
                        else -> MoreIcon
                    }
                Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = color)
                Text(
                    label,
                    color = color,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
internal fun ScreenHeader(
    title: String,
    workspace: String?,
    backLabel: String?,
    onBack: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (backLabel != null)
            TextButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Text("Back to $backLabel", Modifier.padding(start = 8.dp))
            }
        Text(
            title,
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.semantics { heading() },
        )
        if (!workspace.isNullOrBlank())
            Text(
                workspace,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
    }
}

@Composable
internal fun NavigationCard(label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(13.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.heightIn(min = 56.dp).padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                label,
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.bodyLarge,
            )
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
internal fun StatusNotice(message: String) {
    Surface(
        shape = RoundedCornerShape(13.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Text(
            message,
            Modifier.padding(14.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
