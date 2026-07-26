import SwiftUI

/// 프로필 탭 > 근무시간 — 요일별 토글 + 시작/종료 시간.
/// `GET /api/v1/work-hours` 로 로드하고, "저장" 시 켠 요일만 `PUT` 으로 전체 교체.
/// 저장 성공은 pop 이 피드백.
struct WorkHoursView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = WorkHoursViewModel()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("근무시간")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.isSaving {
                    ProgressView()
                        .tint(Theme.accent)
                } else {
                    Button("저장") {
                        Task {
                            if await viewModel.save() {
                                dismiss()
                            }
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(!viewModel.isLoaded)
                }
            }
        }
        .alert(
            "안내",
            isPresented: Binding(
                get: { viewModel.actionMessage != nil },
                set: { if !$0 { viewModel.actionMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.actionMessage ?? "")
        }
        .task { await viewModel.load() }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoaded {
            editorForm
        } else if viewModel.isLoading {
            loadingState
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("근무시간을 불러오는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - 편집 폼

    private var editorForm: some View {
        Form {
            Section {
                ForEach($viewModel.days) { $day in
                    VStack(spacing: 8) {
                        Toggle("\(day.label)요일", isOn: $day.enabled)
                            .tint(Theme.accent)
                        if day.enabled {
                            HStack(spacing: 16) {
                                DatePicker("시작", selection: $day.start, displayedComponents: .hourAndMinute)
                                    .font(.subheadline)
                                DatePicker("종료", selection: $day.end, displayedComponents: .hourAndMinute)
                                    .font(.subheadline)
                            }
                            .foregroundStyle(Theme.secondaryText)
                        }
                    }
                }
            } header: {
                Text("요일별 근무시간")
            } footer: {
                Text("인사이트 가동률과 자동 슬롯 계산에 쓰여요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
    }
}

#Preview {
    NavigationStack {
        WorkHoursView()
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
