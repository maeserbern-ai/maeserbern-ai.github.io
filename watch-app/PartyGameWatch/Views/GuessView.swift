import SwiftUI

/// Screen 2: pick one of the puzzle's four options.
struct GuessView: View {
    @EnvironmentObject private var game: GameState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("What is it?")
                    .font(.system(.title3, design: .serif, weight: .bold))
                    .foregroundStyle(Theme.ink)

                ForEach(game.options, id: \.self) { option in
                    Button(option) {
                        game.guess(option)
                    }
                    .buttonStyle(PillButtonStyle(fill: Theme.button, text: Theme.ink, ringOnPress: true))
                }

                Button {
                    game.backToClues()
                } label: {
                    Text("Back to clues")
                        .font(.footnote)
                        .foregroundStyle(Theme.soft)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 2)
        }
    }
}
