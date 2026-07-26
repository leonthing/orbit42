import SwiftUI

/// 설정 화면 — 프로필 탭 우상단 톱니에서 push.
/// 내 캘린더 / Google 캘린더 / 알림 설정 / 이동시간 버퍼 / 친구 초대 / 계정 /
/// 웹 설정 안내 / 로그아웃 + 앱 버전.
/// (근로시간·급여·수면은 자산 탭 > 자산 설정에서 관리)
struct SettingsView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var showingLogoutConfirm = false

    var body: some View {
        List {
            menuSection
            logoutSection
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("설정")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "로그아웃할까요?",
            isPresented: $showingLogoutConfirm,
            titleVisibility: .visible
        ) {
            Button("로그아웃", role: .destructive) {
                auth.logout()
            }
            Button("취소", role: .cancel) {}
        }
    }

    // MARK: - 설정 메뉴

    private var menuSection: some View {
        Section {
            NavigationLink {
                CalendarSettingsView()
            } label: {
                menuRow(icon: "calendar", title: "내 캘린더")
            }

            NavigationLink {
                GoogleSettingsView()
            } label: {
                menuRow(icon: "arrow.triangle.2.circlepath", title: "Google 캘린더")
            }

            NavigationLink {
                NotificationPrefsView()
            } label: {
                menuRow(icon: "bell", title: "알림 설정")
            }

            NavigationLink {
                LocationBuffersView()
            } label: {
                menuRow(icon: "figure.walk", title: "이동시간 버퍼")
            }

            if let referralText {
                // URL을 본문에 합친 단일 문자열로 공유 — item: URL + message: Text 조합은
                // 공유 시트의 "복사"가 message 텍스트만 복사하는 iOS 동작이 있다.
                ShareLink(item: referralText) {
                    menuRow(icon: "person.badge.plus", title: "친구 초대")
                }
            }

            NavigationLink {
                AccountView()
            } label: {
                menuRow(icon: "person.crop.circle", title: "계정")
            }

            if let url = webSettingsURL {
                Link(destination: url) {
                    HStack {
                        menuRow(icon: "safari", title: "웹에서 더 많은 설정")
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        }
        .listRowBackground(Theme.surface)
    }

    private func menuRow(icon: String, title: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(Theme.accent)
                .frame(width: 26)
            Text(title)
                .foregroundStyle(.white)
        }
    }

    private var webSettingsURL: URL? {
        guard let username = auth.user?.username else { return nil }
        return URL(string: "https://orbit42.org/\(username)/settings")
    }

    /// 친구 초대 추천 링크 — 이 링크로 가입하면 추천인과 자동 연결된다.
    /// 웹 ReferralLink 와 동일하게 링크를 본문 맨 앞에 둔다 (메신저 미리보기용).
    private var referralText: String? {
        guard let username = auth.user?.username else { return nil }
        return "https://orbit42.org/signup?ref=\(username)\n\nOrbit42에 초대합니다. 제 추천으로 가입하면 자동으로 연결돼요."
    }

    // MARK: - 로그아웃 + 버전

    private var logoutSection: some View {
        Section {
            Button(role: .destructive) {
                showingLogoutConfirm = true
            } label: {
                Text("로그아웃")
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        } footer: {
            Text("Orbit42 v\(appVersion)")
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
                .padding(.top, 8)
        }
        .listRowBackground(Theme.surface)
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "-"
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
    .environment(AuthViewModel())
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
