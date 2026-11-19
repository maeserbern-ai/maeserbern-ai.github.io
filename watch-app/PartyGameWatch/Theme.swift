import SwiftUI

extension Color {
    /// Creates a colour from a 0xRRGGBB value.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// Colours from the approved watch mockup.
enum Theme {
    static let bg = Color(hex: 0x16211C)
    static let ink = Color(hex: 0xF4F3EE)
    static let soft = Color(hex: 0xC9CDC6)
    static let terracotta = Color(hex: 0xE07A55)
    static let gold = Color(hex: 0xF2C46B)
    static let good = Color(hex: 0x5FBF8A)
    static let bad = Color(hex: 0xE06A5F)

    /// The cream ingredient label and its dark text.
    static let label = Color(hex: 0xF4F3EE)
    static let labelInk = Color(hex: 0x1A1C1E)
    /// Ingredients on the watch list are printed in this red on the label.
    static let warn = Color(hex: 0xB42318)
    /// Placeholder bar for the next hidden ingredient.
    static let hidden = Color(hex: 0xDAD6CC)

    /// Dark green fill for secondary buttons and cards.
    static let button = Color(hex: 0x263830)
    static let card = Color(hex: 0x1F2D27)
}

/// Large rounded button used everywhere in the app.
struct PillButtonStyle: ButtonStyle {
    var fill: Color
    var text: Color
    /// Draws the gold focus ring while the button is held.
    var ringOnPress: Bool

    @Environment(\.isEnabled) private var isEnabled

    init(fill: Color = Theme.button, text: Color = Theme.ink, ringOnPress: Bool = false) {
        self.fill = fill
        self.text = text
        self.ringOnPress = ringOnPress
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.body, weight: .semibold))
            .foregroundStyle(text)
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.75)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(Capsule().fill(fill))
            .overlay(
                Capsule().strokeBorder(Theme.gold, lineWidth: ringOnPress && configuration.isPressed ? 3 : 0)
            )
            .contentShape(Capsule())
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
