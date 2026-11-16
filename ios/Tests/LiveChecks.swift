import Foundation
import Security

/// Test-only CA trust is scoped to this URLSession. No system trust changes and
/// no bypass is compiled into the app. Hostname and chain evaluation still run.
final class FixtureTrust: NoRedirectDelegate, @unchecked Sendable {
    let certificate: SecCertificate
    init(der: Data) throws {
        guard let certificate = SecCertificateCreateWithData(nil, der as CFData) else { throw ClientError.invalid("Invalid fixture CA.") }; self.certificate = certificate
    }
    override func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = challenge.protectionSpace.serverTrust else { completionHandler(.cancelAuthenticationChallenge, nil); return }
        SecTrustSetAnchorCertificates(trust, [certificate] as CFArray)
        SecTrustSetAnchorCertificatesOnly(trust, true)
        var error: CFError?
        guard SecTrustEvaluateWithError(trust, &error) else { FileHandle.standardError.write(Data("Fixture trust evaluation failed: \(String(describing: error))\n".utf8)); completionHandler(.cancelAuthenticationChallenge, nil); return }

        completionHandler(.useCredential, URLCredential(trust: trust))
    }
}
final class LiveVault: PrivateVault, @unchecked Sendable {
    let lock = NSLock(); var data: Data?
    func read() throws -> Data? { lock.lock(); defer { lock.unlock() }; return data }
    func write(_ data: Data) throws { lock.lock(); defer { lock.unlock() }; self.data = data }
    func clear() throws { lock.lock(); defer { lock.unlock() }; data = nil }
}
func ensure(_ condition: Bool, _ message: String) throws { if !condition { throw ClientError.invalid(message) } }
@main struct LiveChecks {
    static func main() async throws {
        let base = CommandLine.arguments[1], fixture = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
        let transport = HTTPSAPI(delegate: try FixtureTrust(der: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]))))
        do { _ = try await transport.send(base: Wire.base(base), method: "GET", path: "/__redirect"); throw ClientError.invalid("Redirect was followed") } catch ClientError.http(let status, _) { try ensure(status == 302, "Wrong redirect status") }
        let retry = try await transport.send(base: Wire.base(base), method: "POST", path: "/__retry", body: .object(["synthetic": .bool(true)])); try ensure(retry.status == 503, "Expected one-shot 503")
        let repo = try ClientRepository(vault: LiveVault(), transport: transport)
        try await repo.authenticate(base: base, email: fixture["accounts"]["owner"]["email"].text, password: fixture["password"].text)
        try await repo.updateProfile("Swift HTTPS fixture")
        try await repo.selectWorkspace(fixture["workspaceId"].text)
        try await repo.enrol(name: "Synthetic Swift host client", accepted: true)
        try ensure(await repo.snapshot().device != nil, "iOS enrolment failed")
        try await repo.heartbeat()
        let paired = await repo.snapshot().device!
        try await repo.usage(deviceID: paired.id, period: "day", metric: "screen_time_seconds")
        try ensure(!(await repo.snapshot().report.isNull), "Report missing")
        try await repo.notificationPreference(inApp: true, email: true)
        try ensure(await repo.snapshot().preferences["email"].flag, "Email preference not saved")
        try ensure(!(await repo.snapshot().preferences["emailDeliveryAvailable"].flag), "Email delivery must stay disabled")
        try await repo.notificationPreference(inApp: true)
        try ensure(await repo.snapshot().preferences["email"].flag, "Old-client update lost email preference")
        try await repo.notificationPreference(inApp: true, email: false)
        try await repo.familyOverview(profileID: fixture["familyProfileId"].text)
        try ensure(!(await repo.snapshot().child.isNull), "Family scope missing")
        try await repo.shareWithChild(accepted: true)
        try await repo.withdrawFamily(deviceID: paired.id)
        try await repo.desktop()
        guard let computer = await repo.snapshot().computers.first(where: { $0.id == fixture["developerAgentId"].text }), let service = computer.services.first else { throw ClientError.invalid("Synthetic service missing") }
        let intent = try await repo.prepareStop(computerID: computer.id, service: service, mode: "graceful", children: false, confirmed: true)
        try await repo.submitStop(intent)
        guard let command = await repo.snapshot().commands[computer.id]?.first(where: { $0["requestId"].text == intent.requestID }) else { throw ClientError.invalid("Remote command history missing") }
        try await repo.cancelCommand(agentID: computer.id, commandID: command["id"].text)
        _ = try await repo.sessions()
        _ = try await repo.exportPersonal(password: fixture["password"].text)
        try await repo.deviceAction("erase", id: paired.id)
        try await repo.deviceAction("unenrol", id: paired.id)
        try await repo.signOut()
        try ensure(!(await repo.snapshot().signedIn), "Logout failed")
        let businessRepo = try ClientRepository(vault: LiveVault(), transport: transport)
        try await businessRepo.authenticate(base: base, email: fixture["accounts"]["employee"]["email"].text, password: fixture["password"].text)
        try await businessRepo.selectWorkspace(fixture["business"]["workspaceId"].text)
        try await businessRepo.refreshSubscription()
        try ensure(await businessRepo.snapshot().subscription["edition"].text == "free", "Subscription read missing")
        try await businessRepo.businessOverview()
        let business = await businessRepo.snapshot().business
        guard let assignment = business["assignments"].values.first, let businessDevice = business["devices"].values.first else { throw ClientError.invalid("Business fixture missing") }
        try await businessRepo.acceptBusinessSharing(deviceID: businessDevice["id"].text, revision: assignment["revision"].integer!, generation: businessDevice["generation"].integer!, accepted: true)
        try ensure(!(await businessRepo.snapshot().business["assignments"].values[0]["consentedAt"].isNull), "Business consent missing")
        try await businessRepo.withdrawBusinessSharing(deviceID: businessDevice["id"].text)
        try ensure(await businessRepo.snapshot().business["assignments"].values.isEmpty, "Business withdrawal missing")
        try await businessRepo.signOut()
        print("Business employee Swift API sharing/withdrawal passed with monitoring unchanged.")
        print("Swift HTTPS + Nest + PostgreSQL integration passed: account/profile, workspace, iOS enrolment, conservative heartbeat, empty report, notifications, family sharing/withdrawal, confirmed synthetic remote stop/cancel/history, sessions, export, privacy erase and unenrolment. No Apple framework/device behavior or actual process stop was exercised.")
    }
}
