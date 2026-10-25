import Foundation

/// 가입 없이 둘러보기(개선-47)에서 쓰는 예시 응답 — 앱 안의 가짜 데이터만 쓴다.
/// 사람·아이디는 모두 '예시'이고, 아이디에 마침표를 넣어 실제 계정(소문자·숫자·_·- 만 허용)과 겹칠 수 없다.
/// 날짜는 실행한 날 기준: @D(일수,HH:mm) = 그날 그 시각, @DATE(일수) = yyyy-MM-dd, @WEEK(주) = 이번 주 월요일 0시에서 그만큼.
enum BrowseFixtures {
    static var username: String { storeNames ? "harin.design" : "example.user" }
    /// '손님에게 이렇게 보여요' — 같은 예시 사용자를 남의 눈으로(isMe·isMine false) 보는 별칭
    static var guestPreviewUsername: String { username + ".guest" }

    /// 스토어 촬영용(DEBUG, STORE_NAMES=1) — '예시 …' 대신 자연스러운 가상 이름(성 없이). 둘러보기 화면은 그대로 '예시'.
    /// 실제 가입자 표시명과 겹치지 않는지 10/25 대조함.
    static var storeNames: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["STORE_NAMES"] == "1"
        #else
        false
        #endif
    }
    private static let storeNameMap: [(String, String)] = [
        ("예시 게스트 A", "민준"), ("예시 게스트 B", "서연"), ("예시 게스트 C", "지호"), ("예시 게스트 D", "유나"),
        ("예시 게스트 E", "도윤"), ("예시 게스트", "민준"), ("예시 동료", "수아"), ("예시 친구", "준서"),
        ("예시 사용자", "하린"), ("예시 코치", "시우"), ("예시 디자이너", "하은"), ("example.user", "harin.design"),
        // 색도 배경 보라와 한 계열로 — 사용자가 고르는 색(캘린더·사람·분류)만. 앱 UI 색(하트·상태 배지)은 그대로.
        ("#22c55e", "#3730a3"), ("#f59e0b", "#a5b4fc"),
        ("#E8775A", "#4338CA"), ("#5A9BE8", "#6366F1"), ("#22C55E", "#818CF8"), ("#F59E0B", "#A5B4FC"),
    ]

    /// 둘러보기용 예시 사용자
    static var user: User? {
        guard let data = fill(me).data(using: .utf8) else { return nil }
        return (try? JSONDecoder().decode(MeResponse.self, from: data))?.user
    }

    /// GET 경로(쿼리 포함)에 맞는 예시 JSON — 없으면 nil
    static func json(for rawPath: String) -> Data? {
        let parts = rawPath.split(separator: "?", maxSplits: 1)
        let path = String(parts[0])
        let segments = path.split(separator: "/").map(String.init)   // ["api","v1",...]
        guard segments.count >= 3, segments[0] == "api", segments[1] == "v1" else { return nil }
        let rest = Array(segments.dropFirst(2))
        let template: String?
        switch rest {
        case ["me"]: template = me
        case ["calendars"]: template = calendars
        case ["calendar", "events"]: template = events
        case ["slots"]: template = slots
        case ["bookings"]:
            template = rawPath.contains("archived=1") ? emptyBookings : bookings
        case ["google", "status"]: template = #"{"connected":false,"extraAccounts":[]}"#
        case ["work-hours"]: template = workHours
        case ["time-asset", "summary"]: template = summary
        case ["time-asset", "settings"]: template = settings
        case ["ratings"]: template = ratings
        case ["recommendations"]: template = recommendations
        case ["people"]: template = contacts
        case ["orbit"]: template = orbit
        case ["orbit", "stream"]: template = stream
        case ["notification-prefs"]: template = notificationPrefs
        case ["menus"]: template = #"{"menus":[]}"#
        case ["location-buffers"]: template = #"{"buffers":[]}"#
        case ["calendars", "goals"]: template = #"{"goals":[]}"#
        case ["blocks"]: template = #"{"users":[]}"#
        case ["reminders"]: template = #"{"reminders":[]}"#
        case ["timeline"]: template = timeline
        default:
            if rest.count == 2, rest[0] == "users" { template = profile(rest[1]) }
            else if rest.count == 4, rest[0] == "users", rest[2] == "slots" { template = slotBooking(username: rest[1], slug: rest[3]) }
            else if rest.count == 2, rest[0] == "slots" { template = slotDetail(id: rest[1]) }
            else { template = nil }
        }
        guard let template else { return nil }
        return fill(template).data(using: .utf8)
    }

    // MARK: - 날짜 토큰

    private static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        c.firstWeekday = 2
        return c
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = .current
        return f
    }()

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func fill(_ template: String) -> String {
        let today = calendar.startOfDay(for: Date())
        var out = template
        if storeNames {
            for (from, to) in storeNameMap { out = out.replacingOccurrences(of: from, with: to) }
        }
        out = replace(out, pattern: #"@D\((-?\d+),(\d{2}):(\d{2})\)"#) { g in
            let day = calendar.date(byAdding: .day, value: Int(g[0])!, to: today)!
            let date = calendar.date(bySettingHour: Int(g[1])!, minute: Int(g[2])!, second: 0, of: day)!
            return iso.string(from: date)
        }
        out = replace(out, pattern: #"@DATE\((-?\d+)\)"#) { g in
            dayFormatter.string(from: calendar.date(byAdding: .day, value: Int(g[0])!, to: today)!)
        }
        let monday = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        out = replace(out, pattern: #"@WEEK\((-?\d+)\)"#) { g in
            iso.string(from: calendar.date(byAdding: .day, value: 7 * Int(g[0])!, to: monday)!)
        }
        out = replace(out, pattern: #"@MONTH\((-?\d+)\)"#) { g in
            let m = calendar.date(byAdding: .month, value: Int(g[0])!, to: today)!
            let c = calendar.dateComponents([.year, .month], from: m)
            return String(format: "%04d-%02d", c.year!, c.month!)
        }
        return out
    }

    private static func replace(_ s: String, pattern: String, _ make: ([String]) -> String) -> String {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return s }
        let ns = s as NSString
        var result = ""
        var last = 0
        for m in re.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            result += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            let groups = (1..<m.numberOfRanges).map { ns.substring(with: m.range(at: $0)) }
            result += make(groups)
            last = m.range.location + m.range.length
        }
        result += ns.substring(from: last)
        return result
    }

    // MARK: - 예시 데이터

    private static let me = #"""
    {"user":{"username":"example.user","displayName":"예시 사용자","email":null,"avatarUrl":null,"emailVerified":true,
    "bio":"브랜드 디자이너 · 커피챗과 포트폴리오 멘토링을 해요","birthDate":null,"socialLinks":{},"interests":["디자인","브랜딩"],
    "orbiters":12,"orbiting":8,"isPrivate":false,"appleLinked":false,"shareImageUrl":null,"linkTheme":"default","paymentInstructions":"예시은행 000-0000-0000 예시 사용자"}}
    """#

    private static let calendarsList = #"""
    [{"id":"browse-cal-work","name":"업무","purpose":"work","color":"#6366f1","visibility":"private","source":"native","isDefault":true,
      "hourlyRateKrw":null,"goalTitle":null,"goalTargetHours":null,"goalDeadline":null,"goalStartedAt":null,"archivedAt":null,"sharedRole":null,"sharedByUsername":null,"sharedByName":null},
     {"id":"browse-cal-life","name":"개인","purpose":"personal","color":"#22c55e","visibility":"private","source":"native","isDefault":false,
      "hourlyRateKrw":null,"goalTitle":null,"goalTargetHours":null,"goalDeadline":null,"goalStartedAt":null,"archivedAt":null,"sharedRole":null,"sharedByUsername":null,"sharedByName":null}]
    """#

    private static var calendars: String { #"{"calendars":"# + calendarsList + "}" }

    private static func event(_ id: String, _ title: String, _ start: String, _ end: String, cal: String = "browse-cal-work",
                              allDay: Bool = false, booking: Bool = false, completed: Bool = false, rating: Int? = nil,
                              location: String? = nil, importance: String = "normal", bucket: String? = nil) -> String {
        let loc = location.map { "\"\($0)\"" } ?? "null"
        return """
        {"id":"\(id)","title":"\(title)","description":null,"startAt":"\(start)","endAt":"\(end)","allDay":\(allDay),"calendarId":"\(cal)","source":"local",
        "tentative":false,"location":\(loc),"locationLat":null,"locationLng":null,"travelMin":null,"isBooking":\(booking),"bookingId":\(booking ? "\"browse-b-\(id)\"" : "null"),
        "bookingRole":\(booking ? "\"host\"" : "null"),"isRecurring":false,"seriesId":null,"originalStart":null,"isAnniversary":false,"anniversaryYears":null,
        "bucketOverride":\(bucket.map { "\"\($0)\"" } ?? "null"),"earningKrw":null,"autoValueKrw":0,"completed":\(completed),"status":null,"importance":"\(importance)","rating":\(rating.map(String.init) ?? "null"),
        "ratingNote":null,"reminderMinutes":null,"remindAt":null}
        """
    }

    private static var events: String {
        let list = [
            event("browse-e1", "디자인 스터디", "@D(-2,10:00)", "@D(-2,12:00)", cal: "browse-cal-life", completed: true, rating: 5, bucket: "invest"),
            event("browse-e2", "주간 회고", "@D(-1,15:00)", "@D(-1,16:00)", completed: true, rating: 4),
            event("browse-e3", "아침 운동", "@D(0,07:30)", "@D(0,08:30)", cal: "browse-cal-life", completed: true, rating: 5),
            event("browse-e4", "커피챗 30분 — 예시 게스트", "@D(0,11:00)", "@D(0,11:30)", booking: true, location: "성수"),
            event("browse-e5", "브랜드 시안 작업", "@D(0,14:00)", "@D(0,16:00)", importance: "high"),
            event("browse-e6", "마감: 로고 최종본", "@DATE(1)", "@DATE(1)", allDay: true),
            event("browse-e7", "멘토링 60분 — 예시 게스트", "@D(1,10:00)", "@D(1,11:00)", booking: true, location: "Google Meet"),
            event("browse-e8", "저녁 약속", "@D(1,19:00)", "@D(1,20:30)", cal: "browse-cal-life"),
            event("browse-e9", "포트폴리오 리뷰", "@D(2,13:00)", "@D(2,14:00)"),
            event("browse-e10", "요가", "@D(3,08:00)", "@D(3,09:00)", cal: "browse-cal-life"),
            event("browse-e11", "클라이언트 미팅", "@D(4,16:00)", "@D(4,17:00)", location: "강남"),
        ] + denseDay + storeDay
        return #"{"events":["# + list.joined(separator: ",") + ##"],"calendars":[{"id":"browse-cal-work","name":"업무","color":"#6366f1","purpose":"work","source":"native","isDefault":true},{"id":"browse-cal-life","name":"개인","color":"#22c55e","purpose":"personal","source":"native","isDefault":false}]}"##
    }

    /// 스토어 촬영용(DEBUG, BROWSE_STORE_DAY=1) — 오늘 07:00~17:00 을 채운다(완료 2·중요 2, 짧은·긴 일정)
    private static var storeDay: [String] {
        #if DEBUG
        guard ProcessInfo.processInfo.environment["BROWSE_STORE_DAY"] == "1" else { return [] }
        return [
            event("browse-st1", "팀 스탠드업", "@D(0,09:00)", "@D(0,09:30)", completed: true),
            event("browse-st2", "점심 · 디자인 스터디", "@D(0,12:00)", "@D(0,13:00)", cal: "browse-cal-life"),
            event("browse-st3", "피드백 정리", "@D(0,16:15)", "@D(0,17:00)", importance: "high"),
            event("browse-st4", "메일 답장", "@D(0,10:00)", "@D(0,10:30)"),
        ]
        #else
        return []
        #endif
    }

    /// UI 테스트용(DEBUG, BROWSE_DENSE_DAY=1) — 오늘을 긴 일정으로 거의 채운다 (개선-50 스크롤 확인)
    private static var denseDay: [String] {
        #if DEBUG
        guard ProcessInfo.processInfo.environment["BROWSE_DENSE_DAY"] == "1" else { return [] }
        return [
            event("browse-d1", "긴 일정 A", "@D(0,00:30)", "@D(0,07:00)"),
            event("browse-d2", "긴 일정 B", "@D(0,08:30)", "@D(0,11:00)"),
            event("browse-d3", "긴 일정 C", "@D(0,11:30)", "@D(0,14:00)"),
            event("browse-d4", "긴 일정 D", "@D(0,16:00)", "@D(0,19:30)"),
            event("browse-d5", "긴 일정 E", "@D(0,19:30)", "@D(0,23:30)"),
        ]
        #else
        return []
        #endif
    }



    private static func contact(_ id: String, _ name: String, color: String, ring: Int, days: Int, meetings: Int, hours: Double, last: String, next: String?) -> String {
        """
        {"id":"\(id)","name":"\(name)","email":null,"company":null,"role":null,"memo":null,"status":"active","source":"calendar","color":"\(color)","member":null,
        "following":false,"lastMetAt":"@D(-\(days),10:00)","daysSince":\(days),"meetings90":\(meetings),"meetingsTotal":\(meetings),"hoursTogether":\(hours),
        "lastMeetingTitle":"\(last)","nextMeetingAt":\(next.map { "\"\($0)\"" } ?? "null"),"nextMeetingTitle":\(next == nil ? "null" : "\"다음 만남\""),"ring":\(ring),"archivedAt":null}
        """
    }

    private static var contacts: String {
        let list = [
            contact("browse-p1", "예시 게스트 A", color: "#E8775A", ring: 1, days: 3, meetings: 4, hours: 3.5, last: "커피챗 30분", next: "@D(0,11:00)"),
            contact("browse-p2", "예시 게스트 B", color: "#5A9BE8", ring: 1, days: 6, meetings: 2, hours: 2, last: "포트폴리오 멘토링 60분", next: "@D(1,10:00)"),
            contact("browse-p3", "예시 동료", color: "#22C55E", ring: 2, days: 14, meetings: 3, hours: 4, last: "주간 회고", next: nil),
            contact("browse-p4", "예시 친구", color: "#F59E0B", ring: 3, days: 40, meetings: 1, hours: 1.5, last: "저녁 약속", next: nil),
        ]
        return #"{"people":["# + list.joined(separator: ",") + #"],"followingOnly":[],"suggestions":[],"archived":[],"nudges":[],"importEnabled":false,"googleConnected":false,"syncedAt":null}"#
    }

    private static func slot(_ id: String, _ slug: String, _ title: String, _ description: String, minutes: Int, price: Int, owner: String = "example.user") -> String {
        """
        {"id":"\(id)","slug":"\(slug)","title":"\(title)","description":"\(description)","durationMin":\(minutes),"priceCents":\(price * 100),"currency":"KRW",
        "capacity":1,"slotType":"1on1","mode":"auto","pricingModel":"fixed","active":true,"autoApprove":\(price == 0),"paymentMethod":"\("offline")",
        "shareUrl":"https://orbit42.org/\(owner)/s/\(slug)","createdAt":"@D(-20,09:00)"}
        """
    }

    private static let mySlots = [
        slot("browse-s1", "coffee-chat-30", "커피챗 30분", "커피 한 잔 하며 편하게 이야기해요.", minutes: 30, price: 0),
        slot("browse-s2", "mentoring-60", "포트폴리오 멘토링 60분", "포트폴리오를 같이 보며 다음 단계를 정해요.", minutes: 60, price: 50000),
    ]

    private static var slots: String { #"{"slots":["# + mySlots.joined(separator: ",") + "]}" }

    private static func booking(_ id: String, _ start: String, _ end: String, status: String, guest: String, title: String, slug: String, price: Int, location: String?, payment: String? = nil) -> String {
        """
        {"id":"\(id)","scheduledAt":"\(start)","scheduledEndAt":"\(end)","status":"\(status)","message":"잘 부탁드려요!","guestName":"\(guest)","guestUsername":null,
        "guestEmail":null,"priceCents":\(price * 100),"payment":\(payment.map { "{\"status\":\"\($0)\",\"dueAt\":\"@D(1,23:00)\",\"instructions\":null}" } ?? "null"),"slotTitle":"\(title)","slotSlug":"\(slug)","locationDetail":\(location.map { "\"\($0)\"" } ?? "null"),"menus":[],"reschedule":null}
        """
    }

    private static var bookings: String {
        let host = [
            booking("browse-b1", "@D(2,15:00)", "@D(2,15:30)", status: "pending", guest: "예시 게스트 C", title: "커피챗 30분", slug: "coffee-chat-30", price: 0, location: "성수"),
            booking("browse-b5", "@D(3,10:00)", "@D(3,11:00)", status: "pending", guest: "예시 게스트 E", title: "포트폴리오 멘토링 60분", slug: "mentoring-60", price: 50000, location: "Google Meet", payment: "awaiting"),
            booking("browse-b-browse-e4", "@D(0,11:00)", "@D(0,11:30)", status: "confirmed", guest: "예시 게스트 A", title: "커피챗 30분", slug: "coffee-chat-30", price: 0, location: "성수"),
            booking("browse-b-browse-e7", "@D(1,10:00)", "@D(1,11:00)", status: "confirmed", guest: "예시 게스트 B", title: "포트폴리오 멘토링 60분", slug: "mentoring-60", price: 50000, location: "Google Meet", payment: "paid"),
            booking("browse-b4", "@D(-6,14:00)", "@D(-6,15:00)", status: "completed", guest: "예시 게스트 D", title: "포트폴리오 멘토링 60분", slug: "mentoring-60", price: 50000, location: "Google Meet"),
        ]
        return #"{"host":["# + host.joined(separator: ",") + #"],"guest":[],"pendingTimeRequests":0,"timeRequests":[]}"#
    }

    private static let emptyBookings = #"{"host":[],"guest":[],"pendingTimeRequests":0,"timeRequests":[]}"#

    private static let workHours = #"""
    {"workHours":{"mon":{"start":"10:00","end":"18:00"},"tue":{"start":"10:00","end":"18:00"},"wed":{"start":"10:00","end":"18:00"},"thu":{"start":"10:00","end":"18:00"},"fri":{"start":"10:00","end":"18:00"}}}
    """#

    private static let people: [(username: String, name: String, interests: String, slots: [String])] = [
        ("coach.example", "예시 코치", #"["커리어","코칭"]"#,
         [slot("browse-s3", "career-chat", "커리어 상담 40분", "이직·커리어 고민을 같이 정리해요.", minutes: 40, price: 30000, owner: "coach.example")]),
        ("designer.example", "예시 디자이너", #"["UX","디자인"]"#,
         [slot("browse-s4", "ux-review", "UX 리뷰 30분", "화면 흐름을 같이 봐요.", minutes: 30, price: 0, owner: "designer.example")]),
    ]

    private static var orbit: String {
        let list = people.map { p in
            #"{"username":""# + p.username + #"","displayName":""# + p.name + #"","avatarUrl":null,"interests":"# + p.interests + #","slots":["# + p.slots.joined(separator: ",") + "]}"
        }
        return #"{"people":["# + list.joined(separator: ",") + "]}"
    }

    private static var stream: String {
        let items = people.enumerated().map { i, p in
            #"{"id":"browse-st\#(i)","type":"slot","createdAt":"@D(-\#(i + 1),12:00)","username":""# + p.username + #"","displayName":""# + p.name + #"","avatarUrl":null,"slot":"# + p.slots[0] + "}"
        }
        return #"{"items":["# + items.joined(separator: ",") + "]}"
    }

    private static var recommendations: String {
        let list = people.map { p in
            #"{"username":""# + p.username + #"","displayName":""# + p.name + #"","avatarUrl":null,"bio":null,"interests":"# + p.interests + #","overlapCount":1}"#
        }
        return #"{"users":["# + list.joined(separator: ",") + "]}"
    }

    private static func profile(_ username: String) -> String? {
        if username == Self.guestPreviewUsername {
            return #"{"user":{"username":"example.user","displayName":"예시 사용자","avatarUrl":null,"bio":"브랜드 디자이너 · 커피챗과 포트폴리오 멘토링을 해요","interests":["디자인","브랜딩"],"socialLinks":{},"education":[],"experience":[]},"orbiters":12,"orbiting":8,"isFollowing":false,"isMe":false,"isBlocked":false,"rating":null,"slots":["# + mySlots.joined(separator: ",") + "]}"
        }
        if username == Self.username {
            return #"{"user":{"username":"example.user","displayName":"예시 사용자","avatarUrl":null,"bio":"브랜드 디자이너 · 커피챗과 포트폴리오 멘토링을 해요","interests":["디자인","브랜딩"],"socialLinks":{},"education":[],"experience":[]},"orbiters":12,"orbiting":8,"isFollowing":false,"isMe":true,"isBlocked":false,"rating":null,"slots":["# + mySlots.joined(separator: ",") + "]}"
        }
        guard let p = people.first(where: { $0.username == username }) else { return nil }
        return #"{"user":{"username":""# + p.username + #"","displayName":""# + p.name + #"","avatarUrl":null,"bio":"예시 프로필이에요","interests":"# + p.interests + #","socialLinks":{},"education":[],"experience":[]},"orbiters":30,"orbiting":20,"isFollowing":false,"isMe":false,"isBlocked":false,"rating":null,"slots":["# + p.slots.joined(separator: ",") + "]}"
    }

    private static func slotDetail(id: String) -> String? {
        let all: [(String, String, String, String, Int, Int)] = [
            ("browse-s1", "coffee-chat-30", "커피챗 30분", "커피 한 잔 하며 편하게 이야기해요.", 30, 0),
            ("browse-s2", "mentoring-60", "포트폴리오 멘토링 60분", "포트폴리오를 같이 보며 다음 단계를 정해요.", 60, 50000),
        ]
        guard let s = all.first(where: { $0.0 == id }) else { return nil }
        return """
        {"slot":{"id":"\(s.0)","slug":"\(s.1)","title":"\(s.2)","description":"\(s.3)","durationMin":\(s.4),"priceCents":\(s.5 * 100),"currency":"KRW","capacity":1,"slotType":"1on1",
        "mode":"auto","pricingModel":"fixed","active":true,"autoApprove":\(s.5 == 0),"paymentMethod":"\("offline")","shareUrl":"https://orbit42.org/example.user/s/\(s.1)",
        "createdAt":"@D(-20,09:00)","locations":["성수","Google Meet"],
        "workingHours":{"mon":[{"start":"10:00","end":"18:00"}],"tue":[{"start":"10:00","end":"18:00"}],"wed":[{"start":"10:00","end":"18:00"}],"thu":[{"start":"10:00","end":"18:00"}],"fri":[{"start":"10:00","end":"18:00"}]},
        "slotIntervalMin":\(s.4),"minNoticeHours":4,"maxAdvanceDays":30,"bufferMin":10,"validFrom":null,"validUntil":null,"imageUrls":[],"menuIds":[]}}
        """
    }

    private static func slotBooking(username: String, slug: String) -> String? {
        var owner = username.removingPercentEncoding ?? username
        if owner == Self.guestPreviewUsername { owner = Self.username }
        let slug = slug.removingPercentEncoding ?? slug
        let catalog: [(owner: String, slug: String, title: String, desc: String, minutes: Int, price: Int, host: String)] = [
            (Self.username, "coffee-chat-30", "커피챗 30분", "커피 한 잔 하며 편하게 이야기해요.", 30, 0, "예시 사용자"),
            (Self.username, "mentoring-60", "포트폴리오 멘토링 60분", "포트폴리오를 같이 보며 다음 단계를 정해요.", 60, 50000, "예시 사용자"),
            ("coach.example", "career-chat", "커리어 상담 40분", "이직·커리어 고민을 같이 정리해요.", 40, 30000, "예시 코치"),
            ("designer.example", "ux-review", "UX 리뷰 30분", "화면 흐름을 같이 봐요.", 30, 0, "예시 디자이너"),
        ]
        guard let s = catalog.first(where: { $0.owner == owner && $0.slug == slug }) else { return nil }
        var options: [String] = []
        for day in 1...6 {
            for hour in [10, 11, 14, 15, 16] {
                let end = hour * 60 + s.minutes
                options.append(String(format: #"{"startAt":"@D(%d,%02d:00)","endAt":"@D(%d,%02d:%02d)","remaining":1,"availabilityId":null,"closed":false}"#,
                                      day, hour, day, end / 60, end % 60))
            }
        }
        return """
        {"slot":{"id":"browse-\(s.slug)","slug":"\(s.slug)","title":"\(s.title)","description":"\(s.desc)","durationMin":\(s.minutes),"priceCents":\(s.price * 100),
        "pricingModel":"fixed","capacity":1,"slotType":"1on1","locations":["성수","Google Meet"],"autoApprove":\(s.price == 0),"imageUrls":[],"hostUsername":"\(s.owner)",
        "hostName":"\(s.host)","isMine":false,"paymentMethod":"\("offline")"},"menus":[],"options":[\(options.joined(separator: ","))]}
        """
    }

    private static let summary = #"""
    {"hourlyValueKrw":50000,"conversions":{"day":400000,"week":2000000,"month":10450000,"year":125400000},"weekStart":"@WEEK(0)",
    "buckets":[{"key":"earn","label":"수입","description":"지금 돈을 버는 시간","color":"#6366f1","hours":9,"valueKrw":450000,"ratio":0.45},
    {"key":"invest","label":"투자","description":"미래 가치를 올리는 시간","color":"#22c55e","hours":5,"valueKrw":250000,"ratio":0.25},
    {"key":"spend","label":"소비","description":"즐기고 쉬는 시간","color":"#f59e0b","hours":3,"valueKrw":150000,"ratio":0.15},
    {"key":"life","label":"생활","description":"그 외 일상","color":"#64748b","hours":3,"valueKrw":150000,"ratio":0.15}],
    "scheduledHours":20,"sleepHoursPerDay":7,"sleepHoursPerWeek":49,"unrecordedHours":99,
    "trend":[{"weekStart":"@WEEK(-3)","hoursByBucket":{"earn":12,"invest":4,"spend":3,"life":5}},{"weekStart":"@WEEK(-2)","hoursByBucket":{"earn":14,"invest":6,"spend":2,"life":4}},
    {"weekStart":"@WEEK(-1)","hoursByBucket":{"earn":11,"invest":5,"spend":4,"life":3}},{"weekStart":"@WEEK(0)","hoursByBucket":{"earn":9,"invest":5,"spend":3,"life":3}}],
    "traded":{"totalBookings":6,"totalHours":5,"totalKrw":200000,"impliedHourlyKrw":40000,"vsIncomeRatio":0.8},
    "messages":["예시 화면이에요. 가입하면 내 일정으로 계산돼요."],
    "actions":[],
    "report":{"weekStart":"@WEEK(-1)","earnedKrw":550000,"investHours":5,"spendHours":4,"scheduledHours":23,"lostHours":96,"deltaEarnedKrw":50000,"deltaInvestHours":1,"deltaLostHours":-3},
    "yearRemaining":{"year":2026,"remainingAwakeHours":1145,"remainingValueKrw":57250000,"progressRatio":0.815},
    "business":{"monthLabel":"@MONTH(0)","monthBookedKrw":200000,"monthManualKrw":0,"monthTotalKrw":200000,
    "earnTrend":[{"month":"@MONTH(-5)","krw":0},{"month":"@MONTH(-4)","krw":100000},{"month":"@MONTH(-3)","krw":150000},{"month":"@MONTH(-2)","krw":100000},{"month":"@MONTH(-1)","krw":250000},{"month":"@MONTH(0)","krw":200000}],
    "funnel":{"openHours":20,"bookedHours":3,"bookedKrw":100000,"unsoldValueKrw":0}},
    "goals":null,"incomeType":"hourly","freelance":null}
    """#

    private static let settings = #"""
    {"incomeType":"hourly","amount":50000,"hourlyValueKrw":50000,
    "bucketMap":{"work":"earn","income":"earn","invest":"invest","learning":"invest","health":"invest","hobby":"spend","social":"spend","couple":"spend","personal":"life","other":"life"},
    "sleepHoursPerDay":7,"birthDate":null,"weeklyEarnGoalKrw":null,"weeklyInvestGoalHours":null,"incomeEntries":[],"monthlyWorkHours":209,
    "purposes":[{"key":"work","label":"업무","defaultBucket":"earn"},{"key":"income","label":"수익","defaultBucket":"earn"},{"key":"invest","label":"투자","defaultBucket":"invest"},
    {"key":"personal","label":"개인","defaultBucket":"life"},{"key":"couple","label":"커플","defaultBucket":"spend"},{"key":"health","label":"건강","defaultBucket":"invest"},
    {"key":"social","label":"사교","defaultBucket":"spend"},{"key":"learning","label":"학습","defaultBucket":"invest"},{"key":"hobby","label":"취미","defaultBucket":"spend"},{"key":"other","label":"기타","defaultBucket":"life"}],
    "bucketOptions":[{"key":"earn","label":"수입","color":"#6366f1"},{"key":"invest","label":"투자","color":"#22c55e"},{"key":"spend","label":"소비","color":"#f59e0b"},{"key":"life","label":"생활","color":"#64748b"}]}
    """#

    private static let ratings = #"""
    {"weeks":8,"thisWeek":{"average":4.5,"count":2},"lastWeek":{"average":4,"count":3},
    "top":[{"eventId":"browse-e1","title":"디자인 스터디","startAt":"@D(-2,10:00)","calendarId":"browse-cal-life","rating":5,"ratingNote":null,"missing":false},
    {"eventId":"browse-e2","title":"주간 회고","startAt":"@D(-1,15:00)","calendarId":"browse-cal-work","rating":4,"ratingNote":null,"missing":false}],
    "bottom":[],"byCalendar":[{"calendarId":"browse-cal-work","average":4,"count":1},{"calendarId":"browse-cal-life","average":5,"count":1}],"average":4.5,"total":2}
    """#

    private static let timeline = #"""
    {"items":[{"id":"browse-e2","title":"주간 회고","startAt":"@D(-1,15:00)","endAt":"@D(-1,16:00)","allDay":false,"hours":1,"calendarId":"browse-cal-work","calendarName":"업무","calendarColor":"#6366f1","goalTitle":null,"imageUrls":[],"note":null,"visibility":null},
    {"id":"browse-e1","title":"디자인 스터디","startAt":"@D(-2,10:00)","endAt":"@D(-2,12:00)","allDay":false,"hours":2,"calendarId":"browse-cal-life","calendarName":"개인","calendarColor":"#22c55e","goalTitle":null,"imageUrls":[],"note":null,"visibility":null}]}
    """#

    private static let notificationPrefs = #"""
    {"prefs":[{"type":"booking_received","label":"예약 요청/확정","inApp":true,"email":true},{"type":"booking_confirmed","label":"예약 확정","inApp":true,"email":true},
    {"type":"booking_canceled","label":"예약 취소","inApp":true,"email":true},{"type":"booking_reminder","label":"예약 리마인더 (하루 전)","inApp":true,"email":true},{"type":"booking_reminder_1h","label":"예약 리마인더 (1시간 전)","inApp":true,"email":true},
    {"type":"event_invite","label":"일정 초대","inApp":true,"email":true},{"type":"new_follower","label":"새 팔로워","inApp":true,"email":true}]}
    """#
}
