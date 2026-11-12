import Foundation

/// 할 일 + 후속 일정 연결 (1.9.0) — /api/v1/todos, /api/v1/calendar/events/follow-ups
struct TodoItem: Decodable, Identifiable, Equatable, Hashable {
    let id: String
    var title: String
    var dueDate: String?
    var done: Bool
    let doneAt: String?
    var sortOrder: Double
    let sourceEventKey: String?
    let sourceTitle: String?
    let sourceStart: String?
    let createdAt: String

    var dueDay: Date? { dueDate.flatMap { APIDateParser.parse($0) } }
    var sourceStartDate: Date? { sourceStart.flatMap { APIDateParser.parse($0) } }
}

struct TodoListResponse: Decodable {
    let overdue: [TodoItem]
    let today: [TodoItem]
    let upcoming: [TodoItem]
    let someday: [TodoItem]
    let done: [TodoItem]
    let today_date: String
}

struct TodoDayResponse: Decodable {
    let todos: [TodoItem]
    let overdue: Int
}

struct TodoDraft: Encodable {
    let title: String
    var dueDate: String?
}

struct TodoCreateRequest: Encodable {
    let items: [TodoDraft]
    var sourceEventKey: String?
}

struct TodoCreateResponse: Decodable { let todos: [TodoItem] }
struct TodoUpdateResponse: Decodable { let todo: TodoItem }

/// PATCH — 보낸 칸만 바꾼다. 기한을 지우려면 clearDue = true (dueDate: null 을 보낸다)
struct TodoPatch: Encodable {
    var title: String?
    var dueDate: String?
    var clearDue = false
    var done: Bool?
    var sortOrder: Double?

    enum CodingKeys: String, CodingKey { case title, dueDate, done, sortOrder }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        if clearDue { try c.encodeNil(forKey: .dueDate) } else { try c.encodeIfPresent(dueDate, forKey: .dueDate) }
        try c.encodeIfPresent(done, forKey: .done)
        try c.encodeIfPresent(sortOrder, forKey: .sortOrder)
    }
}

struct FollowUpSource: Decodable, Equatable {
    let key: String
    let title: String?
    let start: String?
    let allDay: Bool?
    let status: String?
    let missing: Bool?

    var startDate: Date? { start.flatMap { APIDateParser.parse($0) } }
}

/// kind: "event"(후속 일정) | "todo"(할 일)
struct FollowUpItem: Decodable, Identifiable, Equatable {
    let kind: String
    let key: String?
    let id: String?
    let title: String
    let start: String?
    let allDay: Bool?
    let status: String?
    let dueDate: String?
    var done: Bool?

    var identity: String { kind == "todo" ? "todo:\(id ?? "")" : "event:\(key ?? "")" }
    var startDate: Date? { start.flatMap { APIDateParser.parse($0) } }
}

extension FollowUpItem {
    // Identifiable — 할 일과 일정 키가 겹치지 않게
    var stableId: String { identity }
}

struct FollowUpsResponse: Decodable {
    let source: FollowUpSource?
    var followUps: [FollowUpItem]
}

struct FollowUpLinkRequest: Encodable {
    let sourceKey: String
    let targetKey: String
}

/// 메모의 "-", "•", "*", "·" 줄 → 할 일 후보 (서버 bulletLines 와 같은 규칙)
enum MemoBullets {
    static func lines(_ text: String?) -> [String] {
        guard let text else { return [] }
        return text.split(whereSeparator: \.isNewline).compactMap { raw in
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard let first = line.first, "-•*·".contains(first) else { return nil }
            let rest = line.dropFirst().trimmingCharacters(in: .whitespaces)
            return rest.isEmpty ? nil : String(rest)
        }
    }
}

/// 기한 칩: 없음 / 오늘 / 내일 / 다음 주 / 날짜 고르기
enum DueChoice: String, CaseIterable, Identifiable {
    case none, today, tomorrow, nextWeek, pick
    var id: String { rawValue }
    var label: String {
        switch self {
        case .none: return "기한 없음"
        case .today: return "오늘"
        case .tomorrow: return "내일"
        case .nextWeek: return "다음 주"
        case .pick: return "날짜"
        }
    }

    func date(picked: Date, now: Date = Date(), calendar: Calendar = .current) -> Date? {
        let today = calendar.startOfDay(for: now)
        switch self {
        case .none: return nil
        case .today: return today
        case .tomorrow: return calendar.date(byAdding: .day, value: 1, to: today)
        case .nextWeek: return calendar.date(byAdding: .day, value: 7, to: today)
        case .pick: return calendar.startOfDay(for: picked)
        }
    }
}

enum TodoAPI {
    static func create(_ titles: [String], due: Date?, sourceKey: String?) async throws -> [TodoItem] {
        let dueStr = due.map { APIDateParser.encodeDateOnly($0) }
        let items = titles
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(30)
            .map { TodoDraft(title: String($0.prefix(200)), dueDate: dueStr) }
        guard !items.isEmpty else { return [] }
        let r: TodoCreateResponse = try await APIClient.shared.post("/api/v1/todos", body: TodoCreateRequest(items: Array(items), sourceEventKey: sourceKey))
        return r.todos
    }

    static func update(_ id: String, _ patch: TodoPatch) async throws -> TodoItem {
        let r: TodoUpdateResponse = try await APIClient.shared.patch("/api/v1/todos/\(id)", body: patch)
        return r.todo
    }

    static func delete(_ id: String) async throws {
        let _: OkResponse = try await APIClient.shared.delete("/api/v1/todos/\(id)")
    }

    static func followUps(_ eventKey: String) async throws -> FollowUpsResponse {
        let q = eventKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? eventKey
        return try await APIClient.shared.get("/api/v1/calendar/events/follow-ups?key=\(q)")
    }
}
