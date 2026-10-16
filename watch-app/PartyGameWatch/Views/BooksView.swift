import SwiftUI

struct BooksView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(GameData.books) { book in
                NavigationLink {
                    BookDetailView(book: book)
                } label: {
                    Text(book.name)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityIdentifier("watch-book-\(book.id)")
            }
            .navigationTitle("Books")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done", systemImage: "xmark") { dismiss() }
                        .accessibilityIdentifier("watch-books-done")
                }
            }
        }
        .tint(Theme.gold)
    }
}

private struct BookDetailView: View {
    let book: Book

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text(book.name)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                if let asset = book.coverAsset {
                    Image(asset)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 100, maxHeight: 140)
                        .accessibilityLabel("\(book.name) book cover")
                }

                Link(destination: book.url) {
                    Label(book.id == "all" ? "View series" : "View book", systemImage: "arrow.up.right")
                }
                .buttonStyle(PillButtonStyle())
                .accessibilityIdentifier("watch-book-link-\(book.id)")

                NavigationLink {
                    BookCodeView(book: book)
                } label: {
                    Label("QR code", systemImage: "qrcode")
                }
                .buttonStyle(PillButtonStyle())
                .accessibilityIdentifier("watch-book-qr-\(book.id)")
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Maeser")
    }
}

private struct BookCodeView: View {
    let book: Book

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(book.qrAsset)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 160)
                    .background(.white)
                    .accessibilityLabel("QR link for \(book.name)")
                    .accessibilityIdentifier("watch-book-code-\(book.id)")
                Text(book.name)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .navigationTitle("Book QR code")
    }
}
