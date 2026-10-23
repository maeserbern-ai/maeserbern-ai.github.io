import SwiftUI

@main
struct PartyGameWatchApp: App {
    @StateObject private var game = GameState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(game)
        }
    }
}

/// Switches between the four screens of a round.
struct RootView: View {
    @EnvironmentObject private var game: GameState

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            switch game.screen {
            case .start:
                StartView()
            case .clues:
                CluesView()
            case .guess:
                GuessView()
            case .result:
                ResultView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: game.screen)
    }
}
