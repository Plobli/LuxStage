import SwiftUI
import PhotosUI
import UIKit

// MARK: - Photo Grid Tab

struct PhotosTabView: View {
    let showId: String
    @Binding var externalUpload: [PhotosPickerItem]
    @Environment(PocketBaseClient.self) private var pb

    @State private var photos: [Photo] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selectedIndex: Int?
    @State private var deleteConfirm: Photo?

    var body: some View {
        mainContent
            .navigationTitle("Fotos")
            .task { await load() }
            .onChange(of: externalUpload) { _, items in Task { await uploadItems(items) } }
            .alert("Fehler", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK") {}
            } message: { Text(error ?? "") }
            .confirmationDialog("Foto löschen?", isPresented: Binding(get: { deleteConfirm != nil }, set: { if !$0 { deleteConfirm = nil } }), titleVisibility: .visible) {
                Button("Löschen", role: .destructive) {
                    if let p = deleteConfirm { Task { await delete(p) } }
                }
            }
            .fullScreenCover(item: $selectedIndex) { index in
                NativePhotoGallery(
                    urls: photos.map { pb.fileURL(collectionId: $0.collectionId, recordId: $0.id, filename: $0.file) },
                    startIndex: index,
                    totalCount: photos.count,
                    onDelete: { deleteIndex in
                        let photo = photos[deleteIndex]
                        Task { await delete(photo) }
                    }
                )
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
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 2)], spacing: 2) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                    let url = pb.thumbURL(collectionId: photo.collectionId, recordId: photo.id, filename: photo.file)
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Color(.systemGray5)
                    }
                    .frame(width: 110, height: 110)
                    .clipped()
                    .onTapGesture { selectedIndex = index }
                    .onLongPressGesture { deleteConfirm = photo }
                }
            }
            .padding(2)
        }
    }

    private func load() async {
        loading = true
        do { photos = try await pb.fetchPhotos(showId: showId) }
        catch { self.error = error.localizedDescription }
        loading = false
    }

    private func uploadItems(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let compressed = compressJPEG(data, maxDimension: 1200, quality: 0.78)
            do {
                let photo = try await pb.uploadPhoto(showId: showId, imageData: compressed, filename: "\(UUID().uuidString).jpg")
                photos.insert(photo, at: 0)
            } catch { self.error = error.localizedDescription }
        }
        externalUpload = []
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

// Make Int work as a sheet item
extension Int: @retroactive Identifiable {
    public var id: Int { self }
}

// MARK: - Fullscreen Gallery (pure UIKit)

/// Wraps a UINavigationController containing a UIPageViewController.
/// Navigation bar shows "Fertig" button and page title — all native UIKit chrome.
/// Single-tap toggles bars, double-tap zooms, pinch-to-zoom via UIScrollView.
private struct NativePhotoGallery: UIViewControllerRepresentable {
    let urls: [URL?]
    let startIndex: Int
    let totalCount: Int
    var onDelete: ((Int) -> Void)?

    func makeUIViewController(context: Context) -> UINavigationController {
        let galleryVC = GalleryContainerViewController(
            urls: urls,
            startIndex: startIndex,
            totalCount: totalCount,
            onDelete: onDelete
        )
        let nav = UINavigationController(rootViewController: galleryVC)
        nav.modalPresentationStyle = .fullScreen
        nav.overrideUserInterfaceStyle = .dark

        // Transparent navigation bar over black background
        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        nav.navigationBar.standardAppearance = appearance
        nav.navigationBar.scrollEdgeAppearance = appearance
        nav.navigationBar.compactAppearance = appearance

        return nav
    }

    func updateUIViewController(_ nav: UINavigationController, context: Context) {}
}

// MARK: - Gallery container (manages UIPageViewController + native bars)

