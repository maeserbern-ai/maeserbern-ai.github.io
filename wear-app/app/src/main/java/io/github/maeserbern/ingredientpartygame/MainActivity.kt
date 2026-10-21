package io.github.maeserbern.ingredientpartygame

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.navigation.NavHostController
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import androidx.wear.remote.interactions.RemoteActivityHelper

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val game = GameState(applicationContext, GameData(applicationContext))
        setContent {
            PartyTheme {
                PartyGameApp(game)
            }
        }
    }
}

object Routes {
    const val START = "start"
    const val CLUES = "clues"
    const val GUESS = "guess"
    const val RESULT = "result"
    const val INGREDIENT = "ingredient/{index}"
    const val BOOKS = "books"
    const val BOOK = "book/{id}"
    const val QR = "qr/{id}"

    fun ingredient(index: Int) = "ingredient/$index"
    fun book(id: String) = "book/$id"
    fun qr(id: String) = "qr/$id"
}

/** Swipe right (or press back) to go back a screen, like every Wear OS app. */
@Composable
fun PartyGameApp(game: GameState) {
    val nav = rememberSwipeDismissableNavController()
    SwipeDismissableNavHost(navController = nav, startDestination = Routes.START) {
        composable(Routes.START) {
            StartScreen(
                game = game,
                onPlay = { if (game.nextPuzzle()) nav.navigate(Routes.CLUES) },
                onBooks = { nav.navigate(Routes.BOOKS) },
            )
        }
        composable(Routes.CLUES) {
            CluesScreen(
                game = game,
                onIngredient = { nav.navigate(Routes.ingredient(it)) },
                onGuess = { nav.navigate(Routes.GUESS) },
                onMissing = { nav.home() },
            )
        }
        composable(Routes.GUESS) {
            GuessScreen(
                game = game,
                onAnswered = {
                    nav.navigate(Routes.RESULT) {
                        // Back from the result goes home, not to an answered puzzle.
                        popUpTo(Routes.CLUES) { inclusive = true }
                    }
                },
                onBack = { nav.popBackStack() },
                onMissing = { nav.home() },
            )
        }
        composable(Routes.RESULT) {
            ResultScreen(
                game = game,
                onNext = {
                    if (game.nextPuzzle()) {
                        nav.navigate(Routes.CLUES) { popUpTo(Routes.RESULT) { inclusive = true } }
                    } else {
                        nav.home()
                    }
                },
                onQr = { nav.navigate(Routes.qr(it)) },
                onHome = { nav.home() },
                onMissing = { nav.home() },
            )
        }
        composable(Routes.INGREDIENT) { entry ->
            val index = entry.arguments?.getString("index")?.toIntOrNull() ?: 0
            IngredientScreen(game = game, index = index)
        }
        composable(Routes.BOOKS) {
            BooksScreen(game = game, onBook = { nav.navigate(Routes.book(it)) })
        }
        composable(Routes.BOOK) { entry ->
            val id = entry.arguments?.getString("id") ?: ""
            BookScreen(game = game, id = id, onQr = { nav.navigate(Routes.qr(it)) })
        }
        composable(Routes.QR) { entry ->
            val id = entry.arguments?.getString("id") ?: ""
            QrScreen(game = game, id = id)
        }
    }
}

private fun NavHostController.home() {
    if (!popBackStack(Routes.START, inclusive = false)) navigate(Routes.START)
}

/**
 * Opens a book link in the paired phone's browser. The watch has no browser,
 * so if no phone answers, [onResult] gets false and the QR code is the fallback.
 */
@Composable
fun rememberPhoneOpener(): (String, (Boolean) -> Unit) -> Unit {
    val context = LocalContext.current
    return remember(context) { { url, onResult -> openOnPhone(context, url, onResult) } }
}

private fun openOnPhone(context: Context, url: String, onResult: (Boolean) -> Unit) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)
    val main = ContextCompat.getMainExecutor(context)
    try {
        val future = RemoteActivityHelper(context).startRemoteActivity(intent)
        future.addListener({
            val ok = try {
                future.get()
                true
            } catch (_: Exception) {
                false
            }
            onResult(ok)
        }, main)
    } catch (_: Exception) {
        main.execute { onResult(false) }
    }
}
