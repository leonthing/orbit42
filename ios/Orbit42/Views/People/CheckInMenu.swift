import SwiftUI

/// 안부 문구 — Clique 의 '안부 보내기'를 orbit42 에 맞게.
/// 1:1 로 시간을 파는 사람(코치·상담·레슨)이 지난 고객·지인에게 다시 말을 거는 용도라
/// 존댓말로, 대화를 여는 정도로 짧게. 시간대·뜸한 정도·지난 만남 제목에 맞춰 몇 개만 고른다.
/// 같은 날·같은 사람이면 같은 목록이 보이도록 날짜로 섞는다.
enum CheckInMessages {
    private enum When { case any, morning, lunch, evening, weekend }

    private struct Line {
        let text: String
        var when: When = .any
        init(_ text: String, _ when: When = .any) { self.text = text; self.when = when }
    }

    /// 보낼 문구 4개 (부르는 말 포함)
    static func options(for person: Contact, now: Date = .now) -> [String] {
        let name = callName(person)
        // 맨 앞에 그대로 두는 문구 — 오랜만이거나 지난 만남 제목이 있을 때
        var lead: [String] = []
        if let days = person.daysSince, days >= 60 {
            lead.append("\(name), 정말 오랜만이에요! 그동안 잘 지내셨어요?")
        }
        if let title = person.lastMeetingTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
           !title.isEmpty, title.count <= 20 {
            lead.append("\(name), 지난번 '\(title)' 이후로 어떻게 지내세요?")
        }
        let lines: [Line] = [
            Line("\(name), 잘 지내시죠? 문득 생각나서 연락드려요."),
            Line("\(name), 요즘 어떻게 지내세요? 근황이 궁금해서요."),
            Line("\(name), 지난번에 나눈 이야기 이후로 어떻게 되셨는지 궁금해요."),
            Line("좋은 아침이에요, \(name)! 요즘 어떻게 지내세요?", .morning),
            Line("\(name), 점심 맛있게 드셨어요? 시간 되실 때 커피 한잔해요.", .lunch),
            Line("\(name), 오늘도 수고 많으셨어요. 요즘 근황 궁금해요.", .evening),
            Line("\(name), 즐거운 주말 보내고 계세요? 다음 주에 시간 되시면 한번 봬요.", .weekend),
        ]
        return pick(lead: lead, lines: lines, seedKey: person.id, now: now, count: 4)
    }

    /// 예약 링크를 붙인 문구 — 다시 만날 시간을 상대가 직접 고르게.
    static func withLink(for person: Contact, link: String) -> [String] {
        let name = callName(person)
        return [
            "\(name), 잘 지내시죠? 편하실 때 한번 봬요. 여기서 시간 골라주시면 맞춰둘게요 → \(link)",
            "\(name), 요즘 어떠세요? 이야기 나누고 싶으시면 편한 시간으로 잡아주세요 → \(link)",
        ]
    }

    /// "김지우님" — 이름 뒤에 '님'을 붙인다 (이미 붙어 있으면 그대로)
    private static func callName(_ person: Contact) -> String {
        let name = person.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.hasSuffix("님") ? name : "\(name)님"
    }

    private static func pick(lead: [String], lines: [Line], seedKey: String, now: Date, count: Int) -> [String] {
        let cal = Calendar.current
        let hour = cal.component(.hour, from: now)
        let current: When? = cal.isDateInWeekend(now) ? .weekend
            : (5..<11).contains(hour) ? .morning
            : (11..<14).contains(hour) ? .lunch
            : (17..<23).contains(hour) ? .evening
            : nil
        // 지금 시간대 문구 하나를 앞에, 나머지(시간 무관)는 날짜·사람으로 섞는다.
        let timely = lines.filter { $0.when != .any && $0.when == current }.prefix(1).map(\.text)
        var rest = lines.filter { $0.when == .any }.map(\.text)
        var seed = UInt64(cal.ordinality(of: .day, in: .era, for: now) ?? 0)
        for scalar in seedKey.unicodeScalars { seed = seed &* 31 &+ UInt64(scalar.value) }
        func next() -> UInt64 { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return seed >> 33 }
        if rest.count > 1 {
            for i in stride(from: rest.count - 1, to: 0, by: -1) { rest.swapAt(i, Int(next() % UInt64(i + 1))) }
        }
        return Array((lead + timely + rest).prefix(count))
    }
}

/// 안부 보내기 — 누르면 문구를 고르고 공유 시트(카톡·문자 등)로 보낸다.
struct CheckInMenu<Label: View>: View {
    let person: Contact
    @ViewBuilder var label: () -> Label
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        Menu {
            Section("보낼 문구를 골라요") {
                ForEach(CheckInMessages.options(for: person), id: \.self) { message in
                    ShareLink(item: message) { Text(message) }
                }
            }
            if let username = auth.user?.username {
                Section("내 예약 링크와 함께") {
                    ForEach(CheckInMessages.withLink(for: person, link: "https://orbit42.org/\(username)"), id: \.self) { message in
                        ShareLink(item: message) { Text(message) }
                    }
                }
            }
        } label: {
            label()
        }
    }
}