private final class GalleryContainerViewController: UIViewController,
    UIPageViewControllerDataSource, UIPageViewControllerDelegate {

    private let urls: [URL?]
    private let totalCount: Int
    private var currentIndex: Int
    private let pageVC = UIPageViewController(transitionStyle: .scroll, navigationOrientation: .horizontal)
    private var barsHidden = false
    private let onDelete: ((Int) -> Void)?

    init(urls: [URL?], startIndex: Int, totalCount: Int, onDelete: ((Int) -> Void)? = nil) {
        self.urls = urls
        self.currentIndex = startIndex
        self.totalCount = totalCount
        self.onDelete = onDelete
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        // Navigation bar items
        let backButton = UIBarButtonItem(
            image: UIImage(systemName: "chevron.left"),
            style: .plain,
            target: self,
            action: #selector(dismissGallery)
        )
        backButton.tintColor = .white
        navigationItem.leftBarButtonItem = backButton
        if onDelete != nil {
            navigationItem.rightBarButtonItem = UIBarButtonItem(
                barButtonSystemItem: .trash, target: self, action: #selector(confirmDelete)
            )
            navigationItem.rightBarButtonItem?.tintColor = .white
        }
        updateTitle()

        // Page view controller
        pageVC.dataSource = self
        pageVC.delegate = self
        pageVC.view.backgroundColor = .clear
        addChild(pageVC)
        view.addSubview(pageVC.view)
        pageVC.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            pageVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            pageVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            pageVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        pageVC.didMove(toParent: self)

        let initial = makeZoomPage(index: currentIndex)
        pageVC.setViewControllers([initial], direction: .forward, animated: false)
    }

    override var prefersStatusBarHidden: Bool { barsHidden }
    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation { .fade }

    // MARK: Navigation

    @objc private func dismissGallery() {
        dismiss(animated: true)
    }

    @objc private func confirmDelete() {
        let alert = UIAlertController(
            title: "Foto löschen?",
            message: "Das Foto wird unwiderruflich gelöscht.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel))
        alert.addAction(UIAlertAction(title: "Löschen", style: .destructive) { [weak self] _ in
            guard let self else { return }
            self.onDelete?(self.currentIndex)
            self.dismiss(animated: true)
        })
        present(alert, animated: true)
    }

    private func updateTitle() {
        navigationItem.title = "\(currentIndex + 1) / \(totalCount)"
    }

    // MARK: Toggle bars (called by single-tap from ZoomPageVC)

    func toggleBars() {
        barsHidden.toggle()
        navigationController?.setNavigationBarHidden(barsHidden, animated: true)
        setNeedsStatusBarAppearanceUpdate()
    }

    // MARK: Page creation

    private func makeZoomPage(index: Int) -> ZoomPageViewController {
        let vc = ZoomPageViewController()
        vc.pageIndex = index
        vc.url = urls[index]
        vc.galleryContainer = self
        return vc
    }

    // MARK: UIPageViewControllerDataSource

    func pageViewController(_ pvc: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
        guard let page = vc as? ZoomPageViewController, page.pageIndex > 0 else { return nil }
        return makeZoomPage(index: page.pageIndex - 1)
    }

    func pageViewController(_ pvc: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
        guard let page = vc as? ZoomPageViewController, page.pageIndex < urls.count - 1 else { return nil }
        return makeZoomPage(index: page.pageIndex + 1)
    }

    // MARK: UIPageViewControllerDelegate

    func pageViewController(_ pvc: UIPageViewController, didFinishAnimating finished: Bool, previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
        guard completed, let page = pvc.viewControllers?.first as? ZoomPageViewController else { return }
        currentIndex = page.pageIndex
        updateTitle()
    }
}

// MARK: - Single zoomable page (UIScrollView, like Photos.app)

private final class ZoomPageViewController: UIViewController, UIScrollViewDelegate {
    var pageIndex: Int = 0
    var url: URL?
    weak var galleryContainer: GalleryContainerViewController?

    private let scrollView = UIScrollView()
    private let imageView = UIImageView()
    private let spinner = UIActivityIndicatorView(style: .large)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        scrollView.delegate = self
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 5
        scrollView.bouncesZoom = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        scrollView.addSubview(imageView)

        spinner.color = .white
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        spinner.startAnimating()

        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
        doubleTap.numberOfTapsRequired = 2
        scrollView.addGestureRecognizer(doubleTap)

        let singleTap = UITapGestureRecognizer(target: self, action: #selector(handleSingleTap))
        singleTap.numberOfTapsRequired = 1
        singleTap.require(toFail: doubleTap)
        scrollView.addGestureRecognizer(singleTap)

        loadImage()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if imageView.image != nil { layoutImage() }
    }

    // MARK: Image loading

    private func loadImage() {
        guard let url else { spinner.stopAnimating(); return }
        Task { [weak self] in
            guard let self else { return }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let image = UIImage(data: data) else { return }
                await MainActor.run {
                    self.imageView.image = image
                    self.spinner.stopAnimating()
                    self.layoutImage()
                }
            } catch {
                await MainActor.run { self.spinner.stopAnimating() }
            }
        }
    }

    private func layoutImage() {
        guard let image = imageView.image else { return }
        let boundsSize = scrollView.bounds.size
        guard boundsSize.width > 0, boundsSize.height > 0 else { return }

        scrollView.zoomScale = 1
        let wScale = boundsSize.width / image.size.width
        let hScale = boundsSize.height / image.size.height
        let fitScale = min(wScale, hScale)
        let fitSize = CGSize(width: image.size.width * fitScale, height: image.size.height * fitScale)
        imageView.frame = CGRect(origin: .zero, size: fitSize)
        scrollView.contentSize = fitSize
        centerImage()
    }

    private func centerImage() {
        let boundsSize = scrollView.bounds.size
        let frameSize = imageView.frame.size
        let xInset = max(0, (boundsSize.width - frameSize.width) / 2)
        let yInset = max(0, (boundsSize.height - frameSize.height) / 2)
        scrollView.contentInset = UIEdgeInsets(top: yInset, left: xInset, bottom: yInset, right: xInset)
    }

    // MARK: UIScrollViewDelegate

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }
    func scrollViewDidZoom(_ scrollView: UIScrollView) { centerImage() }

    // MARK: Gestures

    @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
        if scrollView.zoomScale > scrollView.minimumZoomScale {
            scrollView.setZoomScale(scrollView.minimumZoomScale, animated: true)
        } else {
            let point = gesture.location(in: imageView)
            let scale = scrollView.maximumZoomScale / 2
            let size = CGSize(width: scrollView.bounds.width / scale, height: scrollView.bounds.height / scale)
            scrollView.zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
        }
    }

    @objc private func handleSingleTap() {
        galleryContainer?.toggleBars()
    }
}
