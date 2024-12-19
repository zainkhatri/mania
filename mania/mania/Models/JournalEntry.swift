// Models/JournalEntry.swift
import Foundation

struct JournalEntry: Identifiable, Codable {
    var id: UUID
    var date: Date
    var title: String
    var content: String
    var imageURLs: [URL]
    var lastModified: Date
    var isFavorite: Bool
    
    init(id: UUID = UUID(),
         date: Date = Date(),
         title: String = "",
         content: String = "",
         imageURLs: [URL] = [],
         lastModified: Date = Date(),
         isFavorite: Bool = false) {
        self.id = id
        self.date = date
        self.title = title
        self.content = content
        self.imageURLs = imageURLs
        self.lastModified = lastModified
        self.isFavorite = isFavorite
    }
}
