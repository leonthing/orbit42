import SwiftUI

/// 이벤트 상세 시트 — 수정/삭제 진입점.
/// 수정: EditEventSheet(PATCH), 삭제: confirmationDialog → DELETE.
struct EventDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: CalendarViewModel
    let event: CalendarEvent

    @State private var showingEdit = false
    @State private var showingDeleteConfirm = false
    @State private var isDeleting = false
    @State private var errorMessage: String?

    private var calendar: Calendar { CalendarViewModel.calendar }

    private var calendarInfo: CalendarInfo? {
        guard let calendarId = event.calendarId else { return nil }
        return viewModel.calendars.first { $0.id == calendarId }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(event.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                            if event.isGoogle {
                                Text("Google")
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Theme.secondaryText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.white.opacity(0.08), in: Capsule())
                            }
                        }

                        Label {
                            Text(dateTimeText)
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        } icon: {
                            Image(systemName: "clock")
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        }

                        if let calendarInfo {
                            Label {
                                Text(calendarInfo.name)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.secondaryText)
                            } icon: {
                                Circle()
                                    .fill(calendarInfo.displayColor)
                                    .frame(width: 10, height: 10)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Theme.surface)

                if let description = event.description, !description.isEmpty {
                    Section("메모") {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Button {
                        showingEdit = true
                    } label: {
                        Label("수정", systemImage: "pencil")
                    }
                    .disabled(isDeleting)

                    Button(role: .destructive) {
                        showingDeleteConfirm = true
                    } label: {
                        if isDeleting {
                            HStack {
                                Label("삭제", systemImage: "trash")
                                Spacer()
                                ProgressView()
                                    .tint(Theme.secondaryText)
                            }
                        } else {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                    .disabled(isDeleting)
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("일정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                        .disabled(isDeleting)
                }
            }
            .confirmationDialog(
                "이 일정을 삭제할까요?",
                isPresented: $showingDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) { deleteEvent() }
                Button("취소", role: .cancel) {}
            }
            .alert("삭제하지 못했어요", isPresented: showErrorAlert) {
                Button("확인", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $showingEdit) {
                EditEventSheet(viewModel: viewModel, event: event) {
                    // 수정 성공 → 상세 시트까지 닫는다 (표시 중인 이벤트가 낡은 상태이므로)
                    dismiss()
                }
                .preferredColorScheme(.dark)
            }
            .interactiveDismissDisabled(isDeleting)
        }
    }

    private var showErrorAlert: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    // MARK: - 삭제

    private func deleteEvent() {
        isDeleting = true
        Task {
            defer { isDeleting = false }
            do {
                try await viewModel.deleteEvent(event)
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "일정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 날짜/시간 표시

    private var dateTimeText: String {
        let start = event.startAt
        let end = event.effectiveEnd(calendar: calendar)
        if event.allDay {
            if calendar.isDate(start, inSameDayAs: end) {
                return "\(Self.dayFormatter.string(from: start)) · 종일"
            }
            return "\(Self.dayFormatter.string(from: start)) – \(Self.dayFormatter.string(from: end)) · 종일"
        }
        if calendar.isDate(start, inSameDayAs: event.endAt) {
            let startTime = Self.timeFormatter.string(from: start)
            let endTime = Self.timeFormatter.string(from: event.endAt)
            return "\(Self.dayFormatter.string(from: start)) · \(startTime) – \(endTime)"
        }
        return "\(Self.dayTimeFormatter.string(from: start)) – \(Self.dayTimeFormatter.string(from: event.endAt))"
    }

    /// "2026년 7월 26일 (일)"
    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일 (E)"
        return formatter
    }()

    /// "오전 9:00"
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "a h:mm"
        return formatter
    }()

    /// "7월 26일 (일) 오전 9:00"
    private static let dayTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) a h:mm"
        return formatter
    }()
}
