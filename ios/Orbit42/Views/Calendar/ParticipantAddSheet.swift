import SwiftUI

/// 참석자 추가 — orbit42 사용자 검색 태그 또는 이메일 초대.
/// 검색은 통합 검색 API(/api/v1/search)의 사람 결과를 쓴다.
struct ParticipantAddSheet: View {
    let eventId: String
    let snapshot: (title: String, startAt: String, endAt: String?, allDay: Bool)
    /// 추가 성공 시 최신 참석자 목록 전달.
    let onUpdated: ([EventParticipant]) -> Void

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
                            .foregroundStyle(.white)
                            .onChange(of: query) {
                                queryChanged()
                            }
                    } footer: {
                        Text("가입자는 알림으로, 비가입자는 이메일로 초대돼요.")
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
                                    invite(username: user.username)
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
                                                .foregroundStyle(.white)
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
                    Button("닫기") { dismiss() }
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

    private func invite(username: String? = nil, email: String? = nil) {
        let key = username ?? email ?? ""
        guard submittingKey == nil else { return }
        errorMessage = nil
        submittingKey = key
        Task {
            defer { submittingKey = nil }
            do {
                let response: ParticipantsResponse = try await APIClient.shared.post(
                    "/api/v1/calendar/events/\(eventId)/participants",
                    body: AddParticipantRequest(
                        username: username,
                        email: email,
                        title: snapshot.title,
                        startAt: snapshot.startAt,
                        endAt: snapshot.endAt,
                        allDay: snapshot.allDay
                    )
                )
                onUpdated(response.participants)
                if email != nil { query = "" }
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "초대하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}
