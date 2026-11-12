import SwiftUI

// MARK: - 기한 칩

struct DueChipsRow: View {
    @Binding var choice: DueChoice
    @Binding var picked: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DueChoice.allCases) { c in
                        Button {
                            choice = c
                        } label: {
                            Text(c.label)
                                .font(.footnote.weight(.medium))
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .background(choice == c ? Theme.accent : Theme.fill(0.08), in: Capsule())
                                .foregroundStyle(choice == c ? .white : Theme.primaryText)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("due.\(c.rawValue)")
                    }
                }
            }
            if choice == .pick {
                DatePicker("기한", selection: $picked, displayedComponents: .date)
                    .datePickerStyle(.compact)
            }
        }
    }
}

// MARK: - 할 일 만들기 시트 (한 줄 / 완료 직후 여러 줄)

/// '+ 할 일'(한 줄)과 완료 직후 "후속으로 할 일이 있나요?"(여러 줄 — 한 줄이 할 일 하나)가 함께 쓴다.
struct AddTodoSheet: View {
    enum Mode { case single, afterCompletion }

    let mode: Mode
    let sourceKey: String?
    var onSaved: ([TodoItem]) -> Void = { _ in }
    /// 완료 직후 시트의 '+ 후속 일정'
    var onAddFollowUpEvent: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var due: DueChoice = .none
    @State private var picked = Date()
    @State private var saving = false
    @State private var errorText: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if mode == .single {
                        TextField("할 일", text: $text)
                            .focused($focused)
                            .submitLabel(.done)
                            .onSubmit { Task { await save() } }
                            .accessibilityIdentifier("todoInput")
                    } else {
                        TextField("한 줄에 하나씩 적어 주세요", text: $text, axis: .vertical)
                            .lineLimit(3...8)
                            .focused($focused)
                            .accessibilityIdentifier("todoInput")
                    }
                } footer: {
                    if mode == .afterCompletion {
                        Text("한 줄이 할 일 하나가 돼요. 원래 일정과 이어져 보여요.")
                    }
                }
                Section("기한") {
                    DueChipsRow(choice: $due, picked: $picked)
                }
                if mode == .afterCompletion, let onAddFollowUpEvent {
                    Section {
                        Button {
                            dismiss()
                            onAddFollowUpEvent()
                        } label: {
                            Label("후속 일정 만들기", systemImage: "calendar.badge.plus")
                        }
                        .accessibilityIdentifier("afterCompletion.addEvent")
                    }
                }
                if mode == .afterCompletion {
                    Section {
                        Button("다시 묻지 않기") {
                            AppSettings.shared.setAskFollowUp(false)
                            dismiss()
                        }
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                    } footer: {
                        Text("설정 → 캘린더에서 다시 켤 수 있어요.")
                    }
                }
                if let errorText {
                    Text(errorText).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle(mode == .single ? "할 일 추가" : "후속으로 할 일이 있나요?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(mode == .single ? "취소" : "건너뛰기") { dismiss() }
                        .accessibilityIdentifier("todo.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "저장 중…" : "저장") { Task { await save() } }
                        .disabled(saving || lines.isEmpty)
                        .accessibilityIdentifier("todo.save")
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
    }

    private var lines: [String] {
        let all = mode == .single ? [text] : text.components(separatedBy: .newlines)
        return all.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    private func save() async {
        guard !lines.isEmpty, !saving else { return }
        saving = true
        defer { saving = false }
        do {
            let made = try await TodoAPI.create(lines, due: due.date(picked: picked), sourceKey: sourceKey)
            onSaved(made)
            TodoChanges.post()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}

/// 할 일이 바뀌었음을 하루 보기·목록에 알린다
enum TodoChanges {
    static let didChange = Notification.Name("orbit42.todosDidChange")
    static func post() { NotificationCenter.default.post(name: didChange, object: nil) }
}

// MARK: - 일정 상세의 '후속' 칸

/// 원래 일정이면 후속 목록 + [+ 후속 일정] [+ 할 일], 누군가의 후속이면 맨 위에 "← 원래 일정".
struct FollowUpSection: View {
    let event: CalendarEvent
    let onAddFollowUpEvent: () -> Void

    @Environment(TabRouter.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var data: FollowUpsResponse?
    @State private var showingAddTodo = false
    @State private var errorText: String?

    var body: some View {
        Group {
            if let source = data?.source {
                Section {
                    if source.missing == true {
                        Label("원래 일정이 지워졌어요", systemImage: "arrow.uturn.backward")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                    } else {
                        Button {
                            if let d = source.startDate {
                                dismiss()
                                router.selection = .calendar
                                router.calendarEventRequest = CalendarEventRequest(eventId: source.key, date: d)
                            }
                        } label: {
                            Label {
                                Text("원래 일정: \(source.title ?? "")\(source.startDate.map { " (\($0.formatted(.dateTime.month().day())))" } ?? "")")
                                    .lineLimit(1)
                            } icon: { Image(systemName: "arrow.uturn.backward") }
                            .font(.footnote)
                        }
                        .accessibilityIdentifier("followUp.source")
                    }
                }
                .listRowBackground(Theme.surface)
            }
            Section {
                ForEach(data?.followUps ?? [], id: \.stableId) { item in
                    row(item)
                }
                HStack(spacing: 10) {
                    Button {
                        onAddFollowUpEvent()
                    } label: {
                        Label("후속 일정", systemImage: "calendar.badge.plus").font(.subheadline)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("followUp.addEvent")
                    Button {
                        showingAddTodo = true
                    } label: {
                        Label("할 일", systemImage: "checklist").font(.subheadline)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("followUp.addTodo")
                }
                if let errorText {
                    Text(errorText).font(.caption).foregroundStyle(.red)
                }
            } header: {
                Text("후속")
            }
            .listRowBackground(Theme.surface)
        }
        .task(id: event.id) { await load() }
        .onReceive(NotificationCenter.default.publisher(for: TodoChanges.didChange)) { _ in Task { await load() } }
        .sheet(isPresented: $showingAddTodo) {
            AddTodoSheet(mode: .single, sourceKey: event.id) { _ in Task { await load() } }
        }
    }

    @ViewBuilder
    private func row(_ item: FollowUpItem) -> some View {
        if item.kind == "todo" {
            Button {
                Task { await toggle(item) }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: item.done == true ? "checkmark.square.fill" : "square")
                        .foregroundStyle(item.done == true ? Theme.accent : Theme.secondaryText)
                    Text(item.title)
                        .strikethrough(item.done == true)
                        .foregroundStyle(item.done == true ? Theme.secondaryText : Theme.primaryText)
                    Spacer()
                    if let due = item.dueDate.flatMap({ APIDateParser.parse($0) }) {
                        Text(due.formatted(.dateTime.month().day())).font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                }
                .font(.subheadline)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("followUp.todo")
        } else {
            Button {
                if let key = item.key, let d = item.startDate {
                    dismiss()
                    router.selection = .calendar
                    router.calendarEventRequest = CalendarEventRequest(eventId: key, date: d)
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "calendar").foregroundStyle(Theme.accent)
                    Text(item.title).foregroundStyle(Theme.primaryText).lineLimit(1)
                    Spacer()
                    if let d = item.startDate {
                        Text(d.formatted(.dateTime.month().day())).font(.caption).foregroundStyle(Theme.secondaryText)
                    }
                    Text(statusLabel(item.status))
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Theme.fill(0.08), in: Capsule())
                        .foregroundStyle(Theme.secondaryText)
                }
                .font(.subheadline)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("followUp.event")
        }
    }

    private func statusLabel(_ s: String?) -> String {
        switch s {
        case "done": return "완료"
        case "past": return "지남"
        default: return "예정"
        }
    }

    private func load() async {
        do {
            data = try await TodoAPI.followUps(event.id)
            errorText = nil
        } catch {
            if data == nil { errorText = nil } // 없거나 시행 전이면 조용히 빈 칸
        }
    }

    private func toggle(_ item: FollowUpItem) async {
        guard let id = item.id else { return }
        let newDone = !(item.done ?? false)
        if let i = data?.followUps.firstIndex(where: { $0.stableId == item.stableId }) { data?.followUps[i].done = newDone }
        do {
            _ = try await TodoAPI.update(id, TodoPatch(done: newDone))
            TodoChanges.post()
        } catch {
            if let i = data?.followUps.firstIndex(where: { $0.stableId == item.stableId }) { data?.followUps[i].done = !newDone }
            errorText = error.localizedDescription
        }
    }
}

// MARK: - 메모 "-" 줄 → 할 일

struct MemoTodoSheet: View {
    let sourceKey: String
    let candidates: [String]

    @Environment(\.dismiss) private var dismiss
    @State private var rows: [Row] = []
    @State private var existing: Set<String> = []
    @State private var saving = false
    @State private var errorText: String?

    struct Row: Identifiable {
        let id = UUID()
        var text: String
        var on: Bool
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach($rows) { $row in
                        let dup = existing.contains(row.text.trimmingCharacters(in: .whitespaces))
                        HStack {
                            Toggle("", isOn: $row.on).labelsHidden().disabled(dup)
                            TextField("할 일", text: $row.text)
                                .foregroundStyle(dup ? Theme.secondaryText : Theme.primaryText)
                            if dup {
                                Text("이미 있음").font(.caption2).foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }
                } footer: {
                    Text("메모는 그대로 두고, 고른 줄만 이 일정에 이어진 할 일로 만들어요.")
                }
                if let errorText {
                    Text(errorText).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("할 일로 바꾸기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "저장 중…" : "저장 (\(chosen.count))") { Task { await save() } }
                        .disabled(saving || chosen.isEmpty)
                        .accessibilityIdentifier("memoTodo.save")
                }
            }
            .task {
                rows = candidates.map { Row(text: $0, on: true) }
                if let r = try? await TodoAPI.followUps(sourceKey) {
                    existing = Set(r.followUps.filter { $0.kind == "todo" }.map(\.title))
                }
            }
        }
    }

    private var chosen: [String] {
        rows.filter { $0.on }.map { $0.text.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty && !existing.contains($0) }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            _ = try await TodoAPI.create(chosen, due: nil, sourceKey: sourceKey)
            TodoChanges.post()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - 하루 보기 맨 위 할 일

/// "할 일 3 · 지남 1" 접히는 줄. 체크하면 줄이 그어진 채 남았다가 다시 열면 빠진다. 없으면 숨김.
struct DayTodoStrip: View {
    let date: Date

    @State private var todos: [TodoItem] = []
    @State private var overdue = 0
    @State private var expanded = false

    var body: some View {
        Group {
            if !todos.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        withAnimation(.snappy) { expanded.toggle() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checklist").font(.footnote)
                            Text(summary).font(.footnote.weight(.semibold))
                            Spacer()
                            Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.caption2)
                        }
                        .foregroundStyle(Theme.primaryText)
                        // plain 버튼은 그려진 곳만 눌린다 — 가운데 빈 곳(Spacer)도 눌리게(실측: 가운데를 누르면 안 펼쳐짐)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("dayTodos")
                    .accessibilityValue(expanded ? "펼침" : "접힘")
                    if expanded {
                        ForEach(todos) { t in
                            Button {
                                Task { await toggle(t) }
                            } label: {
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: t.done ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(t.done ? Theme.accent : Theme.secondaryText)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(t.title)
                                            .strikethrough(t.done)
                                            .foregroundStyle(t.done ? Theme.secondaryText : Theme.primaryText)
                                        if let s = t.sourceTitle {
                                            Text("← \(s)").font(.caption2).foregroundStyle(Theme.secondaryText).lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    if let d = t.dueDay, !Calendar.current.isDate(d, inSameDayAs: date) {
                                        Text("지남").font(.caption2.weight(.semibold)).foregroundStyle(.red)
                                    }
                                }
                                .font(.subheadline)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(10)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 12)
                .padding(.top, 6)
            } else {
                // 빈 Group 에는 .task 가 붙지 않는다(실측) — 0 높이 자리
                Color.clear.frame(height: 0)
            }
        }
        .task(id: date) { await load() }
        .onReceive(NotificationCenter.default.publisher(for: TodoChanges.didChange)) { _ in Task { await load() } }
    }

    private var summary: String {
        let open = todos.filter { !$0.done }.count
        return overdue > 0 ? "할 일 \(open) · 지남 \(overdue)" : "할 일 \(open)"
    }

    private func load() async {
        guard !BrowseMode.shared.active else { todos = []; return }
        if !DmStore.shared.open { await DmStore.shared.refresh() }
        guard DmStore.shared.open else { todos = []; return }
        let day = APIDateParser.encodeDateOnly(date)
        guard let r: TodoDayResponse = try? await APIClient.shared.get("/api/v1/todos?view=day&date=\(day)") else { return }
        // 그날 이미 끝낸 것은 다시 열면 빠진다(그날 체크한 건 이 화면에 있는 동안만 줄 그은 채)
        todos = r.todos.filter { !$0.done }
        overdue = r.overdue
    }

    private func toggle(_ t: TodoItem) async {
        guard let i = todos.firstIndex(of: t) else { return }
        todos[i].done.toggle()
        let now = todos[i].done
        do {
            _ = try await TodoAPI.update(t.id, TodoPatch(done: now))
        } catch {
            if let j = todos.firstIndex(where: { $0.id == t.id }) { todos[j].done = !now }
        }
    }
}

// MARK: - 할 일 전체 목록 (캘린더 툴바의 체크리스트 아이콘)

struct TodoListView: View {
    @Environment(TabRouter.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var data: TodoListResponse?
    @State private var newText = ""
    @State private var errorText: String?
    @State private var dueTarget: TodoItem?
    @FocusState private var inputFocused: Bool

    private var groups: [(key: String, title: String, items: [TodoItem])] {
        guard let d = data else { return [] }
        return [
            ("overdue", "기한 지남", d.overdue),
            ("today", "오늘", d.today),
            ("upcoming", "예정", d.upcoming),
            ("someday", "기한 없음", d.someday),
            ("done", "완료 (최근 30일)", d.done),
        ].filter { !$0.2.isEmpty }
    }

    var body: some View {
        NavigationStack {
            List {
                if data != nil && groups.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "checklist").font(.system(size: 28, weight: .light)).foregroundStyle(Theme.secondaryText)
                        Text("할 일이 없어요").font(.subheadline.weight(.medium))
                        Text("아래에 적거나, 일정 상세의 '후속'에서 만들어 보세요.").font(.footnote).foregroundStyle(Theme.secondaryText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .listRowBackground(Color.clear)
                }
                ForEach(groups, id: \.key) { g in
                    Section {
                        ForEach(g.items) { t in
                            row(t)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) { Task { await remove(t) } } label: { Label("삭제", systemImage: "trash") }
                                    Button { dueTarget = t } label: { Label("기한", systemImage: "calendar") }.tint(.orange)
                                }
                        }
                        .onMove { from, to in
                            Task { await move(in: g.items, from: from, to: to) }
                        }
                    } header: {
                        Text("\(g.title) \(g.items.count)").foregroundStyle(g.key == "overdue" ? .red : Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }
                if let errorText {
                    Text(errorText).font(.footnote).foregroundStyle(.red).listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 8) {
                    TextField("새 할 일", text: $newText)
                        .focused($inputFocused)
                        .submitLabel(.done)
                        .onSubmit { Task { await add() } }
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                        .accessibilityIdentifier("todoList.input")
                    Button { Task { await add() } } label: {
                        Image(systemName: "plus.circle.fill").font(.system(size: 30))
                    }
                    .disabled(newText.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("todoList.add")
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(.bar)
            }
            .navigationTitle("할 일")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } }
                ToolbarItem(placement: .primaryAction) { EditButton() }
            }
            .refreshable { await load() }
            .task { await load() }
            .sheet(item: $dueTarget) { t in
                TodoDueSheet(todo: t) { Task { await load() } }
            }
        }
    }

    private func row(_ t: TodoItem) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Button { Task { await toggle(t) } } label: {
                Image(systemName: t.done ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(t.done ? Theme.accent : Theme.secondaryText)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("todoList.check")
            VStack(alignment: .leading, spacing: 2) {
                Text(t.title)
                    .strikethrough(t.done)
                    .foregroundStyle(t.done ? Theme.secondaryText : Theme.primaryText)
                HStack(spacing: 8) {
                    if let d = t.dueDay { Text(d.formatted(.dateTime.month().day())) }
                    if let s = t.sourceTitle {
                        Button {
                            if let key = t.sourceEventKey, let d = t.sourceStartDate {
                                dismiss()
                                router.selection = .calendar
                                router.calendarEventRequest = CalendarEventRequest(eventId: key, date: d)
                            }
                        } label: { Text("← \(s)").lineLimit(1) }
                        .buttonStyle(.plain)
                    }
                }
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(.vertical, 2)
    }

    private func load() async {
        do {
            data = try await APIClient.shared.get("/api/v1/todos")
            errorText = nil
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func add() async {
        let t = newText.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        do {
            _ = try await TodoAPI.create([t], due: nil, sourceKey: nil)
            newText = ""
            TodoChanges.post()
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func toggle(_ t: TodoItem) async {
        do {
            _ = try await TodoAPI.update(t.id, TodoPatch(done: !t.done))
            TodoChanges.post()
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func remove(_ t: TodoItem) async {
        do {
            try await TodoAPI.delete(t.id)
            TodoChanges.post()
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }

    /// 끌어 옮기면 옮긴 자리 앞뒤 두 값의 가운데로
    private func move(in items: [TodoItem], from: IndexSet, to: Int) async {
        guard let src = from.first else { return }
        var list = items
        let moving = list.remove(at: src)
        let dest = to > src ? to - 1 : to
        list.insert(moving, at: dest)
        let before = dest > 0 ? list[dest - 1].sortOrder : nil
        let after = dest + 1 < list.count ? list[dest + 1].sortOrder : nil
        let order: Double
        switch (before, after) {
        case let (b?, a?): order = (b + a) / 2
        case let (b?, nil): order = b + 1
        case let (nil, a?): order = a - 1
        default: order = moving.sortOrder
        }
        do {
            _ = try await TodoAPI.update(moving.id, TodoPatch(sortOrder: order))
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }
}

/// 목록에서 밀어서 '기한' — 칩으로 바꾸기
private struct TodoDueSheet: View {
    let todo: TodoItem
    let onDone: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var choice: DueChoice = .today
    @State private var picked = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section(todo.title) { DueChipsRow(choice: $choice, picked: $picked) }
            }
            .navigationTitle("기한 바꾸기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        Task {
                            let d = choice.date(picked: picked)
                            var patch = TodoPatch()
                            if let d { patch.dueDate = APIDateParser.encodeDateOnly(d) } else { patch.clearDue = true }
                            _ = try? await TodoAPI.update(todo.id, patch)
                            TodoChanges.post()
                            onDone()
                            dismiss()
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
