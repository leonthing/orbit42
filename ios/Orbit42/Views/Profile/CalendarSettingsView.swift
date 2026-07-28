import SwiftUI

/// 프로필 탭 > 내 캘린더 — 캘린더 목록/편집/생성/삭제.
struct CalendarSettingsView: View {
    @State private var viewModel = CalendarSettingsViewModel()
    @State private var editingCalendar: CalendarInfo?
    @State private var showingCreate = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("내 캘린더")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("캘린더 추가")
            }
        }
        .sheet(item: $editingCalendar) { calendar in
            CalendarEditorSheet(mode: .edit(calendar), viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreate) {
            CalendarEditorSheet(mode: .create, viewModel: viewModel)
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
        if let calendars = viewModel.calendars {
            calendarList(calendars)
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
            Text("캘린더를 불러오는 중이에요")
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
                Task { await viewModel.load(force: true) }
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

    // MARK: - 목록

    private func calendarList(_ calendars: [CalendarInfo]) -> some View {
        List {
            Section {
                ForEach(calendars) { calendar in
                    Button {
                        editingCalendar = calendar
                    } label: {
                        CalendarSettingsRow(calendar: calendar)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        // 기본 캘린더는 스와이프 삭제 자체를 막는다
                        if !calendar.isDefault, !calendar.isSharedWithMe {
                            Button(role: .destructive) {
                                Task { await viewModel.delete(calendar) }
                            } label: {
                                Label("삭제", systemImage: "trash")
                            }
                        }
                    }
                }
            } footer: {
                Text("행을 탭하면 이름·용도·색·공개범위와 함께 쓰기(공유)를 설정할 수 있어요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }
}

// MARK: - 캘린더 행

private struct CalendarSettingsRow: View {
    let calendar: CalendarInfo

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(calendar.displayColor)
                .frame(width: 12, height: 12)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(calendar.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    if calendar.source == "google" {
                        SettingBadge(text: "Google", color: Theme.secondaryText)
                    }
                    if calendar.isDefault {
                        SettingBadge(text: "기본", color: Theme.accent)
                    }
                }
                Text(visibilityLabel)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText.opacity(0.6))
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private var visibilityLabel: String {
        CalendarVisibility(rawValue: calendar.visibility ?? "")?.label ?? "비공개"
    }
}

// MARK: - 뱃지

private struct SettingBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.fill(0.08), in: Capsule())
    }
}

#Preview {
    NavigationStack {
        CalendarSettingsView()
    }
    .tint(Theme.accent)
}
