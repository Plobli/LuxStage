import SwiftUI
import PhotosUI

struct PhotosTabView: View {
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
        mainContent
            .navigationTitle("Fotos")
            .toolbar { uploadToolbarItem }
            .task { await load() }
            .onChange(of: pickerItems) { _, items in Task { await uploadItems(items) } }
            .alert("Fehler", isPresented: errorBinding) {
                Button("OK") {}
            } message: { Text(error ?? "") }
            .confirmationDialog("Foto löschen?", isPresented: deleteBinding, titleVisibility: .visible) {
                Button("Löschen", role: .destructive) {
                    if let p = deleteConfirm { Task { await delete(p) } }
                }
            }
            .fullScreenCover(item: $selectedPhoto) { photo in
                PhotoFullscreenView(photo: photo, pb: pb)
            }
    }

    @ViewBuilder
    private var mainContent: some View {
        if loading {
            ProgressView("Fotos laden …")
        } else if photos.isEmpty {
            ContentUnavailableView("Keine Fotos", systemImage: "photo.on.rectangle")
        } else {
            photoGrid
        }
    }

    private var photoGrid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 3)], spacing: 3) {
                ForEach(photos) { photo in photoCell(photo) }
            }
            .padding(3)
        }
    }

    @ToolbarContentBuilder
    private var uploadToolbarItem: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            PhotosPicker(selection: $pickerItems, maxSelectionCount: 10, matching: .images) {
                if uploading { ProgressView().scaleEffect(0.8) }
                else { Label("Hinzufügen", systemImage: "plus") }
            }
            .disabled(uploading)
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }
    private var deleteBinding: Binding<Bool> {
        Binding(get: { deleteConfirm != nil }, set: { if !$0 { deleteConfirm = nil } })
    }

    private func photoCell(_ photo: Photo) -> some View {
        let url = pb.thumbURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file)
        return AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Color.gray.opacity(0.2)
        }
        .frame(width: 110, height: 110)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .onTapGesture { selectedPhoto = photo }
        .onLongPressGesture { deleteConfirm = photo }
    }

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
            do {
                let photo = try await pb.uploadPhoto(showId: showId, imageData: compressed, filename: "\(UUID().uuidString).jpg")
                photos.insert(photo, at: 0)
            } catch { self.error = error.localizedDescription }
        }
        pickerItems = []
        uploading = false
    }

    private func delete(_ photo: Photo) async {
        do {
            try await pb.deletePhoto(id: photo.id)
            photos.removeAll { $0.id == photo.id }
        } catch { self.error = error.localizedDescription }
        deleteConfirm = nil
    }

    private func compressJPEG(_ data: Data, maxDimension: CGFloat, quality: CGFloat) -> Data {
        guard let img = UIImage(data: data) else { return data }
        let scale = min(maxDimension / img.size.width, maxDimension / img.size.height, 1.0)
        let newSize = CGSize(width: img.size.width * scale, height: img.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in img.draw(in: CGRect(origin: .zero, size: newSize)) }
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
            AsyncImage(url: pb.fileURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file)) { image in
                image.resizable().scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } placeholder: {
                ProgressView().tint(.white)
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
                    .font(.title).foregroundStyle(.white).padding()
            }
        }
        .onTapGesture { dismiss() }
    }
}
