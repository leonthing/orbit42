import PhotosUI
import SwiftUI
import VisionKit

// MARK: - 홈(연결 상태·찍기·해제·정확도)

struct CardsHomeView: View {
    @State private var store = CardsStore.shared
    @State private var showScanner = false
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var working = false
    @State private var confirm: CardConfirmInput?
    @State private var askRevokeAll = false
    @State private var askDisconnect = false
    @State private var counts = CardFixCounter.counts
    @State private var undos = CardsUndo.all()
    @State private var askUndo: CardsUndo.Item?
    @State private var undoNotice: String?

    var body: some View {
        List {
            if store.status?.connected == true || Self.demoFiles() != nil {
                Section {
                    Button {
                        if let files = Self.demoFiles() { Task { await recognize(files) } } else { showScanner = true }
                    } label: {
                        Label(working ? "글자를 읽는 중…" : "명함 찍기", systemImage: "camera.viewfinder")
                            .font(.headline)
                    }
                    .disabled(working || !VNDocumentCameraViewController.isSupported && Self.demoFiles() == nil)
                    .accessibilityIdentifier("cardsScan")
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: 2, matching: .images) {
                        Label("사진에서 고르기(앞·뒤 최대 2장)", systemImage: "photo.on.rectangle")
                    }
                    .disabled(working)
                } footer: {
                    Text("글자는 휴대폰 안에서 읽어요. '저장'을 누르기 전에는 Google 연락처에 아무것도 쓰지 않아요.")
                }
                Section("연결") {
                    LabeledContent("Google 계정", value: store.status?.email ?? "확인 중")
                    Button("연결 해제", role: .destructive) { askDisconnect = true }
                    Button("Google 권한까지 모두 회수(캘린더도 끊김)", role: .destructive) { askRevokeAll = true }
                }
                .disabled(store.busy)
            } else if store.status != nil {
                Section {
                    Button {
                        Task { await store.connect() }
                    } label: {
                        Label(store.busy ? "연결하는 중…" : "Google 연락처 연결", systemImage: "person.crop.circle.badge.plus")
                    }
                    .disabled(store.busy)
                    .accessibilityIdentifier("cardsConnect")
                } footer: {
                    Text("명함을 찍으면 Google 연락처에 저장해요. 권한은 연락처와, orbit42가 만든 Drive 파일뿐이에요. 명함 사진은 내 Drive 'Orbit42 명함' 폴더에만 두고 orbit42 서버에는 남기지 않아요.")
                }
            } else {
                ProgressView()
            }

            if !undos.isEmpty && store.status?.connected == true {
                Section {
                    ForEach(undos) { u in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(u.name).lineLimit(1)
                                Text("\(u.kind == "created" ? "새로 만듦" : "갱신") · \(u.at.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("되돌리기") { askUndo = u }
                                .buttonStyle(.bordered)
                                .accessibilityIdentifier("cardsUndo")
                        }
                    }
                } header: {
                    Text("최근 저장")
                } footer: {
                    Text("최근 \(CardsUndo.limit)건까지 되돌릴 수 있어요. 저장한 뒤에 그 연락처를 고쳤으면 되돌리지 않아요. 되돌릴 정보는 이 기기에만 있어요.")
                }
            }

            if (counts["_cards"] ?? 0) > 0 {
                Section {
                    LabeledContent("저장한 명함", value: "\(counts["_cards"] ?? 0)장")
                    ForEach(CardFixCounter.fields, id: \.0) { key, label in
                        if let n = counts[key], n > 0 { LabeledContent("\(label) 고침", value: "\(n)번") }
                    }
                    Button("기록 지우기") { CardFixCounter.reset(); counts = CardFixCounter.counts }
                } header: {
                    Text("인식 정확도(이 기기에만)")
                } footer: {
                    Text("저장할 때 인식값에서 고친 칸 이름과 횟수만 세요. 명함 내용은 남기지 않아요.")
                }
            }
        }
        .navigationTitle("명함 → 구글 연락처")
        .task { await store.refresh(); counts = CardFixCounter.counts; undos = CardsUndo.all() }
        .onAppear { counts = CardFixCounter.counts; undos = CardsUndo.all() }
        .confirmationDialog(askUndo.map { "\($0.name) 저장을 되돌릴까요?" } ?? "", isPresented: Binding(get: { askUndo != nil }, set: { if !$0 { askUndo = nil } }), titleVisibility: .visible, presenting: askUndo) { u in
            Button("되돌리기", role: .destructive) {
                Task {
                    switch await store.undo(u) {
                    case .done: undoNotice = u.kind == "created" ? "연락처와 명함 사진을 지웠어요." : "갱신 전으로 되돌렸어요."
                    case .changed(let m), .failed(let m): undoNotice = m
                    }
                    undos = CardsUndo.all()
                }
            }
        } message: { u in
            Text(u.kind == "created" ? "방금 만든 연락처와 Drive 명함 사진을 지워요." : "갱신 전 값으로 되돌리고, 이번에 붙인 Card 라벨과 Drive 명함 사진을 지워요.")
        }
        .alert("알림", isPresented: Binding(get: { undoNotice != nil }, set: { if !$0 { undoNotice = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(undoNotice ?? "") }
        .fullScreenCover(isPresented: $showScanner) {
            CardScannerView { pages in
                showScanner = false
                if !pages.isEmpty { Task { await recognize(pages) } }
            }
            .ignoresSafeArea()
        }
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task {
                var imgs: [UIImage] = []
                for it in items.prefix(2) {
                    if let d = try? await it.loadTransferable(type: Data.self), let i = UIImage(data: d) { imgs.append(i) }
                }
                pickerItems = []
                if !imgs.isEmpty { await recognize(imgs) }
            }
        }
        .navigationDestination(item: $confirm) { input in
            CardConfirmView(input: input) { confirm = nil; counts = CardFixCounter.counts; undos = CardsUndo.all() }
        }
        .confirmationDialog("명함 연결을 해제할까요?", isPresented: $askDisconnect, titleVisibility: .visible) {
            Button("해제", role: .destructive) { Task { await store.disconnect(revokeAll: false) } }
        } message: {
            Text("orbit42에 있는 명함용 연결만 지워요. 캘린더 연결은 그대로예요. 저장한 연락처와 Drive 사진은 그대로 남아요.")
        }
        .confirmationDialog("Google 권한까지 모두 회수할까요?", isPresented: $askRevokeAll, titleVisibility: .visible) {
            Button("모두 회수", role: .destructive) { Task { await store.disconnect(revokeAll: true) } }
        } message: {
            Text("Google은 orbit42의 권한을 한꺼번에 회수해요. 캘린더 연결도 끊겨서, 캘린더를 쓰려면 다시 연결해야 해요.")
        }
        .alert("명함", isPresented: Binding(get: { store.message != nil }, set: { if !$0 { store.message = nil } })) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(store.message ?? "")
        }
    }

