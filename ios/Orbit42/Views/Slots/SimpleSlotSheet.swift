import SwiftUI

/// 타임슬롯 간단 생성 — 제목·길이·가격·요일·시간대만.
/// 나머지(장소·정원·예약 받는 기간 등)는 만든 뒤 상세에서 고친다.
struct SimpleSlotSheet: View {
    let viewModel: SlotsViewModel
    /// 미리 채울 값 (온보딩 예시 고르기 — 1.6.0 ① 손질)
    var presetTitle: String? = nil
    var presetDuration: Int? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var auth
    /// 결제 안내 (계정 값, 유료일 때 가격 아래에서 바로 적는다 — 개선-38)
    @State private var paymentText = ""
    @State private var confirmingNoPayment = false
    @State private var paymentError: String?

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
                    if priceWon > 0 {
                        PaymentInlineField(text: $paymentText)
                    }
                } header: {
                    Text("가격")
                } footer: {
                    Text(priceWon == 0 ? "0원이면 무료로 받아요." : PaymentConfirmCopy.footer)
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
                        .environment(\.locale, Locale(identifier: "ko_KR"))   // 앱에 ko 현지화가 없어 '10:00 AM' 으로 나오던 것
                    DatePicker("끝", selection: $end, displayedComponents: .hourAndMinute)
                        .environment(\.locale, Locale(identifier: "ko_KR"))
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
            .navigationTitle("새 예약 링크")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.isCreatingPreset ? "만드는 중…" : "만들기") { attemptSave() }
                        .disabled(!canSave)
                }
            }
            .onAppear {
                if let presetTitle, title.isEmpty { title = presetTitle }
                if let presetDuration { duration = presetDuration }
                titleFocused = presetTitle == nil
                paymentText = auth.user?.paymentInstructions ?? ""
            }
            .alert(PaymentConfirmCopy.title, isPresented: $confirmingNoPayment) {
                Button("결제 안내 적기", role: .cancel) {}
                Button("그대로 만들기") { save() }
            } message: {
                Text(PaymentConfirmCopy.message)
            }
            .alert("결제 안내를 저장하지 못했어요", isPresented: Binding(get: { paymentError != nil }, set: { if !$0 { paymentError = nil } })) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(paymentError ?? "")
            }
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

    /// 유료인데 결제 안내가 비어 있으면 한 번 묻는다 (서버 동작은 그대로 — 바로 확정)
    private func attemptSave() {
        if priceWon > 0, paymentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            confirmingNoPayment = true
        } else {
            save()
        }
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
            if priceWon > 0 {
                do {
                    try await PaymentInstructionsSaver.saveIfChanged(paymentText, auth: auth)
                } catch let apiError as APIError {
                    if let message = apiError.errorDescription { paymentError = message }
                    return
                } catch {
                    paymentError = "네트워크를 확인해 주세요."
                    return
                }
            }
            if await viewModel.createSimple(input) { dismiss() }
        }
    }
}
