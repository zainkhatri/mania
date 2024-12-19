import SwiftUI
import PhotosUI

struct CreateJournalView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var journalStorage = JournalStorage.shared
    @State private var title = ""
    @State private var location = ""
    @State private var content = ""
    @State private var selectedDate = Date()
    @State private var mainImage: UIImage?
    @State private var overlayPhotos: [DraggablePhoto] = []
    @State private var savedCollage: UIImage?
    @State private var isGenerating = false
    @State private var renderedJournal: UIImage?
    @State private var showingPreview = false
    
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d'th', yyyy"
        return formatter
    }()
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header Section
                    JournalHeader(
                        title: $title,
                        location: $location,
                        selectedDate: $selectedDate
                    )
                    
                    // Collage Section
                    GenerateCollage(
                        mainImage: $mainImage,
                        overlayPhotos: $overlayPhotos,
                        savedCollage: $savedCollage
                    )
                    
                    // Journal Content Section
                    JournalTyper(content: $content)
                    
                    // Preview if generated
                    if let renderedJournal = renderedJournal {
                        VStack {
                            Image(uiImage: renderedJournal)
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: UIScreen.main.bounds.width - 40)
                                .padding(.horizontal, 20)
                        }
                        .frame(height: (JournalRenderer.pageHeight / JournalRenderer.pageWidth) * (UIScreen.main.bounds.width - 40))
                    }
                    
                    // Action Buttons
                    VStack(spacing: 12) {
                        Button(action: generateJournal) {
                            Text(isGenerating ? "Regenerate Journal" : "Generate Journal")
                                .font(.custom("Zain-Regular", size: 24))
                                .kerning(-1)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.black)
                                .cornerRadius(12)
                        }
                        .disabled(savedCollage == nil)
                        
                        if isGenerating {
                            Button(action: saveEntry) {
                                Text("Save Entry")
                                    .font(.custom("Zain-Regular", size: 24))
                                    .kerning(-1)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.black)
                                    .cornerRadius(12)
                            }
                            
                            ShareLink(
                                item: Image(uiImage: renderedJournal ?? UIImage()),
                                preview: SharePreview("Journal Entry")
                            ) {
                                Text("Share Entry")
                                    .font(.custom("Zain-Regular", size: 24))
                                    .kerning(-1)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.black)
                                    .cornerRadius(12)
                            }
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("New Entry")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(uiColor: UIColor.systemBackground))
        }
    }
    
    private func saveImages() -> [URL] {
        var urls: [URL] = []
        let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        
        // Save the collage
        if let collage = savedCollage,
           let fileName = ImageSaver.saveImage(collage) {
            urls.append(documentsDirectory.appendingPathComponent(fileName))
        }
        
        return urls
    }
    
    private func generateJournal() {
        let dateString = dateFormatter.string(from: selectedDate)
        renderedJournal = JournalRenderer.renderJournal(
            date: dateString,
            title: title,
            location: location,
            content: content,
            mainImage: savedCollage,
            overlayPhotos: overlayPhotos
        )
        isGenerating = true
    }
    
    private func saveEntry() {
        let imageURLs = saveImages()
        let entry = JournalEntry(
            date: selectedDate,
            title: title,
            content: content,
            imageURLs: imageURLs,
            lastModified: Date(),
            isFavorite: false
        )
        
        journalStorage.addEntry(entry)
        dismiss()
    }
}

struct CreateJournalView_Previews: PreviewProvider {
    static var previews: some View {
        CreateJournalView()
    }
}
