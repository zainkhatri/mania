import Foundation

@MainActor
final class JournalStorage: ObservableObject {
    static let shared = JournalStorage()
    
    @Published private(set) var entries: [JournalEntry] = []
    private let saveKey = "SavedJournals"
    
    private init() {
        loadEntries()
    }
    
    func addEntry(_ entry: JournalEntry) {
        entries.append(entry)
        saveEntries()
    }
    
    func updateEntry(_ entry: JournalEntry) {
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
            saveEntries()
        }
    }
    
    func toggleFavorite(_ entry: JournalEntry) {
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index].isFavorite.toggle()
            saveEntries()
        }
    }
    
    private func loadEntries() {
        guard let data = UserDefaults.standard.data(forKey: saveKey),
              let decoded = try? JSONDecoder().decode([JournalEntry].self, from: data) else {
            return
        }
        entries = decoded
    }
    
    private func saveEntries() {
        guard let encoded = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(encoded, forKey: saveKey)
    }
}
