import SwiftUI

/// 프로필 탭 > 설정 > 내 캘린더 > 시작 요일.
/// iOS 설정 앱과 같은 체크리스트 — 시스템 설정을 따르거나 요일을 직접 고른다.
struct WeekStartPickerView: View {
    private var settings = AppSettings.shared

    var body: some View {
        List {
            Section {
                row(.system)
            } header: {
                Text("시스템 설정 미러링")
                    .foregroundStyle(Theme.secondaryText)
            } footer: {
                Text("선택하면 기기의 '언어 및 지역' 설정을 그대로 따라가요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)

            Section {
                ForEach(WeekStart.weekdayCases) { option in
                    row(option)
                }
            } header: {
                Text("orbit42 에만")
                    .foregroundStyle(Theme.secondaryText)
            } footer: {
                Text("캘린더·예약 화면의 달력과 근무시간 요일 목록이 이 요일부터 시작해요. 이 기기에만 적용돼요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("시작 요일")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ option: WeekStart) -> some View {
        Button {
            settings.setWeekStart(option)
        } label: {
            HStack {
                Text(option.label)
                    .foregroundStyle(Theme.primaryText)
                Spacer(minLength: 0)
                if settings.weekStart == option {
                    Image(systemName: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        WeekStartPickerView()
    }
    .tint(Theme.accent)
}
