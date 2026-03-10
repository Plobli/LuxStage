import Foundation
import Network

/// Sends OSC messages via UDP using Network.framework.
/// OSC 1.0 — only string address + no arguments (for /full and /out commands).
final class OSCClient {
    static let shared = OSCClient()
    private init() {}

    func send(address: String, host: String, port: UInt16) {
        guard !host.isEmpty, port > 0 else { return }
        let packet = buildPacket(address: address)
        let connection = NWConnection(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(rawValue: port)!,
            using: .udp
        )
        connection.stateUpdateHandler = { state in
            if case .ready = state {
                connection.send(content: packet, completion: .contentProcessed { _ in
                    connection.cancel()
                })
            }
            if case .failed = state { connection.cancel() }
        }
        connection.start(queue: .global())
    }

    // MARK: - OSC Packet Builder

    /// Builds a minimal OSC 1.0 packet: address string + type tag ",".
    private func buildPacket(address: String) -> Data {
        var data = Data()
        data.append(oscString(address))
        data.append(oscString(","))   // type tag string: no arguments
        return data
    }

    /// Pads a string to a multiple of 4 bytes with null terminators.
    private func oscString(_ s: String) -> Data {
        var bytes = Data(s.utf8)
        bytes.append(0) // null terminator
        while bytes.count % 4 != 0 { bytes.append(0) }
        return bytes
    }
}