    private func recognize(_ pages: [UIImage]) async {
        working = true
        defer { working = false }
        let d = await CardRecognizer.draft(from: pages)
        confirm = CardConfirmInput(pages: Array(pages.prefix(2)), parsed: d)
    }

    /// DEBUG 시험용: 시뮬레이터는 문서 스캐너가 없어서 Mac 경로의 합성 명함을 바로 읽는다(DEMO_CARD_FILES=앞.jpg,뒤.jpg)
    static func demoFiles() -> [UIImage]? {
        #if DEBUG
        guard let raw = ProcessInfo.processInfo.environment["DEMO_CARD_FILES"], !raw.isEmpty else { return nil }
        let imgs = raw.split(separator: ",").compactMap { UIImage(contentsOfFile: String($0)) }
        return imgs.isEmpty ? nil : imgs
        #else
        return nil
        #endif
    }
}

// MARK: - 문서 스캐너(앞·뒤)

struct CardScannerView: UIViewControllerRepresentable {
    let done: ([UIImage]) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let vc = VNDocumentCameraViewController()
        vc.delegate = context.coordinator
        return vc
    }
    func updateUIViewController(_ vc: VNDocumentCameraViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(done: done) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let done: ([UIImage]) -> Void
        init(done: @escaping ([UIImage]) -> Void) { self.done = done }
        func documentCameraViewController(_ c: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            done((0..<min(scan.pageCount, 2)).map { scan.imageOfPage(at: $0) })
        }
        func documentCameraViewControllerDidCancel(_ c: VNDocumentCameraViewController) { done([]) }
        func documentCameraViewController(_ c: VNDocumentCameraViewController, didFailWithError error: Error) { done([]) }
    }
}

