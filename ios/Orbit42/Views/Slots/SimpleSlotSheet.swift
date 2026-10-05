import SwiftUI

/// 타임슬롯 간단 생성 — 제목·길이·가격·요일·시간대만.
/// 나머지(장소·정원·예약 받는 기간 등)는 만든 뒤 상세에서 고친다.
struct SimpleSlotSheet: View {
    let viewModel: SlotsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var duration = 60
    @State private var priceText = ""
    @State private var days: Set<String> = ["mon", "tue", "wed", "thu", "fri"]
    @State private var start = Self.time(10)
    @State private var end = Self.time(18)
    @State private var autoApprove = true
    @State private var showingAdvanced = false
    @FocusState private var titleFocused: Bool

    private static let durations = [30, 50, 60, 90]
    private static let weekdays: [(key: String, label: String)] = [
        ("mon", "월"), ("tue", "화"), ("wed", "수"), ("thu", "목"), ("fri", "금"), ("sat", "토"), ("sun", "일"),
    ]

    private static func time(_ hour: Int) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
    }

    private static let hm: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    private var priceWon: Int { Int(priceText.filter(\.isNumber)) ?? 0 }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !days.isEmpty && end > start
            && !viewModel.isCreatingPreset
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("무엇을 여나요?") {
                    TextField("예: 1:1 커리어 코칭, 30분 상담", text: $title)
                        .focused($titleFocused)
                }

                Section("길이") {
                    HStack(spacing: 8) {
                        ForEach(Self.durations, id: \.self) { d in
                            chip("\(d)분", selected: duration == d) { duration = d }
                        }
                    }
                }

                Section {
                    HStack {
                        TextField("0", text: $priceText)
                            .keyboardType(.numberPad)
                        Text("원").foregroundStyle(Theme.secondaryText)
                    }
                } header: {
                    Text("가격")
                } footer: {
                    Text(priceWon == 0 ? "0원이면 무료로 받아요." : "설정 > 결제 안내(계좌이체)를 적어 두면 입금 확인 후 확정돼요.")
                }

                Section {
                    HStack(spacing: 6) {
                        ForEach(Self.weekdays, id: \.key) { day in
                            chip(day.label, selected: days.contains(day.key)) {
                                if days.contains(day.key) { days.remove(day.key) } else { days.insert(day.key) }
                            }
                        }
                    }
                    DatePicker("시작", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("끝", selection: $end, displayedComponents: .hourAndMinute)
                } header: {
                    Text("매주 열어둘 시간")
                } footer: {
                    Text("이 시간대 안에서 내 일정과 겹치지 않는 시간이 자동으로 열려요.")
                }

                Section {
                    DisclosureGroup("고급", isExpanded: $showingAdvanced) {
                        Toggle("예약을 바로 확정", isOn: $autoApprove)
                        Text(autoApprove ? "예약이 들어오면 바로 확정돼요." : "예약이 들어오면 내가 수락해야 확정돼요.")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("새 타임슬롯")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isCreatingPreset ? "만드는 중…" : "만들기") { save() }
                        .disabled(!canSave)
                }
            }
            .onAppear { titleFocused = true }
        }
    }

    private func chip(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(selected ? Color.white : Theme.primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(selected ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(Theme.fill(0.08)), in: Capsule())
        }
        .buttonStyle(.borderless)
    }

    private func save() {
        let range = WorkingRange(start: Self.hm.string(from: start), end: Self.hm.string(from: end))
        var hours: [String: [WorkingRange]] = [:]
        for d in days { hours[d] = [range] }
        let input = SimpleSlotInput(
            title: title.trimmingCharacters(in: .whitespaces),
            durationMin: duration,
            priceCents: priceWon * 100,
            mode: "auto",
            workingHours: hours,
            autoApprove: autoApprove,
            showOnFeed: false
        )
        Task {
            if await viewModel.createSimple(input) { dismiss() }
        }
    }
}
