import SwiftUI

/// 새 캘린더를 만들 때 "함께 쓸 사람"을 미리 골라두는 섹션.
///
/// 캘린더가 아직 없으니 바로 초대할 수 없다 — 여기서는 고르기만 하고,
/// 저장 시점에 생성된 캘린더 id 로 `CalendarEditorSheet` 가 초대를 보낸다.
/// (기존 캘린더 편집은 id 가 있으므로 `CalendarShareView` 에서 즉시 초대한다)
struct CalendarInvitePicker: View {
    @Binding var selected: [SearchUser]
    @Binding var role: String

    @State private var query = ""
    @State private var results: [SearchUser] = []
    @State private var isSearching = false
    @State private var pendingSearch: Task<Void, Never>?

    var body: some View {
        Section {
            ForEach(selected) { user in
                HStack(spacing: 10) {
                    DiscoverAvatar(url: user.avatarURL, name: user.preferredName, size: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(user.preferredName)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.primaryText)
                        Text("@\(user.username)")
                            .font(.caption)
                            .foregroundStyle(Theme.accent)
                    }
                    Spacer(minLength: 0)
                    Button {
                        selected.removeAll { $0.username == user.username }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(user.preferredName) 빼기")
                }
            }

            if !selected.isEmpty {
                Picker("권한", selection: $role) {
                    Text("함께 기록").tag("editor")
                    Text("보기만").tag("viewer")
                }
                .pickerStyle(.segmented)
            }

            TextField("이름 또는 @핸들로 찾기", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(Theme.primaryText)
                .onChange(of: query) { queryChanged() }

            if isSearching {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.accent)
                    Spacer()
                }
            }

            ForEach(visibleResults) { user in
                Button {
                    selected.append(user)
                    query = ""
                    results = []
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
                        Image(systemName: "plus.circle")
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
        } header: {
            Text("함께 쓸 사람(선택)")
        } footer: {
            Text("초대한 사람도 이 캘린더에 일정을 기록할 수 있어요. 만든 뒤에도 캘린더 편집에서 추가할 수 있어요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    private var visibleResults: [SearchUser] {
        let picked = Set(selected.map(\.username))
        return results.filter { !picked.contains($0.username) }
    }

    private func queryChanged() {
        pendingSearch?.cancel()
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
            results = response?.users ?? []
            isSearching = false
        }
    }
}
