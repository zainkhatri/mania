import SwiftUI
import PhotosUI

struct DraggablePhoto: Identifiable {
    let id = UUID()
    var image: UIImage
    var offset: CGSize = .zero
    var position: CGPoint = .zero
    var scale: CGFloat = 1.0
    var isSelected: Bool = false
}

struct GenerateCollage: View {
    @Binding var mainImage: UIImage?
    @Binding var overlayPhotos: [DraggablePhoto]
    @Binding var savedCollage: UIImage?
    @State private var mainImageItem: PhotosPickerItem?
    @State private var showingSaveButton = false
    @State private var selectedOverlayPhotoId: UUID?
    
    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                if let mainImage = mainImage {
                    Image(uiImage: mainImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 400)
                        .clipped()
                        .overlay(
                            // Draggable Overlay Photos
                            ForEach(overlayPhotos.indices, id: \.self) { index in
                                let photo = overlayPhotos[index]
                                OverlayPhotoView(
                                    photo: $overlayPhotos[index],
                                    isSelected: photo.id == selectedOverlayPhotoId
                                )
                                .gesture(
                                    TapGesture()
                                        .onEnded {
                                            // Toggle selection
                                            for i in overlayPhotos.indices {
                                                overlayPhotos[i].isSelected = (overlayPhotos[i].id == photo.id)
                                            }
                                            selectedOverlayPhotoId = photo.id
                                        }
                                )
                            }
                        )
                }
                
                // Main Photo Picker
                PhotosPicker(selection: $mainImageItem, matching: .images) {
                    if mainImage == nil {
                        Text("Select Main Photo")
                            .font(.custom("Zain-Regular", size: 18))
                            .kerning(-0.5)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.black)
                            .cornerRadius(8)
                    }
                }
            }
            .onChange(of: mainImageItem) { _ in
                Task {
                    if let item = mainImageItem,
                       let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        mainImage = image
                        showingSaveButton = true
                    }
                }
            }
            
            // Overlay Photos Picker
            if mainImage != nil {
                PhotosPicker(selection: .init(get: { [] }, set: { items in
                    Task {
                        for item in items {
                            if let data = try? await item.loadTransferable(type: Data.self),
                               let image = UIImage(data: data) {
                                let centerX = UIScreen.main.bounds.width / 2
                                let centerY = 150.0
                                let photo = DraggablePhoto(
                                    image: image,
                                    position: CGPoint(x: centerX, y: centerY),
                                    scale: 1.0,
                                    isSelected: false
                                )
                                overlayPhotos.append(photo)
                                showingSaveButton = true
                            }
                        }
                    }
                }), maxSelectionCount: 5, matching: .images) {
                    Text("Add Overlay Photos")
                        .font(.custom("Zain-Regular", size: 18))
                        .kerning(-0.5)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.black)
                        .cornerRadius(8)
                }
                
                if let selectedIndex = overlayPhotos.firstIndex(where: { $0.isSelected }) {
                    OverlayPhotoActions(
                        photo: $overlayPhotos[selectedIndex],
                        removePhoto: {
                            overlayPhotos.remove(at: selectedIndex)
                        }
                    )
                }
                
                if showingSaveButton {
                    Button(action: saveCollage) {
                        Text("Save Collage")
                            .font(.custom("Zain-Regular", size: 18))
                            .kerning(-0.5)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.black)
                            .cornerRadius(8)
                    }
                }
            }
        }
        .padding(.horizontal)
    }
    
    private func saveCollage() {
        let renderer = UIGraphicsImageRenderer(bounds: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 300))
        
        let collageImage = renderer.image { context in
            if let mainImage = mainImage {
                let rect = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 300)
                mainImage.draw(in: rect)
                
                for photo in overlayPhotos {
                    let overlayRect = CGRect(
                        x: photo.position.x - (50 * photo.scale),
                        y: photo.position.y - (50 * photo.scale),
                        width: 100 * photo.scale,
                        height: 100 * photo.scale
                    )
                    photo.image.draw(in: overlayRect)
                }
            }
        }
        
        savedCollage = collageImage
        showingSaveButton = false
    }
}

struct OverlayPhotoView: View {
    @Binding var photo: DraggablePhoto
    let isSelected: Bool
    
    var body: some View {
        Image(uiImage: photo.image)
            .resizable()
            .scaledToFit()
            .frame(width: 100 * photo.scale, height: 100 * photo.scale)
            .position(x: photo.position.x, y: photo.position.y)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 3)
            )
            .gesture(
                DragGesture()
                    .onChanged { value in
                        photo.position = value.location
                        photo.isSelected = true
                    }
                    .onEnded { _ in
                        // Deselect after dragging
                        photo.isSelected = false
                    }
            )
    }
}

struct OverlayPhotoActions: View {
    @Binding var photo: DraggablePhoto
    let removePhoto: () -> Void
    
    var body: some View {
        HStack {
            Button(action: removePhoto) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.black.opacity(0.1))
                    .cornerRadius(8)
            }
            
            Slider(value: Binding(
                get: { photo.scale },
                set: { photo.scale = $0 }
            ), in: 0.5...2.0)
            .accentColor(.blue)
            .padding()
        }
    }
}
