import Foundation
#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

class NoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) { completionHandler(.performDefaultHandling, nil) }
    func urlSession(
        _ session: URLSession, task: URLSessionTask,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) { self.urlSession(session, didReceive: challenge, completionHandler: completionHandler) }
    func urlSession(
        _ session: URLSession, task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) { completionHandler(nil) }
}
final class HTTPSAPI: APITransport, @unchecked Sendable {
    private let session: URLSession
    init(delegate: NoRedirectDelegate = NoRedirectDelegate()) {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 15; config.timeoutIntervalForResource = 25
        config.connectionProxyDictionary = [:]
        session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    }
    func send(
        base: URL, method: String, path: String, query: [String: String] = [:],
        token: String? = nil, body: JSONValue? = nil
    ) async throws -> APIReply {
        guard base.scheme == "https", ["GET", "POST", "PATCH", "DELETE"].contains(method) else {
            throw ClientError.invalid("Unsupported request.")
        }
        var request = URLRequest(url: try Wire.url(base: base, path: path, query: query));
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let body {
            let data = try JSONEncoder().encode(body);
            guard data.count <= 65536 else { throw ClientError.invalid("Request is too large.") };
            request.httpBody = data;
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        // Stream and cap before decoding. No automatic mutation retries or redirect forwarding.
        #if canImport(FoundationNetworking)
            let (data, response) = try await session.data(for: request)
            guard data.count <= 16 * 1024 * 1024, let response = response as? HTTPURLResponse else {
                throw ClientError.unavailable("Response is too large or invalid.")
            }
        #else
            let (bytes, raw) = try await session.bytes(for: request)
            guard let response = raw as? HTTPURLResponse else {
                throw ClientError.unavailable("Invalid HTTP response.")
            }
            if response.expectedContentLength > 16 * 1024 * 1024 {
                throw ClientError.unavailable("Response is too large.")
            }
            var data = Data()
            for try await byte in bytes {
                guard data.count < 16 * 1024 * 1024 else {
                    throw ClientError.unavailable("Response is too large.")
                }; data.append(byte)
            }
        #endif
        guard !(300...399).contains(response.statusCode) else {
            throw ClientError.http(
                response.statusCode, "The server redirected the request; check the API address.")
        }
        let value: JSONValue
        if data.isEmpty {
            value = .null
        } else if let decoded = try? JSONDecoder().decode(JSONValue.self, from: data) {
            value = decoded
        } else if !(200...299).contains(response.statusCode) {
            value = .null
        } else {
            throw ClientError.unavailable("Invalid JSON response.")
        }
        return APIReply(status: response.statusCode, value: value)
    }
}
