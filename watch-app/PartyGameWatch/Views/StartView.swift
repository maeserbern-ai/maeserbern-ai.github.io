import SwiftUI

struct StartView: View {
    @EnvironmentObject private var game: GameState
    @State private var showingBooks = false

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Snack or Shampoo?")
                    .font(.system(.title3, design: .serif, weight: .bold))
                    .foregroundStyle(Theme.terracotta)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.7)

                Text("From the Ingredient Dictionary books by Maeser")
                    .font(.footnote)
                    .foregroundStyle(Theme.soft)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Play") {
                    game.play()
                }
                .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))
                .accessibilityIdentifier("watch-play")
                .disabled(!game.hasPuzzles)

                HStack(spacing: 6) {
                    stat("Total score", value: game.totalScore)
                    stat("Best streak", value: game.bestStreak)
                }

                Button {
                    showingBooks = true
                } label: {
                    Label("Books", systemImage: "books.vertical")
                }
                .buttonStyle(PillButtonStyle())
                .accessibilityIdentifier("watch-books")
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 4)
        }
        .sheet(isPresented: $showingBooks) {
            BooksView()
        }
    }

    private func stat(_ title: String, value: Int) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(.title3, weight: .bold))
                .foregroundStyle(Theme.gold)
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(Theme.soft)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.card))
    }
}
