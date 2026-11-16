import Foundation

final class MemoryVault: PrivateVault, @unchecked Sendable {
    private let lock = NSLock()
    private var data: Data?
    var failWrites = false
    init(_ state: StoredClientState) throws { data = try JSONEncoder().encode(state) }
    func read() throws -> Data? { lock.lock(); defer { lock.unlock() }; return data }
    func write(_ data: Data) throws { lock.lock(); defer { lock.unlock() }; if failWrites { throw ClientError.unavailable("vault unavailable") }; self.data = data }
    func clear() throws { lock.lock(); defer { lock.unlock() }; data = nil }
}
let userID = "10000000-0000-4000-8000-000000000001"
let workspaceID = "10000000-0000-4000-8000-000000000002"
let agentID = "10000000-0000-4000-8000-000000000003"
let deviceID = "10000000-0000-4000-8000-000000000004"
let observationID = "10000000-0000-4000-8000-000000000005"
let accountUser: JSONValue = .object(["id": .string(userID), "displayName": .string("Fixture only")])
func initial() -> StoredClientState {
    var state = StoredClientState(); state.base = "https://api.example.test/api/v1"; state.workspaceID = workspaceID
    state.session = AccountSession(accessToken: String(repeating: "a", count: 48), refreshToken: String(repeating: "r", count: 43), user: accountUser); return state
}
func require(_ value: Bool, _ message: String) throws { if !value { throw ClientError.invalid("Test failed: " + message) } }
func rejects(_ message: String, _ operation: () async throws -> Void) async throws {
    do { try await operation() } catch { return }; throw ClientError.invalid("Expected rejection: " + message)
}
func fixtureComputer(now: Date = Date(), canControl: Bool = true, childCount: Int = 2) -> PairedComputer {
    let service = RemoteService(serviceId: String(repeating: "b", count: 64), observationId: observationID, pid: 4321, startedAt: Wire.stamp(now.addingTimeInterval(-3600)), observedAt: Wire.stamp(now), runtime: "node", project: "Synthetic fixture", ports: [3000], canStop: true, childCount: childCount)
    return PairedComputer(id: agentID, name: "Synthetic computer", platform: "darwin", connection: "online", canControl: canControl, canManage: true, sharingAllowed: true, localControlReady: true, platformSupported: true, reportedAt: Wire.stamp(now), services: [service])
}
actor FakeAPI: APITransport {
    var refreshes = 0, posts: [JSONValue] = [], lostRefresh = false, deny = false, lostStop = false
    var delayMe = false, enteredMe = false
    var releaseMe: CheckedContinuation<Void, Never>?
    let computer: PairedComputer
    init(computer: PairedComputer = fixtureComputer()) { self.computer = computer }
    func configure(lostRefresh: Bool = false, deny: Bool = false, lostStop: Bool = false, delayMe: Bool = false) { self.lostRefresh = lostRefresh; self.deny = deny; self.lostStop = lostStop; self.delayMe = delayMe }
    func release() { releaseMe?.resume(); releaseMe = nil }
    func counts() -> (Int, [JSONValue]) { (refreshes, posts) }
    func send(base: URL, method: String, path: String, query: [String: String], token: String?, body: JSONValue?) async throws -> APIReply {
        if path == "/auth/refresh" {
            refreshes += 1; try await Task.sleep(for: .milliseconds(40))
            if lostRefresh { throw ClientError.unavailable("lost refresh response") }
            return APIReply(status: 201, value: .object(["accessToken": .string(String(repeating: "n", count: 48)), "refreshToken": .string(String(repeating: "s", count: 43)), "user": accountUser]))
        }
        if path == "/auth/me", delayMe { enteredMe = true; await withCheckedContinuation { releaseMe = $0 } }
        if path != "/privacy/disclosures" && token == String(repeating: "a", count: 48) { return APIReply(status: 401, value: .null) }
        if deny { return APIReply(status: 403, value: .null) }
        if path == "/auth/me" { return APIReply(status: 200, value: accountUser) }
        if path == "/workspaces" { return APIReply(status: 200, value: .array([.object(["id": .string(workspaceID), "type": .string("PERSONAL"), "timezone": .string("UTC")])])) }
        if path.hasSuffix("/developer") { return APIReply(status: 200, value: try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode([computer]))) }
        if method == "POST", path.hasSuffix("/commands") { posts.append(body!); if lostStop { throw ClientError.unavailable("lost stop acknowledgement") }; return APIReply(status: 201, value: .object(["requestId": body!["requestId"]])) }
        return APIReply(status: method == "POST" ? 201 : 200, value: path.hasSuffix("/devices") || path.hasSuffix("/commands") ? .array([]) : .object([:]))
    }
}
@main struct CoreChecks {
    static func main() async throws {
        try require(try Wire.base("https://example.test/api/v1").scheme == "https", "HTTPS URL")
        for invalid in ["http://example.test/api/v1", "https://user:secret@example.test/api/v1", "https://example.test/api/v1?token=x", "https://example.test/api/v1/", "https://example.test/api/v1#fragment"] { try await rejects("unsafe base") { _ = try Wire.base(invalid) } }
        try await rejects("unsafe path") { _ = try Wire.url(base: Wire.base("https://example.test/api/v1"), path: "/../auth", query: [:]) }
        let today = Date(timeIntervalSince1970: 1772956800)
        let dates = try Wire.dates(period: "day", timezone: "America/New_York", now: today)
        try require(dates.0 != dates.1, "calendar dates use exclusive next date")
        let now = Date()
        let lease = LocalScreenLease(id: UUID(), scope: userID + "/" + workspaceID, createdAt: now, createdUptime: 100, start: now, end: now.addingTimeInterval(1800), thresholdMinutes: 15)
        try require(lease.active(now: now.addingTimeInterval(900), uptime: 1000), "valid lease")
        try require(!lease.valid(now: now.addingTimeInterval(1800), uptime: 1900), "expired lease")
        try require(!lease.valid(now: now, uptime: 1), "reboot invalidates lease")
        try require(!lease.valid(now: now.addingTimeInterval(300), uptime: 100), "clock jump invalidates lease")
        let api = FakeAPI(), vault = try MemoryVault(initial()), repo = try ClientRepository(vault: vault, transport: api)
        async let a: Void = repo.refresh(); async let b: Void = repo.refresh(); try await a; try await b
        let count = await api.counts(); try require(count.0 == 1, "concurrent expired access shares one refresh")
        try require(await repo.snapshot().devices.isEmpty, "missing devices remain empty")
        try await repo.desktop()
        let computer = await repo.snapshot().computers[0]
        try await rejects("unconfirmed stop") { _ = try await repo.prepareStop(computerID: agentID, service: computer.services[0], mode: "graceful", children: false, confirmed: false) }
        try await rejects("stale observation") { _ = try await repo.prepareStop(computerID: agentID, service: computer.services[0], mode: "graceful", children: false, confirmed: true, now: now.addingTimeInterval(20)) }
        let intent = try await repo.prepareStop(computerID: agentID, service: computer.services[0], mode: "force", children: true, confirmed: true)
        await api.configure(lostStop: true)
        try await rejects("uncertain stop") { try await repo.submitStop(intent) }
        let restored = try ClientRepository(vault: vault, transport: api)
        try require(await restored.snapshot().pendingStop == intent, "exact intent survives process recreation")
        await api.configure()
        try await repo.submitStop(intent)
        let commands = await api.counts().1
        try require(commands.count == 2 && commands[0] == commands[1], "retry preserves exact UUID and body")
        try require(await repo.snapshot().pendingStop == nil, "matching ack resolves local pending")
        let many = fixtureComputer(childCount: 17)
        let tooMany = RemoteIntent(userID: userID, workspaceID: workspaceID, agentID: agentID, requestID: UUID().uuidString, service: many.services[0], mode: "graceful", includeChildren: true, confirmedAt: Date())
        try await rejects("too many children") { try tooMany.validate(now: Date(), computer: many) }
        let forbidden = fixtureComputer(canControl: false)
        try await rejects("capability does not grant control") { try RemoteIntent(userID: userID, workspaceID: workspaceID, agentID: agentID, requestID: UUID().uuidString, service: forbidden.services[0], mode: "graceful", includeChildren: false, confirmedAt: Date()).validate(now: Date(), computer: forbidden) }
        let failingAPI = FakeAPI(); await failingAPI.configure(lostRefresh: true)
        let failing = try ClientRepository(vault: MemoryVault(initial()), transport: failingAPI)
        try await rejects("lost refresh") { try await failing.refresh() }
        try require(!(await failing.snapshot().signedIn), "lost rotating refresh clears credentials")
        try await rejects("no old refresh replay") { try await failing.refresh() }
        try require(await failingAPI.counts().0 == 1, "refresh is not replayed")
        let deniedAPI = FakeAPI(), deniedRepo = try ClientRepository(vault: MemoryVault(initial()), transport: deniedAPI)
        try await deniedRepo.refresh(); await deniedAPI.configure(deny: true)
        try await rejects("permission loss") { try await deniedRepo.desktop() }
        try require(await deniedRepo.snapshot().computers.isEmpty, "403 clears protected views")
        let raceAPI = FakeAPI(), raceRepo = try ClientRepository(vault: MemoryVault(initial()), transport: raceAPI)
        await raceAPI.configure(delayMe: true)
        let pending = Task { try await raceRepo.refresh() }
        while !(await raceAPI.enteredMe) { await Task.yield() }
        try await raceRepo.clearLocal(); await raceAPI.release()
        try await rejects("scope race") { try await pending.value }
        try require(!(await raceRepo.snapshot().signedIn), "stale response cannot restore account")
        await api.configure(deny: true); try await repo.signOut()
        try require(!(await repo.snapshot().signedIn), "logout clears locally even if server rejects")
        let failVault = try MemoryVault(initial()), failVaultAPI = FakeAPI()
        let failVaultRepo = try ClientRepository(vault: failVault, transport: failVaultAPI)
        try await failVaultRepo.refresh(); try await failVaultRepo.desktop(); failVault.failWrites = true
        let failComputer = await failVaultRepo.snapshot().computers[0]
        try await rejects("private write fails before command") { _ = try await failVaultRepo.prepareStop(computerID: failComputer.id, service: failComputer.services[0], mode: "graceful", children: false, confirmed: true) }
        try require(await failVaultRepo.snapshot().pendingStop == nil, "undurable intent cannot be submitted")
        try await rejects("local erase write failure") { try await failVaultRepo.clearLocal() }
        try require(!(await failVaultRepo.snapshot().signedIn), "storage failure never keeps in-memory credentials")
        try require(try failVault.read() == nil, "credential erase precedes nonsecret save")
        let emit = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        try JSONEncoder().encode(Wire.capabilities(workspaceID: workspaceID, deviceID: deviceID, now: now)).write(to: emit.appendingPathComponent("capabilities.json"))
        try JSONEncoder().encode(intent.body).write(to: emit.appendingPathComponent("command.json"))
        print("Swift host core checks passed: URL boundaries, calendar periods, local leases, single-flight refresh, uncertain refresh, scope races, 403 clearing, confirmed remote intent, exact retries, persistence and offline logout. No iOS frameworks or real monitoring used.")
    }
}
