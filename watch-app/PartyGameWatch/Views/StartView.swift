import SwiftUI

struct StartView: View {
    @EnvironmentObject private var game: GameState
    @State private var showingBooks = false
    @State private var showingPicker = false

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                // Same title as the website: "Ingredient Dictionary" over "The Party Game".
                VStack(spacing: 0) {
                    Text("Ingredient Dictionary")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.gold)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("The Party Game")
                        .font(.system(.title3, design: .serif, weight: .bold))
                        .foregroundStyle(Theme.terracotta)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)

                Text("Snack or Shampoo?")
                    .font(.system(.footnote, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text("From the book series by Maeser")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.soft)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Play") {
                    game.play()
                }
                .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))
                .accessibilityIdentifier("watch-play")
                .disabled(!game.hasPuzzles)

                Button {
                    showingPicker = true
                } label: {
                    VStack(spacing: 0) {
                        Text("Book")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.soft)
                        Text(game.selectedBookName)
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                    }
                }
                .buttonStyle(PillButtonStyle())
                .accessibilityLabel("Book: \(game.selectedBookName)")
                .accessibilityIdentifier("watch-book-picker")

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
        .sheet(isPresented: $showingPicker) {
            BookPickerView()
                .environmentObject(game)
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

/// Pick which book to play, like the web game's book picker: Mix all books or one book.
/// Each book keeps its own no-repeat list (see GameState.drawFromDeck).
struct BookPickerView: View {
    @EnvironmentObject private var game: GameState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                row(id: "all", name: "Mix all books", count: GameData.pool(for: "all").count,
                    unit: "puzzles", cover: nil)
                ForEach(GameData.pickableBooks) { book in
                    let pool = GameData.pool(for: book.id)
                    row(id: book.id, name: book.name, count: pool.count,
                        unit: pool.first?.isTrueFalse == true ? "true or false" : "puzzles",
                        cover: book.coverAsset)
                }
            }
            .navigationTitle("Pick your book")
        }
        .tint(Theme.gold)
    }

    private func row(id: String, name: String, count: Int, unit: String, cover: String?) -> some View {
        Button {
            game.selectBook(id)
            dismiss()
        } label: {
            HStack(spacing: 8) {
                if let cover {
                    Image(cover)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 24, height: 36)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                } else {
                    Image(systemName: "shuffle")
                        .frame(width: 24, height: 36)
                        .foregroundStyle(Theme.gold)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(name)
                        .font(.system(.body, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(count) \(unit)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.soft)
                }
                Spacer(minLength: 0)
                if game.selectedBook == id {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Theme.gold)
                }
            }
        }
        .accessibilityLabel(name)
        .accessibilityAddTraits(game.selectedBook == id ? .isSelected : [])
        .accessibilityIdentifier("watch-pick-\(id)")
    }
}
