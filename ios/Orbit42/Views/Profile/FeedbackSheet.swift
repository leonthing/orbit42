import SwiftUI

/// 앱 피드백 보내기 — 분류(버그/제안/기타) + 내용.
/// 서버가 저장하고 운영자에게 메일로 전달한다.
struct FeedbackSheet: View {
    @Environment(\.dismiss) private var dismiss

    private enum Category: String, CaseIterable, Identifiable {
        case bug
        case idea
        case etc

        var id: String { rawValue }

        var label: String {
            switch self {
            case .bug: return "버그"
            case .idea: return "제안"
            case .etc: return "기타"
            }
        }
    }

    @State private var category: Category = .idea
    @State private var message = ""
    @State private var isSending = false
    @State private var didSend = false
    @State private var errorMessage: String?

    private var canSend: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                if didSend {
                    sentView
                } else {
                    form
                }
            }
            .navigationTitle("피드백 보내기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                        .disabled(isSending)
                }
                if !didSend {
                    ToolbarItem(placement: .confirmationAction) {
                        if isSending {
                            ProgressView().tint(Theme.accent)
                        } else {
                            Button("보내기") { send() }
                                .fontWeight(.semibold)
                                .disabled(!canSend)
                        }
                    }
                }
            }
            .interactiveDismissDisabled(isSending)
        }
    }

    private var form: some View {
        Form {
            Section {
                Picker("분류", selection: $category) {
                    ForEach(Category.allCases) { item in
                        Text(item.label).tag(item)
                    }
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            Section {
                TextEditor(text: $message)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 140)
                    .foregroundStyle(Theme.primaryText)
                    .overlay(alignment: .topLeading) {
                        if message.isEmpty {
                            Text(placeholder)
                                .foregroundStyle(Theme.secondaryText.opacity(0.6))
                                .padding(.top, 8)
                                .padding(.leading, 4)
                                .allowsHitTesting(false)
                        }
                    }
            } footer: {
                Text("보내주신 피드백은 계정 정보와 함께 운영자에게 전달돼요. 답장이 필요하면 내용에 남겨주세요.")
            }
            .listRowBackground(Theme.surface)

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

    private var placeholder: String {
        switch category {
        case .bug: return "어떤 화면에서 어떤 문제가 있었는지 알려주세요"
        case .idea: return "이런 기능이 있으면 좋겠어요"
        case .etc: return "하고 싶은 말을 자유롭게 남겨주세요"
        }
    }

    private var sentView: some View {
        VStack(spacing: 12) {
            Image(systemName: "paperplane.circle.fill")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("피드백을 보냈어요")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
            Text("소중한 의견 감사해요. 꼼꼼히 읽어볼게요!")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            Button {
                dismiss()
            } label: {
                Text("확인")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Theme.accent, in: Capsule())
            }
            .padding(.top, 8)
        }
        .padding(32)
    }

    private func send() {
        errorMessage = nil
        isSending = true
        Task {
            defer { isSending = false }
            do {
                struct FeedbackRequest: Encodable {
                    let category: String
                    let message: String
                    let appVersion: String?
                }
                let version = Bundle.main
                    .object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
                let _: AckResponse = try await APIClient.shared.post(
                    "/api/v1/feedback",
                    body: FeedbackRequest(
                        category: category.rawValue,
                        message: message.trimmingCharacters(in: .whitespacesAndNewlines),
                        appVersion: version
                    )
                )
                didSend = true
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "보내지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}

#Preview {
    FeedbackSheet()
        .tint(Theme.accent)
}
