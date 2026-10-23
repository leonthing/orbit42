import SwiftUI

/// 메일 인증을 아직 안 한 사용자에게 보이는 한 줄 안내 + "인증 메일 다시 보내기" (개선-24).
/// 서버는 미인증 사용자에게 시간 요청·초대·메시지 메일을 보내지 않아서, 앱에서 다시 알려 준다.
/// 인증된 계정(Apple·Google 가입 포함)에는 아무것도 그리지 않는다.
/// 나타날 때와 앱으로 돌아올 때 /me 를 다시 읽어, 브라우저에서 인증을 마치면 저절로 사라진다.
struct EmailVerifyBanner: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase

    @State private var isSending = false
    /// 보낸 직후 잠깐 버튼을 막는다(연속 누름 방지) — 서버도 시간당 5번으로 막는다.
    @State private var sentAt: Date?
    @State private var errorMessage: String?

    private static let cooldown: TimeInterval = 60

    private var needsVerify: Bool {
        guard let user = auth.user else { return false }
        return !user.emailVerified && !(user.email ?? "").isEmpty
    }

    var body: some View {
        Group {
            if needsVerify {
                card
            }
        }
        .task { await refreshIfNeeded() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refreshIfNeeded() } }
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "envelope.badge")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.accent)
                Text("메일 인증을 마치시면 예약·초대 소식을 메일로 받아 보실 수 있어요")
                    .font(.subheadline)
                    .foregroundStyle(Theme.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            } else if sentAt != nil {
                Text("보냈어요. 메일함을 확인해 주세요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                let coolingDown = sentAt.map { context.date.timeIntervalSince($0) < Self.cooldown } ?? false
                Button {
                    send()
                } label: {
                    Group {
                        if isSending {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("인증 메일 다시 보내기")
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .foregroundStyle(coolingDown ? Theme.secondaryText : Theme.accent)
                    .background(Theme.background, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(isSending || coolingDown)
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("emailVerifyBanner")
    }

    private func send() {
        guard !isSending else { return }
        errorMessage = nil
        isSending = true
        Task {
            defer { isSending = false }
            do {
                let _: AckResponse = try await APIClient.shared.post(
                    "/api/v1/me/resend-verification",
                    body: EmptyRequestBody()
                )
                sentAt = Date()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription ?? "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."
                // 이미 인증됐다는 답이면 최신 상태로 맞춰 안내를 내린다
                await refreshIfNeeded()
            } catch {
                errorMessage = "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func refreshIfNeeded() async {
        guard needsVerify else { return }
        if let response: MeResponse = try? await APIClient.shared.get("/api/v1/me") {
            auth.updateUser(response.user)
        }
    }
}
