import SwiftUI
import PhotosUI

struct PhotosTabView: View {
    let showId: String
    @Binding var externalUpload: [PhotosPickerItem]
    @Environment(PocketBaseClient.self) private var pb

    @State private var photos: [Photo] = []
    @State private var loading = true
    @State private var uploading = false
    @State private var error: String?
    @State private var selectedPhoto: Photo?
    @State private var deleteConfirm: Photo?

    var body: some View {
        mainContent
            .navigationTitle("Fotos")
            .task { await load() }
            .onChange(of: externalUpload) { _, items in Task { await uploadItems(items) } }
            .alert("Fehler", isPresented: errorBinding) {
                Button("OK") {}
            } message: { Text(error ?? "") }
            .confirmationDialog("Foto löschen?", isPresented: deleteBinding, titleVisibility: .visible) {
                Button("Löschen", role: .destructive) {
                    if let p = deleteConfirm { Task { await delete(p) } }
                }
            }
            .sheet(item: $selectedPhoto) { photo in
                PhotoFullscreenView(photo: photo, pb: pb) { newCaption in
                    if let idx = photos.firstIndex(where: { $0.id == photo.id }) {
                        photos[idx] = Photo(id: photo.id, show: photo.show, file: photo.file, caption: newCaption, created: photo.created, collectionId: photo.collectionId)
                    }
                }
                .presentationDetents([.large])
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
            let compressed = compressJPEG(data, maxDimension: 1200, quality: 0.78)
            do {
                let photo = try await pb.uploadPhoto(showId: showId, imageData: compressed, filename: "\(UUID().uuidString).jpg")
                photos.insert(photo, at: 0)
            } catch { self.error = error.localizedDescription }
        }
        externalUpload = []
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
    var onCaptionUpdated: ((String) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    @State private var caption: String = ""
    @State private var editingCaption = false
    @State private var saving = false
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                AsyncImage(url: pb.fileURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file)) { image in
                    image
                        .resizable()
                        .scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .scaleEffect(scale)
                        .gesture(
                            MagnifyGesture()
                                .onChanged { value in scale = max(1.0, lastScale * value.magnification) }
                                .onEnded { _ in lastScale = scale }
                        )
                        .onTapGesture(count: 2) {
                            withAnimation { scale = scale > 1.0 ? 1.0 : 2.0; lastScale = scale }
                        }
                } placeholder: {
                    ProgressView().frame(width: geo.size.width, height: geo.size.height)
                }
            }
            .ignoresSafeArea(edges: .horizontal)
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                if editingCaption {
                    TextField("Beschreibung", text: $caption, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .padding()
                        .background(.regularMaterial)
                } else if !caption.isEmpty {
                    Text(caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.regularMaterial)
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Schließen") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if saving {
                        ProgressView().scaleEffect(0.8)
                    } else if editingCaption {
                        Button("Fertig") { Task { await saveCaption() } }
                            .fontWeight(.semibold)
                    } else {
                        Button("Bearbeiten") { editingCaption = true }
                    }
                }
            }
        }
        .onAppear { caption = photo.caption ?? "" }
    }

    private func saveCaption() async {
        saving = true
        if let updated = try? await pb.updateCaption(id: photo.id, caption: caption) {
            onCaptionUpdated?(updated.caption ?? "")
        }
        saving = false
        editingCaption = false
    }
}