// MARK: - 확인 화면

struct CardConfirmInput: Identifiable, Hashable {
    let id = UUID()
    let pages: [UIImage]
    let parsed: CardDraft
    static func == (a: Self, b: Self) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

struct CardConfirmView: View {
    let input: CardConfirmInput
    let finished: () -> Void

    @State private var d: CardDraft
    @State private var email2 = ""
    @State private var candidates: [CardCandidate] = []
    @State private var searched = false
    @State private var searching = false
    @State private var searchError: String?
    /// 구글 연락처 연결이 끊겨 있음(서버 409 not_connected) — 이 화면에서 바로 연결, 쓰던 값은 그대로
    @State private var needsConnect = false
    /// "create" 또는 resourceName. nil = 아직 안 고름
    @State private var choice: String?
    @State private var saving = false
    @State private var notice: String?
    @State private var savedText: String?
    @State private var savedUndo: UUID?
    @State private var undoing = false
    @State private var searchTask: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    init(input: CardConfirmInput, finished: @escaping () -> Void) {
        self.input = input
        self.finished = finished
        var p = input.parsed
        let second = p.emails.count > 1 ? p.emails[1] : ""
        p.emails = Array(p.emails.prefix(1))
        _d = State(initialValue: p)
        _email2 = State(initialValue: second)
    }

    private var draftForSave: CardDraft {
        var x = d
        x.emails = ([d.emails.first ?? ""] + [email2]).map { $0.trimmingCharacters(in: .whitespaces) }.filter { $0.contains("@") }
        return CardParser.trimmed(x)
    }

    private var displayName: String {
        let base = "\(d.name.trimmingCharacters(in: .whitespaces)) \(d.title.trimmingCharacters(in: .whitespaces))".trimmingCharacters(in: .whitespaces)
        let co = d.company.trimmingCharacters(in: .whitespaces)
        return co.isEmpty ? base : "\(base)(\(co))"
    }

    private var mustAsk: Bool { candidates.contains { $0.nameDiffers } }
    private var canSave: Bool {
        !d.name.trimmingCharacters(in: .whitespaces).isEmpty && searched && !searching && choice != nil && !saving
    }

    var body: some View {
        Form {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(Array(input.pages.enumerated()), id: \.offset) { i, img in
                            Image(uiImage: img).resizable().scaledToFit().frame(height: 120)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .accessibilityLabel(i == 0 ? "명함 앞면" : "명함 뒷면")
                        }
                    }
                }
                LabeledContent("저장될 이름", value: displayName.isEmpty ? "—" : displayName)
                    .accessibilityIdentifier("cardDisplayName")
            } footer: {
                Text("모든 칸을 고칠 수 있어요. '저장'을 눌러야만 Google 연락처에 써요.")
            }

            Section("사람") {
                field("이름", $d.name, id: "cardName")
                field("회사", $d.company, id: "cardCompany")
                field("부서", $d.department, id: "cardDept")
                field("직함", $d.title, id: "cardTitle")
            }
            Section("연락처") {
                field("휴대폰", $d.mobile, id: "cardMobile", kb: .phonePad)
                field("회사 전화", $d.workPhone, id: "cardWork", kb: .phonePad)
                field("팩스", $d.fax, id: "cardFax", kb: .phonePad)
                field("이메일", Binding(get: { d.emails.first ?? "" }, set: { d.emails = [$0] }), id: "cardEmail", kb: .emailAddress)
                field("이메일 2", $email2, id: "cardEmail2", kb: .emailAddress)
                VStack(alignment: .leading, spacing: 4) {
                    Text("주소")
                    TextField("주소", text: $d.address, axis: .vertical)
                        .lineLimit(1...4)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("cardAddress")
                }
                field("웹", $d.website, id: "cardWeb", kb: .URL)
            }

