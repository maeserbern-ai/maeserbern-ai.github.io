import SwiftUI

/// Screen 1: read the ingredient label, reveal more, or go guess.
struct CluesView: View {
    @EnvironmentObject private var game: GameState
    @State private var lookup: IngredientLookup?

    var body: some View {
        if let puzzle = game.puzzle {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        header
                        labelCard(for: puzzle)
                        controls
                        Text("Tap an ingredient to learn what it is")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.soft)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, 2)
                }
                .onChange(of: game.shown) { _, newValue in
                    // Keep the newly revealed ingredient in view.
                    withAnimation {
                        proxy.scrollTo(newValue - 1, anchor: .center)
                    }
                }
            }
            .sheet(item: $lookup) { item in
                IngredientSheet(name: item.name)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("Snack or Shampoo?")
                .font(.system(.headline, design: .serif, weight: .bold))
                .foregroundStyle(Theme.terracotta)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Spacer(minLength: 2)
            Text(game.currentPoints == 1 ? "1 pt" : "\(game.currentPoints) pts")
                .font(.system(.footnote, weight: .bold))
                .foregroundStyle(Theme.gold)
                .fixedSize()
        }
    }

    private func labelCard(for puzzle: Puzzle) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("INGREDIENTS")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.labelInk.opacity(0.85))

            ForEach(Array(puzzle.ingredients.prefix(game.shown).enumerated()), id: \.offset) { index, name in
                Button {
                    lookup = IngredientLookup(name: name)
                } label: {
                    Text(name)
                        .font(.system(.body, weight: .semibold))
                        .foregroundStyle(GameData.warning(for: name) != nil ? Theme.warn : Theme.labelInk)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("watch-ingredient-\(index)")
                .id(index)
            }

            if game.canRevealMore {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Theme.hidden)
                    .frame(width: 90, height: 14)
                    .padding(.top, 2)
                    .accessibilityLabel("More ingredients hidden")
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.label))
    }

    private var controls: some View {
        HStack(spacing: 6) {
            Button("More") {
                game.revealMore()
            }
            .buttonStyle(PillButtonStyle(fill: Theme.button, text: Theme.ink))
            .accessibilityIdentifier("watch-more")
            .disabled(!game.canRevealMore)

            Button("Guess") {
                game.goToGuess()
            }
            .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))
            .accessibilityIdentifier("watch-guess")
        }
    }
}

/// Identifies the ingredient whose explanation sheet is open.
struct IngredientLookup: Identifiable {
    let id = UUID()
    let name: String
}

/// Plain-words explanation of one ingredient, from the glossary.
struct IngredientSheet: View {
    let name: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(name)
                    .font(.system(.headline, design: .serif, weight: .bold))
                    .foregroundStyle(Theme.terracotta)
                    .fixedSize(horizontal: false, vertical: true)

                Text(GameData.explanation(for: name))
                    .font(.body)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if let tag = GameData.warning(for: name) {
                    tagView(tag, color: Theme.bad)
                } else if let tag = GameData.undisclosedNote(for: name) {
                    tagView(tag, color: Theme.gold)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func tagView(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(.footnote, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().strokeBorder(color.opacity(0.6), lineWidth: 1.5))
    }
}
