import SwiftUI

/// 설정 화면 — 프로필 탭 우상단 톱니에서 push.
/// 묶음(개선-44): 계정 / 캘린더·연결 / 예약 링크 / 알림·화면 / 정보·지원 / 로그아웃 + 앱 버전.
/// (근로시간·급여·수면은 자산 탭 > 자산 설정에서 관리)
struct SettingsView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var showingLogoutConfirm = false
    @State private var showingFeedback = false

    // 프로필 비공개 토글 상태 — auth.user 값으로 최초 1회 동기화 후 로컬로 관리,
    // PATCH 실패 시 원복한다.
    @State private var isPrivate = false
    @State private var didSyncPrivacy = false
    @State private var isSavingPrivacy = false
    @State private var privacyErrorMessage: String?

    var body: some View {
        List {
            accountSection
            calendarSection
            bookingSection
            notificationSection
            supportSection
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
        .alert(
            "안내",
            isPresented: Binding(
                get: { privacyErrorMessage != nil },
                set: { if !$0 { privacyErrorMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(privacyErrorMessage ?? "")
        }
        .onAppear {
            if !didSyncPrivacy {
                isPrivate = auth.user?.isPrivate ?? false
                didSyncPrivacy = true
            }
        }
        .sheet(isPresented: $showingFeedback) {
            FeedbackSheet()
        }
    }

    // MARK: - 설정 메뉴 (개선-44: 13줄 한 묶음 → 주제별 묶음, 없앤 항목 없음)

    private var accountSection: some View {
        Section {
            NavigationLink {
                AccountView()
            } label: {
                menuRow(icon: "person.crop.circle", title: "계정")
            }
            .accessibilityIdentifier("settings.account")

            Toggle(isOn: Binding(
                get: { isPrivate },
                set: { newValue in
                    guard newValue != isPrivate else { return }
                    isPrivate = newValue
                    Task { await updatePrivacy(newValue) }
                }
            )) {
                menuRow(icon: "lock", title: "프로필 비공개")
            }
            .tint(Theme.accent)
            .disabled(isSavingPrivacy)
            .accessibilityIdentifier("settings.private")

            NavigationLink {
                BlockedUsersView()
            } label: {
                menuRow(icon: "hand.raised", title: "차단 관리")
            }
            .accessibilityIdentifier("settings.blocked")
        } header: {
            Text("계정")
        } footer: {
            Text("프로필 비공개를 켜면 검색과 프로필 조회, 다른 사람의 오르빗에서 숨겨져요. 직접 공유한 예약 링크는 계속 동작해요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    private var calendarSection: some View {
        Section("캘린더·연결") {
            NavigationLink {
                CalendarSettingsView()
            } label: {
                menuRow(icon: "calendar", title: "내 캘린더")
            }
            .accessibilityIdentifier("settings.calendars")

            NavigationLink {
                GoogleSettingsView()
            } label: {
                menuRow(icon: "arrow.triangle.2.circlepath", title: "Google 캘린더")
            }
            .accessibilityIdentifier("settings.google")

            NavigationLink {
                PeopleImportSettingsView()
            } label: {
                menuRow(icon: "person.2.circle", title: "사람 찾기")
            }
            .accessibilityIdentifier("settings.peopleImport")

            NavigationLink {
                LocationBuffersView()
            } label: {
                menuRow(icon: "figure.walk", title: "이동시간 버퍼")
            }
            .accessibilityIdentifier("settings.buffers")
        }
        .listRowBackground(Theme.surface)
    }

    private var bookingSection: some View {
        Section("예약 링크") {
            NavigationLink {
                PaymentInstructionsView()
            } label: {
                menuRow(icon: "banknote", title: "결제 안내 (계좌이체)")
            }
            .accessibilityIdentifier("settings.payment")

            NavigationLink {
                ServicesView()
            } label: {
                menuRow(icon: "list.bullet.rectangle", title: "서비스")
            }
            .accessibilityIdentifier("settings.services")

            NavigationLink {
                LinkThemeView()
            } label: {
                menuRow(icon: "paintpalette", title: "공개 링크 테마")
            }
            .accessibilityIdentifier("settings.linkTheme")

            NavigationLink {
                CustomLinksView()
            } label: {
                menuRow(icon: "link", title: "링크 페이지 버튼")
            }
            .accessibilityIdentifier("settings.customLinks")
        }
        .listRowBackground(Theme.surface)
    }

    private var notificationSection: some View {
        Section("알림·화면") {
            NavigationLink {
                NotificationPrefsView()
            } label: {
                menuRow(icon: "bell", title: "알림 설정")
            }
            .accessibilityIdentifier("settings.notifications")

            Picker(selection: $appearanceMode) {
                Text("시스템 설정 따름").tag("system")
                Text("라이트").tag("light")
                Text("다크").tag("dark")
            } label: {
                menuRow(icon: "circle.lefthalf.filled", title: "화면 모드")
            }
            .tint(Theme.secondaryText)
            .accessibilityIdentifier("settings.appearance")
        }
        .listRowBackground(Theme.surface)
    }

    private var supportSection: some View {
        Section("정보·지원") {
            if let referralURL {
                ShareLink(item: referralURL) {
                    menuRow(icon: "person.badge.plus", title: "친구 초대")
                }
                .accessibilityIdentifier("settings.invite")
            }

            Button {
                showingFeedback = true
            } label: {
                menuRow(icon: "paperplane", title: "피드백 보내기")
            }
            .accessibilityIdentifier("settings.feedback")

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
                .accessibilityIdentifier("settings.web")
            }

            legalLink(title: "이용약관", path: "terms")
                .accessibilityIdentifier("settings.terms")
            legalLink(title: "개인정보처리방침", path: "privacy")
                .accessibilityIdentifier("settings.privacyPolicy")
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
                .foregroundStyle(Theme.primaryText)
        }
    }

    private var webSettingsURL: URL? {
        guard let username = auth.user?.username else { return nil }
        return URL(string: "https://orbit42.org/\(username)/settings")
    }

    /// 친구 초대 추천 링크 — 이 링크로 가입하면 추천인과 자동 연결된다.
    /// 프로필 공유와 같은 이유로 URL 만 넘긴다 (문구를 합치면 붙여넣기에 한글이 섞인다).
    private var referralURL: URL? {
        guard let username = auth.user?.username else { return nil }
        return URL(string: "https://orbit42.org/signup?ref=\(username)")
    }

    private func updatePrivacy(_ newValue: Bool) async {
        isSavingPrivacy = true
        defer { isSavingPrivacy = false }

        do {
            let response: MeResponse = try await APIClient.shared.patch(
                "/api/v1/me",
                body: UpdatePrivacyRequest(isPrivate: newValue)
            )
            auth.updateUser(response.user)
            isPrivate = response.user.isPrivate ?? newValue
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch {
            // 실패: 토글 원복 + 안내
            isPrivate = !newValue
            privacyErrorMessage = (error as? APIError)?.errorDescription
                ?? "설정을 저장하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 화면 모드

    @AppStorage("appearanceMode") private var appearanceMode = "system"

    // MARK: - 약관·정책

    private func legalLink(title: String, path: String) -> some View {
        Link(destination: URL(string: "https://orbit42.org/\(path)")!) {
            HStack {
                menuRow(icon: "doc.text", title: title)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
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

/// PATCH /api/v1/me — 프로필 비공개 설정만 변경.
private struct UpdatePrivacyRequest: Encodable {
    let isPrivate: Bool
}

#Preview {
    NavigationStack {
        SettingsView()
    }
    .environment(AuthViewModel())
    .tint(Theme.accent)
}
