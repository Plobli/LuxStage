import SwiftUI
import PhotosUI

/// List-Section-Wrapper für die Foto-Galerie mit Upload-Button im Header.
struct PhotosSection: View {
    let showId: String
    @Environment(PocketBaseClient.self) private var pb

    @State private var photos: [Photo] = []
    @State private var loading = true
    @State private var uploading = false
    @State private var error: String?
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var selectedPhoto: Photo?
    @State private var deleteConfirm: Photo?

    var body: some View {
        Section {
            content
        } header: {
            HStack {
                Text("Fotos")
                Spacer()
                PhotosPicker(selection: $pickerItems, maxSelectionCount: 10, matching: .images) {
                    if uploading {
                        ProgressView().scaleEffect(0.75)
                    } else {
                        Image(systemName: "plus")
                    }
                }
                .disabled(uploading)
            }
        }
        .task { await load() }
        .onChange(of: pickerItems) { _, items in
            Task { await uploadItems(items) }
        }
        .alert("Fehler", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK") {}
        } message: { Text(error ?? "") }
        .confirmationDialog("Foto löschen?",
            isPresented: Binding(get: { deleteConfirm != nil }, set: { if !$0 { deleteConfirm = nil } }),
            titleVisibility: .visible
        ) {
            Button("Löschen", role: .destructive) {
                if let p = deleteConfirm { Task { await delete(p) } }
            }
        }
        .fullScreenCover(item: $selectedPhoto) { photo in
            PhotoFullscreenView(photo: photo, pb: pb)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if loading {
            HStack { Spacer(); ProgressView(); Spacer() }
        } else if photos.isEmpty {
            HStack {
                Spacer()
                Label("Noch keine Fotos", systemImage: "photo.on.rectangle")
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.vertical, 8)
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 95), spacing: 4)], spacing: 4) {
                ForEach(photos) { photo in
                    photoCell(photo)
                }
            }
            .padding(4)
            .listRowInsets(EdgeInsets())
        }
    }

    // MARK: - Photo Cell

    private func photoCell(_ photo: Photo) -> some View {
        Group {
            if let url = pb.thumbURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
            } else {
                Color.gray.opacity(0.2)
            }
        }
        .frame(width: 95, height: 95)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .onTapGesture { selectedPhoto = photo }
        .onLongPressGesture { deleteConfirm = photo }
    }

    // MARK: - Data

    private func load() async {
        loading = true
        do { photos = try await pb.fetchPhotos(showId: showId) }
        catch { self.error = error.localizedDescription }
        loading = false
    }

    private func uploadItems(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        uploading = true
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let compressed = compressJPEG(data, maxDimension: 1920, quality: 0.8)
            let filename = "\(UUID().uuidString).jpg"
            do {
                let photo = try await pb.uploadPhoto(showId: showId, imageData: compressed, filename: filename)
                photos.insert(photo, at: 0)
            } catch {
                self.error = error.localizedDescription
            }
        }
        pickerItems = []
        uploading = false
    }

    private func delete(_ photo: Photo) async {
        do {
            try await pb.deletePhoto(id: photo.id)
            photos.removeAll { $0.id == photo.id }
        } catch {
            self.error = error.localizedDescription
        }
        deleteConfirm = nil
    }

    private func compressJPEG(_ data: Data, maxDimension: CGFloat, quality: CGFloat) -> Data {
        guard let uiImage = UIImage(data: data) else { return data }
        let size = uiImage.size
        let scale = min(maxDimension / size.width, maxDimension / size.height, 1.0)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in uiImage.draw(in: CGRect(origin: .zero, size: newSize)) }
        return resized.jpegData(compressionQuality: quality) ?? data
    }
}

// MARK: - Fullscreen Viewer

struct PhotoFullscreenView: View {
    let photo: Photo
    let pb: PocketBaseClient
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            if let url = pb.fileURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } placeholder: {
                    ProgressView().tint(.white)
                }
            }

            if let caption = photo.caption, !caption.isEmpty {
                Text(caption)
                    .foregroundStyle(.white)
                    .padding(8)
                    .background(.black.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }

            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .foregroundStyle(.white)
                    .padding()
            }
        }
        .onTapGesture { dismiss() }
    }
}
