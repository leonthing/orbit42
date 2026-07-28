import SwiftUI

// MARK: - 모델

struct CalendarMembersResponse: Decodable, Sendable {
    let members: [CalendarMember]
}

struct CalendarMember: Decodable, Identifiable, Sendable {
    let id: String
    let userId: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let role: String
    let isOwner: Bool

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
    var roleLabel: String {
        isOwner ? "소유자" : (role == "editor" ? "함께 기록" : "보기만")
    }
}

struct AddMemberRequest: Encodable {
    let username: String
    let role: String
}

// MARK: - 화면

/// 캘린더 공유 관리 — 친구·가족·파트너를 초대해 같은 캘린더에 함께 기록한다.
struct CalendarShareView: View {
    let calendar: CalendarInfo

    @Environment(\.dismiss) private var dismiss
    @State private var members: [CalendarMember]?
    @State private var query = ""
    @State private var results: [SearchUser] = []
    @State private var role = "editor"
    @State private var isSearching = false
    @State private var submittingUsername: String?
    @State private var errorMessage: String?
    @State private var pendingSearch: Task<Void, Never>?
    @State private var showingLeaveConfirm = false

    /// 내가 소유자가 아니면(공유받은 캘린더) 초대 UI 대신 "나가기"를 보여준다.
    private var isSharedWithMe: Bool { calendar.sharedRole != nil }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            List {
                membersSection
                if isSharedWithMe {
                    leaveSection
                } else {
                    inviteSection
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
        .navigationTitle("함께 쓰기")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadMembers() }
        .confirmationDialog(
            "이 캘린더에서 나갈까요? 다시 초대받아야 볼 수 있어요.",
            isPresented: $showingLeaveConfirm,
            titleVisibility: .visible
        ) {
            Button("나가기", role: .destructive) { leave() }
            Button("취소", role: .cancel) {}
        }
    }

    // MARK: - 멤버

    private var membersSection: some View {
        Section {
            if let members {
                ForEach(members) { member in
                    HStack(spacing: 10) {
                        DiscoverAvatar(
                            url: member.avatarURL,
                            name: member.preferredName,
                            size: 34
                        )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(member.preferredName)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.primaryText)
                            Text("@\(member.username)")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                        }
                        Spacer(minLength: 0)
                        Text(member.roleLabel)
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        if !member.isOwner, !isSharedWithMe {
                            Button(role: .destructive) {
                                remove(member)
                            } label: {
                                Label("내보내기", systemImage: "person.badge.minus")
                            }
                        }
                    }
                }
            } else {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.accent)
                    Spacer()
                }
            }
        } header: {
            Text("함께 쓰는 사람")
        } footer: {
            Text(isSharedWithMe
                 ? "공유받은 캘린더예요. 여기에 기록한 일정은 함께 쓰는 모두에게 보여요."
                 : "초대하면 상대도 이 캘린더에 일정을 기록할 수 있어요. 가족 일정, 커플 기록, 팀 프로젝트에 좋아요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 초대

    private var inviteSection: some View {
        Section {
            TextField("이름 또는 @핸들로 찾기", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(Theme.primaryText)
                .onChange(of: query) { queryChanged() }

            Picker("권한", selection: $role) {
                Text("함께 기록").tag("editor")
                Text("보기만").tag("viewer")
            }
            .pickerStyle(.segmented)

            if isSearching {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.accent)
                    Spacer()
                }
            }
            ForEach(results) { user in
                Button {
                    invite(user.username)
                } label: {
                    HStack(spacing: 10) {
                        DiscoverAvatar(url: user.avatarURL, name: user.preferredName, size: 30)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(user.preferredName)
                                .font(.subheadline)
                                .foregroundStyle(Theme.primaryText)
                            Text("@\(user.username)")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                        }
                        Spacer()
                        if submittingUsername == user.username {
                            ProgressView().tint(Theme.secondaryText)
                        } else {
                            Image(systemName: "plus.circle")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
                .disabled(submittingUsername != nil)
            }
        } header: {
            Text("초대")
        }
        .listRowBackground(Theme.surface)
    }

    private var leaveSection: some View {
        Section {
            Button(role: .destructive) {
                showingLeaveConfirm = true
            } label: {
                Label("이 캘린더에서 나가기", systemImage: "rectangle.portrait.and.arrow.right")
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 동작

    private func loadMembers() async {
        if let response: CalendarMembersResponse = try? await APIClient.shared.get(
            "/api/v1/calendars/\(calendar.id)/members"
        ) {
            members = response.members
        } else {
            members = []
        }
    }

    private func queryChanged() {
        pendingSearch?.cancel()
        errorMessage = nil
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
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
            let memberIds = Set(members?.map(\.username) ?? [])
            results = (response?.users ?? []).filter { !memberIds.contains($0.username) }
            isSearching = false
        }
    }

    private func invite(_ username: String) {
        guard submittingUsername == nil else { return }
        errorMessage = nil
        submittingUsername = username
        Task {
            defer { submittingUsername = nil }
            do {
                let response: CalendarMembersResponse = try await APIClient.shared.post(
                    "/api/v1/calendars/\(calendar.id)/members",
                    body: AddMemberRequest(username: username, role: role)
                )
                members = response.members
                query = ""
                results = []
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "초대하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func remove(_ member: CalendarMember) {
        Task {
            if let response: CalendarMembersResponse = try? await APIClient.shared.delete(
                "/api/v1/calendars/\(calendar.id)/members?userId=\(member.userId)"
            ) {
                members = response.members
            }
        }
    }

    private func leave() {
        Task {
            let _: CalendarMembersResponse? = try? await APIClient.shared.delete(
                "/api/v1/calendars/\(calendar.id)/members"
            )
            dismiss()
        }
    }
}
