import Foundation

/// Network results are scoped by epoch. Mutations are one-shot; only access-token
/// renewal retries a request, and never after an uncertain refresh response.
actor ClientRepository {
    private let vault: PrivateVault, transport: APITransport
    private var state: StoredClientState
    private var epoch = 0
    private var refreshTask: Task<AccountSession, Error>?
    private var user: JSONValue = .null, disclosures: JSONValue = .null, preferences: JSONValue = .null
    private var workspaces: [JSONValue] = [], devices: [JSONValue] = [], computers: [PairedComputer] = []
    private var commands: [String: [JSONValue]] = [:]
    private var report: JSONValue = .null, family: JSONValue = .null, child: JSONValue = .null
    private var rules: [JSONValue] = [], alerts: [JSONValue] = [], notifications: [JSONValue] = []
    init(vault: PrivateVault, transport: APITransport = HTTPSAPI()) throws {
        self.vault = vault; self.transport = transport
        if let data = try vault.read() {
            guard data.count <= 131072, let saved = try? JSONDecoder().decode(StoredClientState.self, from: data), saved.schemaVersion == 1 else { throw ClientError.unavailable("Private state could not be read. Clear local credentials to recover.") }
            _ = try Wire.uuid(saved.installationID)
            if !saved.base.isEmpty { _ = try Wire.base(saved.base) }
            try saved.session?.validate(); try saved.device?.validate()
            guard saved.device == nil || saved.session?.userID == saved.device?.ownerID else { throw ClientError.invalid("Stored device ownership does not match the account.") }
            if !saved.workspaceID.isEmpty { _ = try Wire.uuid(saved.workspaceID) }
            if let pending = saved.pendingStop { guard pending.userID == saved.session?.userID else { throw ClientError.invalid("Stored intent belongs to another account.") }; try pending.service.validate() }
            state = saved
        } else { state = StoredClientState() }
    }
    private func save() throws { try vault.write(JSONEncoder().encode(state)) }
    private func scope() throws -> ScopeTicket { guard let session = state.session else { throw ClientError.signedOut }; return ScopeTicket(epoch: epoch, userID: session.userID, workspaceID: state.workspaceID) }
    private func check(_ ticket: ScopeTicket) throws { guard ticket.epoch == epoch, ticket.userID == state.session?.userID, ticket.workspaceID == state.workspaceID else { throw ClientError.changedScope } }
    private func clearViews() { user = .null; workspaces = []; devices = []; computers = []; commands = [:]; report = .null; family = .null; child = .null; rules = []; alerts = []; notifications = []; preferences = .null }
    func clearLocal() throws {
        epoch += 1; refreshTask?.cancel(); refreshTask = nil; clearViews()
        let base = state.base, installation = state.installationID
        state = StoredClientState(); state.base = base; state.installationID = installation
        // Erase credentials before attempting to retain nonsecret setup preferences.
        try vault.clear(); try save()
    }
    func snapshot() -> ClientSnapshot {
        ClientSnapshot(signedIn: state.session != nil, base: state.base, user: user.isNull ? (state.session?.user ?? .null) : user, workspaceID: state.workspaceID,
                       workspaces: workspaces, devices: devices, computers: computers, commands: commands, report: report, rules: rules, alerts: alerts, notifications: notifications,
                       disclosures: disclosures, preferences: preferences, family: family, child: child,
                       pendingStop: state.pendingStop?.workspaceID == state.workspaceID ? state.pendingStop : nil,
                       device: state.device?.workspaceID == state.workspaceID ? state.device : nil)
    }
    private func raw(_ method: String, _ path: String, token: String? = nil, body: JSONValue? = nil, query: [String: String] = [:]) async throws -> APIReply {
        let base = try Wire.base(state.base)
        return try await transport.send(base: base, method: method, path: path, query: query, token: token, body: body)
    }
    private func result(_ reply: APIReply) throws -> JSONValue {
        guard (200...299).contains(reply.status) else {
            let message = reply.value["message"].text
            throw ClientError.http(reply.status, message.isEmpty ? "The server rejected this request." : String(message.prefix(400)))
        }; return reply.value
    }
    private func account(_ method: String, _ path: String, body: JSONValue? = nil, query: [String: String] = [:]) async throws -> JSONValue {
        let ticket = try scope(); guard let used = state.session?.accessToken else { throw ClientError.signedOut }
        var reply = try await raw(method, path, token: used, body: body, query: query); try check(ticket)
        if reply.status == 401 {
            if state.session?.accessToken == used {
                if refreshTask == nil {
                    let token = state.session!.refreshToken, base = try Wire.base(state.base), transport = self.transport
                    refreshTask = Task {
                        let response = try await transport.send(base: base, method: "POST", path: "/auth/refresh", query: [:], token: nil, body: .object(["refreshToken": .string(token)]))
                        guard response.status == 201 else { throw ClientError.signedOut }
                        let session = try response.value.decoded(AccountSession.self); try session.validate(); return session
                    }
                }
                do {
                    let renewed = try await refreshTask!.value; try check(ticket)
                    guard renewed.userID == ticket.userID else { throw ClientError.signedOut }
                    if state.session?.accessToken == used { state.session = renewed; try save() }
                    refreshTask = nil
                } catch {
                    // An old refresh may not erase a newly signed-in account.
                    try check(ticket); try clearLocal(); throw ClientError.signedOut
                }
            }
            try check(ticket)
            reply = try await raw(method, path, token: state.session!.accessToken, body: body, query: query); try check(ticket)
        }
        if reply.status == 401 { try clearLocal(); throw ClientError.signedOut }
        if reply.status == 403 { epoch += 1; clearViews(); state.workspaceID = ""; try save(); throw ClientError.denied }
        return try result(reply)
    }
    func authenticate(base: String, email: String, password: String, name: String? = nil) async throws {
        guard state.session == nil else { throw ClientError.invalid("Sign out before changing accounts.") }
        state.base = try Wire.base(base).absoluteString; epoch += 1; let start = epoch
        var body: [String: JSONValue] = ["email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)), "password": .string(password)]
        if let name { body["displayName"] = .string(name) }
        let value = try result(try await raw("POST", name == nil ? "/auth/login" : "/auth/register", body: .object(body)))
        guard epoch == start, state.session == nil else { throw ClientError.changedScope }
        let session = try value.decoded(AccountSession.self); try session.validate()
        state.session = session; state.workspaceID = ""; state.device = nil; state.pendingStop = nil; try save()
        try await refresh()
    }
    func recovery(base: String, action: String, email: String = "", token: String = "", password: String = "") async throws {
        guard ["forgot", "reset", "verify"].contains(action) else { throw ClientError.invalid("Invalid account action.") }
        let origin = try Wire.base(base), ticket = epoch
        let path = action == "forgot" ? "/auth/password/forgot" : action == "reset" ? "/auth/password/reset" : "/auth/verification/confirm"
        let body: JSONValue = action == "forgot" ? .object(["email": .string(email)]) : action == "reset" ? .object(["token": .string(token), "password": .string(password)]) : .object(["token": .string(token)])
        _ = try result(try await transport.send(base: origin, method: "POST", path: path, query: [:], token: nil, body: body))
        guard ticket == epoch else { throw ClientError.changedScope }
    }
    func refresh() async throws {
        let ticket = try scope()
        let me = try await account("GET", "/auth/me"); try check(ticket); user = me
        let spaces = try await account("GET", "/workspaces"); try check(ticket); workspaces = spaces.values
        let disclosure = try result(try await raw("GET", "/privacy/disclosures")); try check(ticket); disclosures = disclosure
        if !state.workspaceID.isEmpty && !workspaces.contains(where: { $0["id"].text == state.workspaceID }) { epoch += 1; state.workspaceID = ""; devices = []; computers = []; commands = [:]; family = .null; child = .null; report = .null; try save(); return }
        guard !state.workspaceID.isEmpty else { return }
        let list = try await account("GET", "/workspaces/\(try Wire.uuid(state.workspaceID))/devices"); try check(ticket); devices = list.values
        if let binding = state.device, let current = devices.first(where: { $0["id"].text == binding.id }), let gen = current["generation"].integer {
            if current["state"].text != "ACTIVE" { state.device = nil }
            else { state.device?.generation = gen }; try save()
        }
    }
    func selectWorkspace(_ id: String) async throws {
        let id = try Wire.uuid(id); guard workspaces.contains(where: { $0["id"].text == id }) else { throw ClientError.denied }
        epoch += 1; clearViews(); state.workspaceID = id; try save()
        _ = try await account("POST", "/workspaces/\(id)/select", body: .object([:])); try await refresh()
    }
    func signOut() async throws {
        // Credentials are cleared locally even when the logout response is lost.
        let token = state.session?.accessToken, base = state.base
        try clearLocal()
        if let token { _ = try? await transport.send(base: Wire.base(base), method: "POST", path: "/auth/logout", query: [:], token: token, body: nil) }
    }
    func updateProfile(_ name: String) async throws { user = try await account("PATCH", "/auth/me", body: .object(["displayName": .string(name)])) }
    func verificationEmail() async throws { _ = try await account("POST", "/auth/verification/request") }
    func appearance(theme: String, reducedMotion: Bool) async throws { guard ["SYSTEM", "LIGHT", "DARK"].contains(theme) else { throw ClientError.invalid("Invalid appearance.") }; _ = try await account("PATCH", "/auth/preferences", body: .object(["theme": .string(theme), "reducedMotion": .bool(reducedMotion)])); try await refresh() }
    func sessions() async throws -> JSONValue { try await account("GET", "/auth/sessions") }
    func revokeOtherSessions() async throws { _ = try await account("DELETE", "/auth/sessions") }
    func exportPersonal(password: String) async throws -> JSONValue { try await account("POST", "/privacy/export", body: .object(["password": .string(password)])) }
    func deleteAccount(password: String) async throws { _ = try await account("DELETE", "/privacy/account", body: .object(["password": .string(password), "confirmation": .string("DELETE")])); try clearLocal() }
    private func workspacePath() throws -> String { guard !state.workspaceID.isEmpty else { throw ClientError.invalid("Select a workspace first.") }; return "/workspaces/\(try Wire.uuid(state.workspaceID))" }
    func enrol(name: String, accepted: Bool) async throws {
        guard accepted else { throw ClientError.invalid("Accept device-enrolment-v1 first.") }
        let ticket = try scope(); let path = try workspacePath()
        guard state.device == nil else { throw ClientError.invalid("Unenrol or clear the existing installation binding first.") }
        _ = path
        let code = try await account("POST", "/devices/enrolments", body: .object(["workspaceId": .string(ticket.workspaceID), "installationId": .string(state.installationID), "platform": .string("IOS")]))
        let token = try code.requiredText("token")
        let value = try await account("POST", "/devices/enrol", body: .object(["token": .string(token), "name": .string(name), "accepted": .bool(true), "disclosureVersion": .string("device-enrolment-v1")]))
        try check(ticket)
        let device = value["device"], binding = DeviceBinding(id: try device.requiredText("id"), workspaceID: try device.requiredText("workspaceId"), ownerID: try device.requiredText("registeredById"), token: try value.requiredText("deviceToken"), generation: device["generation"].integer ?? 0)
        try binding.validate(); guard binding.ownerID == ticket.userID, binding.workspaceID == ticket.workspaceID else { throw ClientError.changedScope }
        state.device = binding; try save(); try await refresh()
    }
    private func device(_ method: String, suffix: String, body: JSONValue? = nil) async throws -> JSONValue {
        let ticket = try scope(); guard let binding = state.device, binding.ownerID == ticket.userID, binding.workspaceID == ticket.workspaceID else { throw ClientError.invalid("Pair this installation in the selected workspace first.") }
        let reply = try await raw(method, "/devices/\(try Wire.uuid(binding.id))\(suffix)", token: binding.token, body: body); try check(ticket)
        guard state.device == binding else { throw ClientError.changedScope }
        if reply.status == 401 { state.device = nil; try save(); throw ClientError.unavailable("Device credentials were revoked. Pair again.") }
        return try result(reply)
    }
    func heartbeat() async throws {
        let config = try await device("GET", suffix: "/configuration")
        guard let gen = config["generation"].integer, gen > 0, let binding = state.device else { throw ClientError.invalid("Invalid device configuration.") }
        let report = Wire.capabilities(workspaceID: binding.workspaceID, deviceID: binding.id)
        _ = try await device("POST", suffix: "/heartbeat", body: .object(["generation": .int(gen), "applicationVersion": .string("0.12.0"), "permissionStatus": .string("unknown"), "monitoringHealth": .string("unknown"), "batteryOptimizationStatus": .string("not_applicable"), "capabilityReport": report]))
        state.device?.generation = gen; try save(); try await refresh()
    }
    func deviceAction(_ action: String, id: String) async throws {
        let id = try Wire.uuid(id)
        let route: (String, String)
        switch action {
        case "pause": route = ("POST", "/pause")
        case "revoke": route = ("DELETE", "/consent")
        case "unenrol": route = ("POST", "/unenrol")
        case "erase": route = ("DELETE", "/data")
        case "remove": route = ("DELETE", "")
        default: throw ClientError.invalid("Unknown device action.")
        }
        _ = try await account(route.0, "/devices/\(id)\(route.1)")
        if state.device?.id == id { state.device = nil; try save() }; try await refresh()
    }
    func usage(deviceID: String, period: String, metric: String) async throws {
        guard ["mobile_data_bytes", "wifi_data_bytes", "screen_time_seconds", "application_foreground_seconds"].contains(metric) else { throw ClientError.invalid("Invalid usage metric.") }
        let ticket = try scope(), path = try workspacePath(); let timezone = workspaces.first(where: { $0["id"].text == ticket.workspaceID })?["timezone"].text ?? "UTC"
        let dates = try Wire.dates(period: period, timezone: timezone)
        let value = try await account("GET", path + "/monitoring/usage", query: ["from": dates.0, "to": dates.1, "period": period, "metric": metric, "deviceId": try Wire.uuid(deviceID)])
        try check(ticket); report = value
    }
    func loadAlerts() async throws {
        let ticket = try scope(), path = try workspacePath() + "/monitoring"
        let r = try await account("GET", path + "/rules"), a = try await account("GET", path + "/alerts"), n = try await account("GET", path + "/notifications"), p = try await account("GET", "/notifications/preferences")
        try check(ticket); rules = r.values; alerts = a.values; notifications = n.values; preferences = p
    }
    func createRule(kind: String, metric: String, threshold: Double, period: String, quality: String, deviceID: String) async throws {
        guard ["threshold", "device_offline", "permission_revoked", "not_reporting"].contains(kind), ["mobile_data_bytes", "wifi_data_bytes", "screen_time_seconds", "application_foreground_seconds"].contains(metric), ["day", "week", "month"].contains(period), ["measured", "estimated"].contains(quality), threshold.isFinite, threshold > 0, threshold <= 9007199254 else { throw ClientError.invalid("Choose a valid rule and positive threshold.") }
        var body: [String: JSONValue] = ["kind": .string(kind), "period": .string(period), "threshold": .number(threshold), "severity": .string("warning"), "channels": .strings(["in_app"]), "enabled": .bool(true)]
        if kind == "threshold" { body["metric"] = .string(metric); body["quality"] = .string(quality) }
        if !deviceID.isEmpty { body["deviceId"] = .string(try Wire.uuid(deviceID)) }
        _ = try await account("POST", try workspacePath() + "/monitoring/rules", body: .object(body)); try await loadAlerts()
    }
    func notificationPreference(inApp: Bool) async throws { _ = try await account("PATCH", "/notifications/preferences", body: .object(["inApp": .bool(inApp), "push": .bool(false)])); try await loadAlerts() }
    func acknowledge(_ id: String) async throws { _ = try await account("POST", try workspacePath() + "/monitoring/alerts/\(Wire.uuid(id))/acknowledge"); try await loadAlerts() }
    func removeRule(_ id: String) async throws { _ = try await account("DELETE", try workspacePath() + "/monitoring/rules/\(Wire.uuid(id))"); try await loadAlerts() }
    func familyOverview(profileID: String? = nil) async throws {
        let ticket = try scope(), path = try workspacePath() + "/family"
        guard workspaces.first(where: { $0["id"].text == ticket.workspaceID })?["type"].text == "FAMILY" else { family = .null; child = .null; return }
        let prior = profileID ?? child["profile"]["id"].text
        let overview = try await account("GET", path); try check(ticket); family = overview; child = .null
        let profiles = overview["profiles"].values
        guard let selected = profiles.first(where: { $0["id"].text == prior }) ?? profiles.first else { return }
        let value = try await account("GET", path + "/profiles/\(Wire.uuid(selected["id"].text))"); try check(ticket); child = value
    }
    private func childPath() throws -> String { try workspacePath() + "/family/profiles/\(Wire.uuid(child["profile"]["id"].text))" }
    func shareWithChild(accepted: Bool) async throws {
        guard accepted, let binding = state.device, binding.workspaceID == state.workspaceID else { throw ClientError.invalid("Accept family-sharing-v1 for this paired device.") }
        _ = try await account("POST", try childPath() + "/devices", body: .object(["deviceId": .string(binding.id), "accepted": .bool(true), "disclosureVersion": .string("family-sharing-v1")]))
        try await familyOverview()
    }
    func withdrawFamily(deviceID: String) async throws { _ = try await account("DELETE", "/devices/\(Wire.uuid(deviceID))/family-assignment"); try await familyOverview() }
    func familyTime(id: String, minutes: Int, reason: String, direct: Bool) async throws {
        guard (1...120).contains(minutes), !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, reason.count <= 200, let revision = child["policy"]["revision"].integer else { throw ClientError.invalid("Choose a current policy, 1–120 minutes and a short reason.") }
        _ = try await account("POST", try childPath() + (direct ? "/overrides" : "/requests"), body: .object(["id": .string(try Wire.uuid(id)), "minutes": .int(minutes), "reason": .string(reason), "policyRevision": .int(revision)])); try await familyOverview()
    }
    func familyDecision(id: String, decision: String) async throws { guard ["approved", "rejected", "cancelled"].contains(decision) else { throw ClientError.invalid("Invalid decision.") }; _ = try await account("PATCH", try childPath() + "/requests/\(Wire.uuid(id))", body: .object(["decision": .string(decision)])); try await familyOverview() }
    func desktop() async throws {
        let ticket = try scope(), path = try workspacePath()
        let value = try await account("GET", path + "/developer"); let computers = try value.decoded([PairedComputer].self)
        guard computers.count <= 200 else { throw ClientError.invalid("Computer inventory limit exceeded.") }; for c in computers { try c.validate() }
        var history: [String: [JSONValue]] = [:]
        for c in computers { history[c.id] = try await account("GET", path + "/agents/\(Wire.uuid(c.id))/commands").values }
        try check(ticket); self.computers = computers; commands = history
        if let pending = state.pendingStop, pending.userID == ticket.userID, pending.workspaceID == ticket.workspaceID,
           history[pending.agentID]?.contains(where: { $0["requestId"].text == pending.requestID && $0["agentId"].text == pending.agentID }) == true { state.pendingStop = nil; try save() }
    }
    func prepareStop(computerID: String, service: RemoteService, mode: String, children: Bool, confirmed: Bool, now: Date = Date()) throws -> RemoteIntent {
        let ticket = try scope(); guard confirmed, let computer = computers.first(where: { $0.id == computerID }) else { throw ClientError.invalid("Explicitly confirm a current service first.") }
        if let old = state.pendingStop, old.userID == ticket.userID, old.workspaceID == ticket.workspaceID { throw ClientError.invalid("Resolve or dismiss the previous uncertain request before creating another.") }
        let intent = RemoteIntent(userID: ticket.userID, workspaceID: ticket.workspaceID, agentID: computerID, requestID: UUID().uuidString.lowercased(), service: service, mode: mode, includeChildren: children, confirmedAt: now)
        try intent.validate(now: now, computer: computer); state.pendingStop = intent
        do { try save() } catch { state.pendingStop = nil; throw error }; return intent
    }
    func submitStop(_ intent: RemoteIntent, now: Date = Date()) async throws {
        let ticket = try scope(); guard intent.userID == ticket.userID, intent.workspaceID == ticket.workspaceID, state.pendingStop == intent,
              let computer = computers.first(where: { $0.id == intent.agentID }) else { throw ClientError.changedScope }
        try intent.validate(now: now, computer: computer)
        // Keep the exact UUID/body in Keychain on any transport/response uncertainty.
        let value = try await account("POST", try workspacePath() + "/agents/\(Wire.uuid(intent.agentID))/commands", body: intent.body)
        try check(ticket); guard state.pendingStop == intent else { throw ClientError.changedScope }
        guard value["requestId"].text == intent.requestID else { throw ClientError.invalid("Command acknowledgement did not match the confirmed intent.") }
        state.pendingStop = nil; try save(); try await desktop()
    }
    func dismissPendingStop() throws { state.pendingStop = nil; try save() }
    func cancelCommand(agentID: String, commandID: String) async throws { _ = try await account("POST", try workspacePath() + "/agents/\(Wire.uuid(agentID))/commands/\(Wire.uuid(commandID))/cancel"); try await desktop() }
}
