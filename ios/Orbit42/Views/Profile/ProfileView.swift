import SwiftUI

/// 프로필 탭 — 설정 허브.
/// 헤더(아바타/이름/이메일/소개) + 프로필 편집 / 내 캘린더 / Google 캘린더 연동 /
/// 웹 설정 안내 / 로그아웃 + 앱 버전.
struct ProfileView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var showingEditProfile = false
    @State private var showingLogoutConfirm = false

    var body: some View {
        NavigationStack {
            List {
                if let user = auth.user {
                    headerSection(user)
                }

                menuSection

                logoutSection
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("프로필")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingEditProfile) {
                if let user = auth.user {
                    EditProfileSheet(user: user)
                }
            }
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
    }

    // MARK: - 헤더

    private func headerSection(_ user: User) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    avatar(for: user)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(user.preferredName)
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text("@\(user.username)")
                            .font(.subheadline)
                            .foregroundStyle(Theme.accent)
                        if let email = user.email, !email.isEmpty {
                            HStack(spacing: 4) {
                                Text(email)
                                if user.emailVerified {
                                    Image(systemName: "checkmark.seal.fill")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                        }
                    }
                }

                if let bio = user.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            .padding(.vertical, 8)
        }
        .listRowBackground(Theme.surface)
    }

    private func avatar(for user: User) -> some View {
        AsyncImage(url: user.avatarURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.accent.opacity(0.25)
                    Text(String(user.preferredName.prefix(1)).uppercased())
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(Circle())
    }

    // MARK: - 설정 메뉴

    private var menuSection: some View {
        Section {
            Button {
                showingEditProfile = true
            } label: {
                menuRow(icon: "pencil", title: "프로필 편집")
            }

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
        } footer: {
            Text("근무시간·알림·소셜 연동 설정은 웹에서 할 수 있어요")
                .foregroundStyle(Theme.secondaryText)
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
    ProfileView()
        .environment(AuthViewModel())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