            Section {
                if searching {
                    HStack { ProgressView(); Text("같은 사람을 찾는 중…") }
                } else if let searchError {
                    Text(searchError).foregroundStyle(.red)
                    if needsConnect {
                        Button {
                            Task {
                                await CardsStore.shared.connect()
                                if CardsStore.shared.status?.connected == true { scheduleSearch(immediate: true) }
                            }
                        } label: {
                            Label(CardsStore.shared.busy ? "연결하는 중…" : "Google 연락처 연결하기", systemImage: "person.crop.circle.badge.plus")
                        }
                        .disabled(CardsStore.shared.busy)
                        .accessibilityIdentifier("cardConnectInline")
                    }
                    Button("다시 찾기") { scheduleSearch(immediate: true) }
                } else if searched {
                    if candidates.isEmpty {
                        choiceRow(id: "create", title: "새 연락처로 만들기", subtitle: "같은 휴대폰·이메일을 가진 연락처가 없어요")
                    } else {
                        ForEach(candidates) { c in
                            choiceRow(
                                id: c.resourceName,
                                title: "기존 \(c.name) 갱신",
                                subtitle: candidateLine(c),
                                warning: c.nameDiffers ? "번호·메일은 같은데 이름이 달라요. 같은 사람인지 확인해 주세요." : nil
                            )
                        }
                        choiceRow(id: "create", title: "새로 만들기", subtitle: "기존 연락처는 그대로 두고 따로 만들어요")
                    }
                }
            } header: {
                Text("저장 방법")
            } footer: {
                Text("갱신하면 회사·직함은 이 명함으로 바꾸고, 예전 회사·직함은 메모에 '이전 명함'으로 남겨요. 전화·이메일은 더하기만 하고 지우지 않아요. 라벨 'Card'를 더해요.")
            }
        }
        .navigationTitle("명함 확인")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saving ? "저장 중…" : "저장") { Task { await save() } }
                    .disabled(!canSave)
                    .accessibilityIdentifier("cardSave")
            }
        }
        .task { scheduleSearch(immediate: true) }
        .onChange(of: d.mobile) { _, _ in scheduleSearch() }
        .onChange(of: d.emails) { _, _ in scheduleSearch() }
        .onChange(of: email2) { _, _ in scheduleSearch() }
        .onChange(of: d.name) { _, _ in if candidates.isEmpty { scheduleSearch() } }
        .onChange(of: CardsStore.shared.message) { _, m in if let m { notice = m; CardsStore.shared.message = nil } }
        .alert("알림", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(notice ?? "") }
        .alert("저장했어요", isPresented: Binding(get: { savedText != nil }, set: { if !$0 { savedText = nil } })) {
            Button("확인") { finished(); dismiss() }
            if savedUndo != nil {
                Button("방금 저장 되돌리기", role: .destructive) { Task { await undoNow() } }
            }
        } message: { Text(savedText ?? "") }
    }

    private func field(_ label: String, _ text: Binding<String>, id: String, kb: UIKeyboardType = .default) -> some View {
        LabeledContent(label) {
            TextField(label, text: text)
                .multilineTextAlignment(.trailing)
                .keyboardType(kb)
                .textInputAutocapitalization(kb == .default ? .words : .never)
                .autocorrectionDisabled()
                .accessibilityIdentifier(id)
        }
    }

    private func candidateLine(_ c: CardCandidate) -> String {
        var parts: [String] = []
        let org = [c.company, c.title].filter { !$0.isEmpty }.joined(separator: " ")
        if !org.isEmpty { parts.append(org) }
        if let p = c.phones.first { parts.append(p) }
        if let e = c.emails.first { parts.append(e) }
        let why = c.reasons.map { $0 == "mobile" ? "휴대폰 같음" : $0 == "email" ? "이메일 같음" : "이름·전화 같음" }.joined(separator: "·")
        return ([why] + parts).joined(separator: " · ")
    }

    private func choiceRow(id: String, title: String, subtitle: String, warning: String? = nil) -> some View {
        Button {
            choice = id
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: choice == id ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(choice == id ? Theme.accent : .secondary)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).foregroundStyle(.primary)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                    if let warning {
                        Label(warning, systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.orange)
                    }
                }
            }
        }
        .accessibilityIdentifier(id == "create" ? "cardChoiceCreate" : "cardChoiceUpdate")
        .accessibilityAddTraits(choice == id ? .isSelected : [])
    }

    private func scheduleSearch(immediate: Bool = false) {
        searchTask?.cancel()
        searchTask = Task {
            if !immediate { try? await Task.sleep(nanoseconds: 700_000_000) }
            if Task.isCancelled { return }
            await search()
        }
    }

    private func search() async {
        guard !d.name.trimmingCharacters(in: .whitespaces).isEmpty else {
            searched = false; candidates = []; choice = nil; return
        }
        searching = true
        searchError = nil
        needsConnect = false
        defer { searching = false }
        do {
            let r = try await CardsStore.shared.match(draftForSave)
            if Task.isCancelled { return }
            apply(candidates: r.candidates, suggested: r.suggested)
            searched = true
        } catch is CancellationError {
            return
        } catch let e as APIError {
            if case .server(_, let code) = e, code == 409 { needsConnect = true }
            searchError = e.errorDescription ?? "같은 사람을 찾지 못했어요."
        } catch {
            searchError = "같은 사람을 찾지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    private func apply(candidates new: [CardCandidate], suggested: CardSuggested?) {
        candidates = new
        if new.isEmpty { choice = "create"; return }
        // 이름이 다른 후보가 있으면 미리 고르지 않는다 — 반드시 직접 고르게
        if new.contains(where: { $0.nameDiffers }) { choice = nil; return }
        if let s = suggested, s.kind == "update", let rn = s.resourceName { choice = rn } else { choice = nil }
    }

    private func save() async {
        guard let pick = choice else { return }
        saving = true
        defer { saving = false }
        let draft = draftForSave
        let sug = pick == "create" ? CardSuggested(kind: "create", resourceName: nil) : CardSuggested(kind: "update", resourceName: pick)
        switch await CardsStore.shared.save(draft, choice: sug, seen: candidates.map(\.resourceName), photos: input.pages) {
        case .saved(let kind, let name, let undoID):
            CardFixCounter.record(parsed: input.parsed, saved: draft)
            savedUndo = undoID
            savedText = kind == "updated" ? "\(name) 연락처를 갱신했어요." : "\(name) 연락처를 만들었어요."
        case .recheck(let msg, let cands):
            apply(candidates: cands, suggested: nil)
            choice = nil
            notice = msg
        case .failed(let msg):
            notice = msg
        }
    }

    /// 저장 직후 '되돌리기' — 되돌리면 이 화면에 그대로 남아 고쳐서 다시 저장할 수 있다
    private func undoNow() async {
        guard let id = savedUndo, let item = CardsUndo.item(id) else { return }
        undoing = true
        defer { undoing = false }
        savedUndo = nil
        switch await CardsStore.shared.undo(item) {
        case .done:
            notice = item.kind == "created" ? "방금 만든 연락처와 명함 사진을 지웠어요. 고쳐서 다시 저장할 수 있어요." : "갱신 전으로 되돌렸어요. 고쳐서 다시 저장할 수 있어요."
            scheduleSearch(immediate: true)
        case .changed(let m), .failed(let m):
            notice = m
        }
    }
}
