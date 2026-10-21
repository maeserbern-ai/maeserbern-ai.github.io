package io.github.maeserbern.ingredientpartygame

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Colors

/** Colours from the approved watch mockup (same as the Apple Watch app). */
object Palette {
    val bg = Color(0xFF16211C)
    val ink = Color(0xFFF4F3EE)
    val soft = Color(0xFFC9CDC6)
    val terracotta = Color(0xFFE07A55)
    val gold = Color(0xFFF2C46B)
    val good = Color(0xFF5FBF8A)
    val bad = Color(0xFFE06A5F)

    /** The cream ingredient label and its dark text. */
    val label = Color(0xFFF4F3EE)
    val labelInk = Color(0xFF1A1C1E)
    /** Ingredients on the watch list are printed in this red on the label. */
    val warn = Color(0xFFB42318)
    /** Placeholder bar for the next hidden ingredient. */
    val hidden = Color(0xFFDAD6CC)

    /** Dark green fill for secondary buttons and cards. */
    val button = Color(0xFF263830)
    val card = Color(0xFF1F2D27)
}

/** Serif for titles (the web game uses Fraunces; the watch uses the system serif). */
val Serif = FontFamily.Serif

@Composable
fun PartyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = Colors(
            primary = Palette.terracotta,
            onPrimary = Palette.labelInk,
            secondary = Palette.gold,
            background = Palette.bg,
            onBackground = Palette.ink,
            surface = Palette.card,
            onSurface = Palette.ink,
        ),
        content = content,
    )
}

/**
 * One screen: time at the top, a rotary/bezel-scrollable list with a scroll
 * indicator, padded so nothing is clipped on round or square watches.
 */
@Composable
fun WatchScreen(content: ScalingLazyListScope.() -> Unit) {
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)
    val config = LocalConfiguration.current
    val round = config.isScreenRound
    val side = if (round) (config.screenWidthDp * 0.07f).dp else 8.dp
    Scaffold(
        modifier = Modifier.fillMaxSize().background(Palette.bg),
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
    ) {
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
            contentPadding = PaddingValues(
                start = side,
                end = side,
                top = if (round) 30.dp else 24.dp,
                bottom = if (round) 44.dp else 16.dp,
            ),
            anchorType = ScalingLazyListAnchorType.ItemStart,
            autoCentering = null,
            content = content,
        )
    }
}

/** Large rounded button used everywhere in the app. */
@Composable
fun PillButton(
    text: String,
    modifier: Modifier = Modifier,
    fill: Color = Palette.button,
    textColor: Color = Palette.ink,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(shape)
            .background(fill)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = textColor,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Small outlined tag ("Synthetic dye"). */
@Composable
fun Tag(text: String, color: Color) {
    Text(
        text = text,
        color = color,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .border(1.5.dp, color.copy(alpha = 0.6f), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/** Quiet text link (Back to clues, Home). */
@Composable
fun TextLink(text: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 36.dp)
            .clip(RoundedCornerShape(50))
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, color = Palette.soft, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}
