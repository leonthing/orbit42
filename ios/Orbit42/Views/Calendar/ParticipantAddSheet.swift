import SwiftUI

/// 아직 서버에 붙이지 못한 참석자 — 새 일정은 저장 전이라 event_key 가 없다.
/// 일정이 만들어진 직후 이 목록대로 초대를 보낸다.
struct PendingParticipant: Identifiable, Equatable {
    enum Target: Equatable {
        case user(username: String, displayName: String?, avatarUrl: String?)
        case email(String)
    }

    let target: Target

    var id: String {
        switch target {
        case .user(let username, _, _): return "user:\(username)"
        case .email(let email): return "email:\(email)"
        }
    }

    var label: String {
        switch target {
        case .user(let username, let displayName, _):
            if let displayName, !displayName.isEmpty { return displayName }
            return "@\(username)"
        case .email(let email):
            return email
        }
    }

    var detail: String {
        switch target {
        case .user(let username, _, _): return "@\(username)"
        case .email: return "메일로 초대"
        }
    }

    var avatarURL: URL? {
        guard case .user(_, _, let avatarUrl) = target else { return nil }
        return avatarUrl.flatMap(URL.init(string:))
    }

    var username: String? {
        if case .user(let username, _, _) = target { return username }
        return nil
    }

    var email: String? {
        if case .email(let email) = target { return email }
        return nil
    }
}

/// 참석자 추가 — orbit42 사용자 검색 태그 또는 이메일 초대.
/// 검색은 통합 검색 API(/api/v1/search)의 사람 결과를 쓴다.
struct ParticipantAddSheet: View {
    /// 저장된 일정은 고르는 즉시 서버에 붙이고(attach), 아직 저장 전인 새 일정은
    /// 목록에만 담아 뒀다가(collect) 일정이 만들어진 뒤 한꺼번에 초대한다.
    enum Mode {
        case attach(
            eventId: String,
            snapshot: (title: String, startAt: String, endAt: String?, allDay: Bool)
        )
        case collect(Binding<[PendingParticipant]>)
    }

    let mode: Mode
    /// attach 모드에서 추가 성공 시 최신 참석자 목록 전달.
    var onUpdated: ([EventParticipant]) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [SearchUser] = []
    @State private var isSearching = false
    @State private var submittingKey: String?
    @State private var errorMessage: String?
    @State private var pendingSearch: Task<Void, Never>?

    private var trimmed: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isEmail: Bool {
        trimmed.contains("@") && trimmed.contains(".")
    }

