import SwiftUI

struct SyncStatusButton: View {
    @Environment(SyncEngine.self) private var sync

    var body: some View {
        Button {
            Task { await sync.sync() }
        } label: {
            switch sync.state {
            case .syncing:
                ProgressView()
                    .scaleEffect(0.8)
            case .error:
                Image(systemName: "exclamationmark.arrow.trianglehead.2.clockwise.rotate.90")
                    .foregroundStyle(.red)
            case .done:
                Image(systemName: sync.isOnline ? "checkmark.icloud" : "icloud.slash")
                    .foregroundStyle(sync.isOnline ? .secondary : .orange)
            case .idle:
                Image(systemName: sync.isOnline ? "arrow.trianglehead.2.clockwise.rotate.90.icloud" : "icloud.slash")
                    .foregroundStyle(sync.isOnline ? .secondary : .orange)
            }
        }
        .disabled(!sync.isOnline || sync.state == .syncing)
    }
}
