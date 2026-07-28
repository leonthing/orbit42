import SwiftUI

/// 공개 링크 페이지 테마 — 웹 `lib/link-themes.ts` 와 같은 키·색을 쓴다.
/// SNS 바이오에 걸어두는 orbit42.org/{username} 페이지의 색이다.
struct LinkThemeOption: Identifiable, Sendable {
    let key: String
    let label: String
    /// 미리보기 그라디언트 (위 → 아래)
    let gradient: [Color]
    let surface: Color
    let accent: Color

    var id: String { key }
}

enum LinkThemeCatalog {
    private static func hex(_ value: String) -> Color {
        Color(hexString: value) ?? Theme.accent
    }

    static let all: [LinkThemeOption] = [
        LinkThemeOption(
            key: "default", label: "기본",
            gradient: [hex("#12121a"), hex("#16161f")],
            surface: Color.white.opacity(0.06), accent: hex("#6366f1")
        ),
        LinkThemeOption(
            key: "light", label: "라이트",
            gradient: [hex("#ffffff"), hex("#f3f4f8")],
            surface: Color.black.opacity(0.05), accent: hex("#6366f1")
        ),
        LinkThemeOption(
            key: "midnight", label: "미드나잇",
            gradient: [hex("#05060f"), hex("#0d1030")],
            surface: Color.white.opacity(0.07), accent: hex("#818cf8")
        ),
        LinkThemeOption(
            key: "sunset", label: "선셋",
            gradient: [hex("#f97316"), hex("#ea580c")],
            surface: Color.white.opacity(0.16), accent: .white
        ),
        LinkThemeOption(
            key: "forest", label: "포레스트",
            gradient: [hex("#064e3b"), hex("#022c22")],
            surface: Color.white.opacity(0.10), accent: hex("#34d399")
        ),
        LinkThemeOption(
            key: "rose", label: "로즈",
            gradient: [hex("#fdf2f8"), hex("#fce7f3")],
            surface: Color.black.opacity(0.05), accent: hex("#db2777")
        ),
        LinkThemeOption(
            key: "ocean", label: "오션",
            gradient: [hex("#0c4a6e"), hex("#082f49")],
            surface: Color.white.opacity(0.10), accent: hex("#38bdf8")
        ),
        LinkThemeOption(
            key: "mono", label: "모노",
            gradient: [hex("#fafafa"), hex("#e7e7e9")],
            surface: Color.black.opacity(0.06), accent: hex("#111113")
        ),
    ]
}

/// `PATCH /api/v1/me` — 링크 페이지 테마만 변경.
private struct UpdateLinkThemeRequest: Encodable {
    let linkTheme: String
}

/// 공개 링크 페이지 테마 선택 — 설정 > 공개 링크 테마.
struct LinkThemeView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var selected: String = "default"
    @State private var didSync = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("SNS에 걸어두는 내 링크 페이지의 색이에요. 방문자에게는 기기 설정과 무관하게 항상 이 색으로 보여요.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)

                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(LinkThemeCatalog.all) { option in
                            Button {
                                select(option)
                            } label: {
                                card(option)
                            }
                            .buttonStyle(.plain)
                            .disabled(isSaving)
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    if let username = auth.user?.username,
                       let url = URL(string: "https://orbit42.org/\(username)") {
                        Link(destination: url) {
                            HStack {
                                Label("내 링크 페이지 미리보기", systemImage: "safari")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.accent)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                            .padding(14)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("공개 링크 테마")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !didSync else { return }
            selected = auth.user?.linkTheme ?? "default"
            didSync = true
        }
    }

    private func card(_ option: LinkThemeOption) -> some View {
        VStack(spacing: 0) {
            ZStack {
                LinearGradient(
                    colors: option.gradient,
                    startPoint: .top,
                    endPoint: .bottom
                )
                VStack(spacing: 6) {
                    Circle()
                        .fill(option.surface)
                        .frame(width: 22, height: 22)
                    Capsule()
                        .fill(option.surface)
                        .frame(width: 52, height: 8)
                    Capsule()
                        .fill(option.accent)
                        .frame(width: 44, height: 12)
                }
            }
            .frame(height: 96)

            HStack(spacing: 4) {
                Text(option.label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                if selected == option.key {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.accent)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Theme.surface)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(
                    selected == option.key ? Theme.accent : Theme.fill(0.12),
                    lineWidth: selected == option.key ? 2 : 1
                )
        )
    }

    private func select(_ option: LinkThemeOption) {
        guard option.key != selected, !isSaving else { return }
        let previous = selected
        selected = option.key
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let response: MeResponse = try await APIClient.shared.patch(
                    "/api/v1/me",
                    body: UpdateLinkThemeRequest(linkTheme: option.key)
                )
                auth.updateUser(response.user)
            } catch let apiError as APIError {
                selected = previous
                errorMessage = apiError.errorDescription
            } catch {
                selected = previous
                errorMessage = "테마를 저장하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}