    private var collected: Binding<[PendingParticipant]>? {
        if case .collect(let binding) = mode { return binding }
        return nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                List {
                    Section {
                        TextField("이름, @핸들 또는 이메일", text: $query)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .foregroundStyle(Theme.primaryText)
                            .onChange(of: query) {
                                queryChanged()
                            }
                    } footer: {
                        Text("가입자는 알림과 메일로, 비가입자는 초대 메일로 알려드려요.")
                    }
                    .listRowBackground(Theme.surface)

                    if isEmail {
                        Section {
                            Button {
                                invite(email: trimmed)
                            } label: {
                                HStack {
                                    Label("\(trimmed) 이메일로 초대", systemImage: "envelope")
                                        .foregroundStyle(Theme.accent)
                                        .lineLimit(1)
                                    Spacer()
                                    if submittingKey == trimmed {
                                        ProgressView().tint(Theme.secondaryText)
                                    }
                                }
                            }
                            .disabled(submittingKey != nil)
                        }
                        .listRowBackground(Theme.surface)
                    }

                    if !results.isEmpty {
                        Section("사람") {
                            ForEach(results) { user in
                                Button {
                                    invite(user: user)
                                } label: {
                                    HStack(spacing: 10) {
                                        DiscoverAvatar(
                                            url: user.avatarURL,
                                            name: user.preferredName,
                                            size: 34
                                        )
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(user.preferredName)
                                                .font(.subheadline.weight(.medium))
                                                .foregroundStyle(Theme.primaryText)
                                            Text("@\(user.username)")
                                                .font(.caption)
                                                .foregroundStyle(Theme.accent)
                                        }
                                        Spacer()
                                        if submittingKey == user.username {
                                            ProgressView().tint(Theme.secondaryText)
                                        } else {
                                            Image(systemName: "plus.circle")
                                                .foregroundStyle(Theme.accent)
                                        }
                                    }
                                }
                                .disabled(submittingKey != nil)
                            }
                        }
                        .listRowBackground(Theme.surface)
                    } else if isSearching {
                        Section {
                            HStack {
                                Spacer()
                                ProgressView().tint(Theme.accent)
                                Spacer()
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }

                    // 담아 둔 참석자는 여기서도 보여 준다 — 여러 명을 연달아
                    // 고르는 동안 누구를 담았는지 확인할 데가 있어야 한다.
                    if let collected, !collected.wrappedValue.isEmpty {
                        Section("담은 참석자") {
                            ForEach(collected.wrappedValue) { pending in
                                HStack(spacing: 10) {
                                    DiscoverAvatar(
                                        url: pending.avatarURL,
                                        name: pending.label,
                                        size: 30
                                    )
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(pending.label)
                                            .font(.subheadline)
                                            .foregroundStyle(Theme.primaryText)
                                            .lineLimit(1)
                                        Text(pending.detail)
                                            .font(.caption)
                                            .foregroundStyle(Theme.secondaryText)
                                            .lineLimit(1)
                                    }
                                    Spacer()
                                    Button {
                                        collected.wrappedValue.removeAll { $0.id == pending.id }
                                    } label: {
                                        Image(systemName: "minus.circle")
                                            .foregroundStyle(Theme.secondaryText)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }

                    if let errorMessage {
                        Section {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("참석자 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(collected == nil ? "닫기" : "완료") { dismiss() }
                }
            }
        }
    }

    // MARK: - 검색 (300ms 디바운스)

    private func queryChanged() {
        pendingSearch?.cancel()
        errorMessage = nil
        let text = trimmed
        guard !text.isEmpty, !isEmail else {
            results = []
            isSearching = false
            return
        }
        isSearching = true
        pendingSearch = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            var allowed = CharacterSet.urlQueryAllowed
            allowed.remove(charactersIn: "&=+?#")
            let encoded = text.addingPercentEncoding(withAllowedCharacters: allowed) ?? text
            let response: SearchResponse? = try? await APIClient.shared.get(
                "/api/v1/search?q=\(encoded)"
            )
            guard !Task.isCancelled else { return }
            results = response?.users ?? []
            isSearching = false
        }
    }

    // MARK: - 초대

    private func invite(user: SearchUser) {
        add(
            PendingParticipant(
                target: .user(
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl
                )
            )
        )
    }

    private func invite(email: String) {
        add(PendingParticipant(target: .email(email)))
    }

    private func add(_ pending: PendingParticipant) {
        errorMessage = nil
        if let collected {
            guard !collected.wrappedValue.contains(where: { $0.id == pending.id }) else {
                errorMessage = "이미 담은 사람이에요."
                return
            }
            collected.wrappedValue.append(pending)
            query = ""
            results = []
            return
        }

        guard case .attach(let eventId, let snapshot) = mode else { return }
        let key = pending.username ?? pending.email ?? ""
        guard submittingKey == nil else { return }
        submittingKey = key
        Task {
            defer { submittingKey = nil }
            do {
                let response: ParticipantsResponse = try await APIClient.shared.post(
                    "/api/v1/calendar/events/\(eventId)/participants",
                    body: AddParticipantRequest(
                        username: pending.username,
                        email: pending.email,
                        title: snapshot.title,
                        startAt: snapshot.startAt,
                        endAt: snapshot.endAt,
                        allDay: snapshot.allDay
                    )
                )
                onUpdated(response.participants)
                if pending.email != nil { query = "" }
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "초대하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}
