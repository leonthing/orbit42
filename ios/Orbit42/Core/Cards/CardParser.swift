import Foundation
import CoreGraphics

/// 명함 글자 → 칸(1차, 기기 안 규칙 파서). 외부 AI 없음.
/// 입력은 Vision 이 읽은 줄(글자 + 정규화 위치·높이). 앞·뒤 두 면을 합쳐 한 사람으로 만든다.
/// 이 파일은 Foundation·CoreGraphics 만 써서 Mac 정확도 시험(scripts/cards-ocr)에서도 그대로 컴파일된다.
struct CardLine: Equatable {
    var text: String
    /// Vision 정규화 좌표(왼쪽 아래 원점). 높이는 글자 크기 비교에 쓴다
    var box: CGRect
    var height: CGFloat { box.height }
}

struct CardDraft: Equatable, Codable {
    var name = ""
    var company = ""
    var department = ""
    var title = ""
    var mobile = ""
    var workPhone = ""
    var fax = ""
    var emails: [String] = []
    var address = ""
    var website = ""
}

enum CardParser {
    // MARK: 사전

    static let koTitles = [
        "대표이사", "공동대표", "대표", "회장", "부회장", "사장", "부사장", "전무이사", "전무", "상무이사", "상무", "이사", "감사",
        "본부장", "사업부장", "실장", "센터장", "연구소장", "소장", "원장", "그룹장", "팀장", "파트장", "셀장", "부장", "차장", "과장",
        "대리", "주임", "사원", "매니저", "책임연구원", "선임연구원", "수석연구원", "연구원", "책임", "선임", "수석", "프로", "위원",
        "교수", "부교수", "조교수", "변호사", "변리사", "회계사", "세무사", "노무사", "의사", "약사", "기자", "편집장", "PD", "작가",
        "디자이너", "엔지니어", "개발자", "컨설턴트", "파트너", "심사역", "수석심사역", "책임심사역", "총장", "학장", "지점장", "점장",
        "국장", "부국장", "처장", "단장", "관장", "의원", "보좌관", "비서관", "주무관", "사무관", "서기관", "과장대리",
    ]
    static let enTitleWords = [
        "ceo", "cto", "cfo", "coo", "cmo", "cpo", "cso", "chief", "president", "vice", "vp", "director", "manager", "head",
        "lead", "founder", "co-founder", "cofounder", "partner", "principal", "associate", "engineer", "developer", "designer",
        "consultant", "analyst", "officer", "executive", "senior", "sr.", "junior", "researcher", "scientist", "professor",
        "attorney", "lawyer", "counsel", "chairman", "owner", "specialist", "representative", "coordinator", "architect",
        "evangelist", "producer", "editor", "reporter", "advisor", "investor", "general",
    ]
    static let companyMarks = [
        "주식회사", "㈜", "(주)", "（주）", "유한회사", "(유)", "재단법인", "사단법인", "협동조합", "법무법인", "회계법인", "세무법인", "특허법인",
        "그룹", "홀딩스", "파트너스", "벤처스", "인베스트먼트", "캐피탈", "자산운용", "증권", "은행", "보험", "대학교", "대학", "병원", "의원",
        "연구원", "재단", "협회", "공사", "공단", "진흥원", "랩스", "컴퍼니", "코리아", "테크", "솔루션", "시스템즈", "엔터테인먼트", "스튜디오",
    ]
    static let enCompanyMarks = [
        "inc", "inc.", "corp", "corp.", "corporation", "co.", "co.,", "ltd", "ltd.", "llc", "llp", "gmbh", "group", "holdings",
        "partners", "ventures", "capital", "labs", "lab", "technologies", "technology", "tech", "studio", "studios", "company",
        "korea", "bank", "university", "foundation", "association", "institute", "systems", "solutions", "investment", "investments",
    ]
    static let deptMarks = [
        "팀", "부", "실", "본부", "센터", "사업부", "사업본부", "연구소", "연구실", "그룹", "파트", "셀", "TF", "랩", "Lab", "사무국", "지원단",
    ]
    static let enDeptWords = ["division", "department", "dept", "dept.", "team", "office", "unit", "lab", "group", "center", "centre"]

    static let koRegions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
                            "충청", "전라", "경상", "특별시", "광역시", "특별자치"]
    static let enAddrWords = ["seoul", "busan", "incheon", "daegu", "daejeon", "gwangju", "ulsan", "sejong", "gyeonggi", "gangwon", "jeju",
                              "korea", "-ro", "-gil", "-gu", "-si", "-dong", "street", "st.", "road", "rd.", "avenue", "ave", "floor", "fl.",
                              "suite", "bldg", "building", "tower", "blvd", "republic"]

    // MARK: 정규식

    private static func rx(_ p: String, _ o: NSRegularExpression.Options = [.caseInsensitive]) -> NSRegularExpression {
        try! NSRegularExpression(pattern: p, options: o)
    }
    static let emailRx = rx(#"[A-Z0-9._%+\-]+\s?@\s?[A-Z0-9.\-]+\.[A-Z]{2,}"#)
    static let urlRx = rx(#"(?:https?://)?(?:www\.)[A-Z0-9.\-]+\.[A-Z]{2,}(?:/[^\s]*)?|https?://[A-Z0-9.\-]+\.[A-Z]{2,}(?:/[^\s]*)?|\b[A-Z0-9\-]+\.(?:com|co\.kr|kr|net|org|io|ai|co|or\.kr|ac\.kr|go\.kr|re\.kr|me|app|dev)\b(?:/[^\s]*)?"#)
    /// 전화: +82 (0)10-1234-5678 · 010.1234.5678 · 02)555-1234 · 1588-1234
    static let phoneRx = rx(#"(?:\+?\s?82[\s.\-)]*\(?0?\)?[\s.\-]*)?\(?0?\d{1,2}\)?[\s.\-)]*\d{3,4}[\s.\-]*\d{4}|\b1[5-9]\d{2}[\s.\-]\d{4}\b"#)
    static let labelRx = rx(#"(?:^|[\s|/·,])(M\.?|Mob(?:ile)?\.?|HP|H\.P\.?|C\.?|Cell|휴대폰|휴대전화|핸드폰|모바일|T\.?|Tel\.?|Phone|P\.?|Office|O\.?|D\.?|Direct|DID|전화|대표|직통|F\.?|Fax\.?|팩스|E\.?|E-?mail|이메일|메일)\s*[:.)]?\s*$"#)

    // MARK: 진입

    /// 앞·뒤 면을 합쳐 한 장의 초안으로
    static func parse(front: [CardLine], back: [CardLine] = []) -> CardDraft {
        let a = parseSide(front)
        guard !back.isEmpty else { return a }
        let b = parseSide(back)
        // 한글 면을 기준으로(이름·회사가 한글인 쪽), 빈 칸은 다른 면에서 채운다
        let (main, other) = (hangulScore(a) >= hangulScore(b)) ? (a, b) : (b, a)
        var m = main
        for k in [\CardDraft.name, \.company, \.department, \.title, \.mobile, \.workPhone, \.fax, \.address, \.website] where m[keyPath: k].isEmpty {
            m[keyPath: k] = other[keyPath: k]
        }
        for e in other.emails where !m.emails.contains(where: { sameEmailish($0, e) }) { m.emails.append(e) }
        return m
    }

    /// 같은 도메인이고 아이디가 점·밑줄만 다르거나 한쪽이 다른 쪽의 꼬리(OCR 이 앞부분을 다른 줄로 떼어 냄)
    static func sameEmailish(_ a: String, _ b: String) -> Bool {
        let pa = a.split(separator: "@"), pb = b.split(separator: "@")
        guard pa.count == 2, pb.count == 2, pa[1] == pb[1] else { return a == b }
        let la = pa[0].filter { $0.isLetter || $0.isNumber }, lb = pb[0].filter { $0.isLetter || $0.isNumber }
        return la == lb || la.hasSuffix(lb) || lb.hasSuffix(la)
    }

    private static func hangulScore(_ d: CardDraft) -> Int {
        (isHangul(d.name) ? 2 : 0) + (containsHangul(d.company) ? 1 : 0) + (containsHangul(d.title) ? 1 : 0)
    }

    // MARK: 한 면

    static func parseSide(_ raw: [CardLine]) -> CardDraft {
        var d = CardDraft()
        // 위에서 아래, 왼쪽에서 오른쪽 순(Vision 좌표는 아래가 0)
        let cleaned: [CardLine] = raw.map { CardLine(text: clean($0.text), box: $0.box) }.filter { !$0.text.isEmpty }
        var lines: [CardLine] = cleaned.sorted(by: readingOrder)
        var used = Set<Int>()

        // 1) 이메일·웹·전화 — 줄 안에서 뽑고, 뽑은 부분은 지운다
        var phones: [(kind: String, digits: String)] = []
        for i in lines.indices {
            var t = lines[i].text
            for m in matches(emailRx, t) {
                let e = m.replacingOccurrences(of: " ", with: "").lowercased()
                if !d.emails.contains(where: { sameEmailish($0, e) }) { d.emails.append(e) }
                t = t.replacingOccurrences(of: m, with: " ")
            }
            for (kind, digits, matched) in phoneMatches(t) {
                if !phones.contains(where: { $0.digits == digits }) { phones.append((kind, digits)) }
                t = t.replacingOccurrences(of: matched, with: " ")
            }
            if d.website.isEmpty, let u = matches(urlRx, t).first, !u.contains("@") {
                d.website = u.trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))
                t = t.replacingOccurrences(of: u, with: " ")
            }
            // 남은 표시(Tel, E-mail: 등)만 있으면 그 줄은 다 쓴 것
            let rest = stripLabels(t)
            if rest.isEmpty { used.insert(i) }
            lines[i].text = rest
        }
        assignPhones(phones, into: &d)

        // 2) 주소 — 주소처럼 보이는 줄과, 바로 이어지는 줄(층·호·빌딩)
        for i in lines.indices where !used.contains(i) && d.address.isEmpty {
            if looksLikeAddress(lines[i].text) {
                var parts = [lines[i].text]
                used.insert(i)
                var j = i + 1
                while j < lines.count, !used.contains(j), parts.count < 3, isAddressTail(lines[j].text, prev: lines[i]) , abs(lines[j].height - lines[i].height) < 0.012 {
                    parts.append(lines[j].text); used.insert(j); j += 1
                }
                d.address = parts.joined(separator: " ").replacingOccurrences(of: "  ", with: " ")
            }
        }
        // 이어진 줄: 주소 앞 우편번호 줄
        d.address = d.address.replacingOccurrences(of: #"^\(?\d{5}\)?\s*"#, with: "", options: .regularExpression)

        // 3) 이름 + 직함 — 한 줄에 같이 있는 경우가 많다("홍길동 상무", "홍 길 동 | 대표")
        var nameIdx: Int?
        let free = lines.indices.filter { !used.contains($0) }
        let byHeight = free.sorted { lines[$0].height > lines[$1].height }
        for i in byHeight {
            if let (n, t) = splitNameTitle(lines[i].text) {
                d.name = n
                if !t.isEmpty { d.title = t }
                nameIdx = i; used.insert(i); break
            }
        }
        if d.name.isEmpty {
            // 영문 이름: 큰 글자, 대문자로 시작하는 2~3 단어, 회사·직함 표시 없음
            for i in byHeight where isEnglishName(lines[i].text) {
                d.name = titleCase(lines[i].text); nameIdx = i; used.insert(i); break
            }
        }

        // 4) 직함·부서·회사 — 남은 줄
        for i in lines.indices where !used.contains(i) {
            let t = lines[i].text
            // "전략기획팀 팀장" 처럼 부서+직함 한 줄
            if d.title.isEmpty, let (dept, title) = splitDeptTitle(t) {
                d.title = title
                if !dept.isEmpty, d.department.isEmpty, !isCompany(dept) { d.department = dept }
                else if !dept.isEmpty, d.company.isEmpty { d.company = dept }
                used.insert(i); continue
            }
            if d.title.isEmpty, isTitle(t) { d.title = t; used.insert(i); continue }
        }
        for i in lines.indices where !used.contains(i) {
            let t = lines[i].text
            if d.company.isEmpty, isCompany(t) { d.company = t; used.insert(i); continue }
        }
        for i in lines.indices where !used.contains(i) {
            let t = lines[i].text
            if d.department.isEmpty, isDept(t) { d.department = t; used.insert(i); continue }
        }
        // 회사 표시가 없으면: 이름 다음으로 큰 글자 줄(로고 글자)
        if d.company.isEmpty {
            let rest = lines.indices.filter { !used.contains($0) && isPlausibleCompany(lines[$0].text) }
            if let i = rest.max(by: { lines[$0].height < lines[$1].height }), nameIdx.map({ lines[i].height >= lines[$0].height * 0.55 }) ?? true {
                d.company = lines[i].text; used.insert(i)
            }
        }
        // 회사가 여전히 없으면 이메일 도메인에서(개인 메일 제외)
        if d.company.isEmpty, let e = d.emails.first, let dom = e.split(separator: "@").last {
            let host = dom.split(separator: ".").first.map(String.init) ?? ""
            let personal = ["gmail", "naver", "daum", "hanmail", "kakao", "nate", "yahoo", "hotmail", "outlook", "icloud", "me"]
            if !personal.contains(host), host.count >= 2 { d.company = host.uppercased() == host ? host : host.capitalized }
        }
        d.company = d.company.trimmingCharacters(in: .whitespaces)
        return d
    }

    private static func readingOrder(_ a: CardLine, _ b: CardLine) -> Bool {
        let dy: CGFloat = a.box.midY - b.box.midY
        if abs(dy) > 0.02 { return dy > 0 }
        return a.box.minX < b.box.minX
    }

    // MARK: 전화

    private static func phoneMatches(_ t: String) -> [(String, String, String)] {
        var out: [(String, String, String)] = []
        let ns = t as NSString
        for m in phoneRx.matches(in: t, range: NSRange(location: 0, length: ns.length)) {
            let matched = ns.substring(with: m.range)
            var digits = matched.filter(\.isNumber)
            if digits.hasPrefix("82") { digits = "0" + digits.dropFirst(2) }
            if digits.hasPrefix("00") { digits = String(digits.dropFirst()) } // +82 (0)10 → 0010 → 010
            guard digits.count >= 8, digits.count <= 12 else { continue }
            // 앞쪽 표시(M., Tel, F 등)
            let before = ns.substring(to: m.range.location)
            let kind = phoneKind(label: before, digits: digits)
            out.append((kind, digits, matched))
        }
        return out
    }

    private static func phoneKind(label before: String, digits: String) -> String {
        let tail = String(before.suffix(12)).lowercased()
        let l = tail.replacingOccurrences(of: " ", with: "")
        let lastLabel: String = {
            if let m = labelRx.firstMatch(in: tail, range: NSRange(location: 0, length: (tail as NSString).length)), m.numberOfRanges > 1 {
                return (tail as NSString).substring(with: m.range(at: 1)).lowercased()
            }
            return ""
        }()
        if lastLabel.hasPrefix("f") || l.hasSuffix("팩스") || l.contains("fax") { return "fax" }
        if ["m", "m.", "mob", "mobile", "mob.", "hp", "h.p", "h.p.", "c", "c.", "cell", "휴대폰", "휴대전화", "핸드폰", "모바일"].contains(lastLabel) { return "mobile" }
        if digits.hasPrefix("01") && digits.count >= 10 { return "mobile" }
        return "work"
    }

    private static func assignPhones(_ phones: [(kind: String, digits: String)], into d: inout CardDraft) {
        for p in phones {
            switch p.kind {
            case "mobile" where d.mobile.isEmpty: d.mobile = fmtPhone(p.digits)
            case "fax" where d.fax.isEmpty: d.fax = fmtPhone(p.digits)
            case "work" where d.workPhone.isEmpty: d.workPhone = fmtPhone(p.digits)
            default: break
            }
        }
    }

    static func fmtPhone(_ d: String) -> String {
        let c = Array(d)
        func s(_ a: Int, _ b: Int) -> String { String(c[a..<b]) }
        if d.hasPrefix("02"), d.count == 9 || d.count == 10 { return "02-\(s(2, d.count - 4))-\(s(d.count - 4, d.count))" }
        if d.hasPrefix("0"), d.count == 10 || d.count == 11 { return "\(s(0, 3))-\(s(3, d.count - 4))-\(s(d.count - 4, d.count))" }
        if d.count == 8 { return "\(s(0, 4))-\(s(4, 8))" }
        return d
    }

    // MARK: 줄 판단

    static func clean(_ s: String) -> String {
        var t = s.replacingOccurrences(of: "\u{00A0}", with: " ")
        t = t.replacingOccurrences(of: #"\s*[()\[\]{}]\s*@"#, with: "@", options: .regularExpression)
        t = t.replacingOccurrences(of: #"@\s*[()\[\]{}]\s*"#, with: "@", options: .regularExpression)
        t = t.replacingOccurrences(of: #"[|•·]+"#, with: " | ", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return t.trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: "|,")))
    }

    private static func stripLabels(_ s: String) -> String {
        var t = s
        t = t.replacingOccurrences(of: #"(?i)\b(M|Mob|Mobile|HP|H\.P|C|Cell|T|Tel|Phone|P|Office|O|D|Direct|DID|F|Fax|E|E-?mail|Email|W|Web|Homepage|URL)\b\s*[.:)]?"#, with: " ", options: .regularExpression)
        t = t.replacingOccurrences(of: #"(휴대폰|휴대전화|핸드폰|모바일|전화|직통|대표번호|대표전화|팩스|이메일|메일|홈페이지)\s*[.:)]?"#, with: " ", options: .regularExpression)
        t = t.replacingOccurrences(of: #"[|/:]+"#, with: " ", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\s*,(\s*,)+"#, with: ",", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        // 쉼표는 남긴다("Director, Marketing Team"·영문 주소). 양끝 쉼표·마침표만 정리
        return t.trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: ",.")))
    }

    static func isHangul(_ s: String) -> Bool {
        !s.isEmpty && s.unicodeScalars.allSatisfy { (0xAC00...0xD7A3).contains($0.value) }
    }
    static func containsHangul(_ s: String) -> Bool {
        s.unicodeScalars.contains { (0xAC00...0xD7A3).contains($0.value) }
    }

    static func looksLikeAddress(_ t: String) -> Bool {
        let low = t.lowercased()
        let hasDigit = t.contains(where: \.isNumber)
        let letters = t.unicodeScalars.filter { CharacterSet.letters.contains($0) }
        let hangulCount = letters.filter { (0xAC00...0xD7A3).contains($0.value) }.count
        if hangulCount * 5 > letters.count {
            let region = koRegions.contains { t.contains($0) }
            let road = t.range(of: #"[가-힣0-9]+(로|길|대로)\s?\d"#, options: .regularExpression) != nil
            let unit = t.range(of: #"(\d+층|\d+호|번지|빌딩|타워|센터\s?\d)"#, options: .regularExpression) != nil
            let gu = t.range(of: #"[가-힣]+(시|구|군|동|읍|면)\s"#, options: .regularExpression) != nil
            return (region && (road || gu || hasDigit)) || (road && (gu || unit)) || (gu && unit)
        }
        let hits = enAddrWords.filter { low.contains($0) }.count
        return hasDigit && hits >= 1 && t.count >= 12 || hits >= 2
    }

    private static func isAddressTail(_ t: String, prev: CardLine) -> Bool {
        if t.range(of: #"^\(?\d{5}\)?$"#, options: .regularExpression) != nil { return true }
        if t.range(of: #"(\d+층|\d+호|\d+F\b|빌딩|타워|센터|Floor|Fl\.|Suite|Bldg|Tower|Korea|Seoul|\d{5})"#, options: [.regularExpression, .caseInsensitive]) != nil,
           !isCompany(t) || t.range(of: #"\d"#, options: .regularExpression) != nil { return true }
        return false
    }

    /// "홍길동 상무" / "홍 길 동" / "홍길동" / "대표이사 홍길동" → (이름, 직함)
    static func splitNameTitle(_ raw: String) -> (String, String)? {
        let t = raw.replacingOccurrences(of: "|", with: " ").replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        // 영문 이름이 함께 붙은 경우 한글 부분만("홍길동 Gildong Hong")
        let toks = t.split(separator: " ").map(String.init)
        // 한 글자씩 띄운 이름: "홍 길 동"
        let singles = toks.prefix { $0.count == 1 && isHangul($0) }
        if singles.count >= 2, singles.count <= 4 {
            let name = singles.joined()
            let rest = toks.dropFirst(singles.count).joined(separator: " ")
            if rest.isEmpty || isTitle(rest) || !containsHangul(rest) { return (name, isTitle(rest) ? rest : "") }
        }
        // 짧은 한글 조각이 이어진 이름: "정태 윤" · "정 태윤"(조각 모두 2자 이하, 합쳐 2~4자, 직함 아님)
        let pieces = toks.prefix { isHangul($0) && $0.count <= 2 && !isTitleWord($0) }
        if pieces.count >= 2, (2...4).contains(pieces.joined().count) {
            let rest = toks.dropFirst(pieces.count).joined(separator: " ")
            if rest.isEmpty || isTitle(rest) { return (pieces.joined(), rest) }
        }
        let hangulToks = toks.filter { isHangul($0) }
        guard !hangulToks.isEmpty else { return nil }
        // 이름 후보: 2~4자 한글, 직함·회사·부서 단어가 아님
        if let n = toks.first(where: { isHangul($0) && (2...4).contains($0.count) && !isTitleWord($0) && !isCompany($0) && !isDept($0) && !koRegions.contains($0) }) {
            let others = toks.filter { $0 != n }
            let titleToks = others.filter { isTitle($0) || isTitleWord($0) }
            // 이름 말고 다른 한글 단어가 직함이 아니면(문장·회사명) 이름 줄로 보지 않는다
            let nonTitleHangul = others.filter { containsHangul($0) && !titleToks.contains($0) }
            // 직함 한 글자 오인식("팀당" ← 팀장): 남은 한글 낱말 하나가 직함과 한 글자만 다르면 직함으로
            if nonTitleHangul.count == 1, let fixed = nearTitle(nonTitleHangul[0]) {
                return (n, (titleToks + [fixed]).joined(separator: " "))
            }
            if nonTitleHangul.count > 0 { return nil }
            return (n, titleToks.joined(separator: " "))
        }
        // "홍길동상무" 붙여 쓴 경우
        if toks.count == 1, let tok = toks.first, isHangul(tok), tok.count >= 4 {
            for title in koTitles.sorted(by: { $0.count > $1.count }) where tok.hasSuffix(title) {
                let n = String(tok.dropLast(title.count))
                if (2...4).contains(n.count) { return (n, title) }
            }
        }
        return nil
    }

    static func isTitleWord(_ t: String) -> Bool { koTitles.contains(t) }

    /// 글자 수가 같고 한 글자만 다른 직함(2자 이상) — OCR 한 글자 오인식 보정
    static func nearTitle(_ t: String) -> String? {
        let a = Array(t)
        guard a.count >= 2 else { return nil }
        return koTitles.first { title in
            let b = Array(title)
            return b.count == a.count && zip(a, b).filter { $0 != $1 }.count == 1
        }
    }

    static func isTitle(_ t: String) -> Bool {
        let s = t.trimmingCharacters(in: .whitespaces)
        if s.isEmpty || s.count > 40 { return false }
        if koTitles.contains(s) { return true }
        let toks = s.split(whereSeparator: { $0 == " " || $0 == "/" || $0 == "," || $0 == "&" }).map { String($0) }
        if toks.allSatisfy({ koTitles.contains($0) || ["겸", "및"].contains($0) }) { return true }
        // 영어: 단어 대부분이 직함 단어("Chief Executive Officer", "Head of Sales")
        let low = toks.map { $0.lowercased() }
        let hits = low.filter { enTitleWords.contains($0) }.count
        if hits >= 1, !s.contains(where: \.isNumber), low.count <= 6, !containsHangul(s) {
            let filler = ["of", "and", "&", "the", "for", "to"]
            let rest = low.filter { !enTitleWords.contains($0) && !filler.contains($0) }
            return rest.count <= 2 && hits * 2 >= low.count - rest.count
        }
        // 한글 직함으로 끝나는 짧은 말("마케팅 매니저", "수석 디자이너")
        if containsHangul(s), let last = toks.last, koTitles.contains(last), toks.count <= 3, !isDept(toks.dropLast().joined(separator: " ")) { return true }
        return false
    }

    /// "전략기획팀 팀장" · "Marketing Team | Manager" → (부서, 직함)
    static func splitDeptTitle(_ raw: String) -> (String, String)? {
        let t = raw.replacingOccurrences(of: "|", with: " ").replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        let commaParts = t.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if commaParts.count == 2 {
            if isTitle(commaParts[0]), isDept(commaParts[1]) { return (commaParts[1], commaParts[0]) }
            if isDept(commaParts[0]), isTitle(commaParts[1]) { return (commaParts[0], commaParts[1]) }
        }
        let toks = t.split(separator: " ").map(String.init)
        guard toks.count >= 2 else { return nil }
        // 끝에서부터 직함인 가장 긴 꼬리
        for k in stride(from: min(4, toks.count - 1), through: 1, by: -1) {
            let tail = toks.suffix(k).joined(separator: " ")
            let head = toks.prefix(toks.count - k).joined(separator: " ")
            // "Team Lead" 의 Team 처럼 부서 단어 하나뿐인 앞부분은 부서가 아니다
            let bareDept = enDeptWords.contains(head.lowercased()) || head.count <= 1
            if isTitle(tail), !head.isEmpty, !bareDept, isDept(head) || isCompany(head) { return (head, tail) }
        }
        // 앞이 직함, 뒤가 부서("Manager, Marketing Team")
        for k in stride(from: min(4, toks.count - 1), through: 1, by: -1) {
            let headT = toks.prefix(k).joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: ","))
            let rest = toks.suffix(toks.count - k).joined(separator: " ")
            if isTitle(headT), isDept(rest) { return (rest, headT) }
        }
        return nil
    }

    static func isCompany(_ t: String) -> Bool {
        let s = t.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return false }
        if companyMarks.contains(where: { s.contains($0) }) {
            // "연구원"은 직함일 수도 — 한 단어 '연구원' 은 직함
            if koTitles.contains(s) { return false }
            return true
        }
        let low = s.lowercased().split(separator: " ").map(String.init)
        return low.contains { enCompanyMarks.contains($0.trimmingCharacters(in: CharacterSet(charactersIn: ",."))) || enCompanyMarks.contains($0) }
    }

    static func isDept(_ t: String) -> Bool {
        let s = t.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty, s.count <= 40, !s.contains("@") else { return false }
        if containsHangul(s) {
            let last = s.split(separator: " ").last.map(String.init) ?? s
            if koTitles.contains(last) { return false }
            return deptMarks.contains { last.hasSuffix($0) && last.count > $0.count } || deptMarks.contains(last)
        }
        let low = s.lowercased().split(separator: " ").map(String.init)
        return low.contains { enDeptWords.contains($0) } && !low.contains { enTitleWords.contains($0) && !["head", "general"].contains($0) }
    }

    private static func isPlausibleCompany(_ t: String) -> Bool {
        let s = t.trimmingCharacters(in: .whitespaces)
        guard s.count >= 2, s.count <= 40 else { return false }
        if s.filter(\.isNumber).count > 3 { return false }
        if isTitle(s) || isDept(s) || looksLikeAddress(s) { return false }
        // 문장(슬로건)은 빼기: 단어가 많으면 회사명 아님
        return s.split(separator: " ").count <= 5
    }

    static func isEnglishName(_ t: String) -> Bool {
        let toks = t.split(separator: " ").map(String.init)
        guard (2...4).contains(toks.count), !t.contains(where: \.isNumber), !containsHangul(t) else { return false }
        if isTitle(t) || isCompany(t) || isDept(t) { return false }
        return toks.allSatisfy { tok in
            guard let f = tok.first, f.isLetter, f.isUppercase else { return tok == "-" }
            return tok.allSatisfy { $0.isLetter || $0 == "-" || $0 == "." || $0 == "'" }
        }
    }

    private static func titleCase(_ t: String) -> String {
        // 전부 대문자면 첫 글자만 크게("GILDONG HONG" → "Gildong Hong")
        guard t == t.uppercased() else { return t }
        return t.split(separator: " ").map { w in w.prefix(1) + w.dropFirst().lowercased() }.joined(separator: " ")
    }

    private static func matches(_ r: NSRegularExpression, _ s: String) -> [String] {
        let ns = s as NSString
        return r.matches(in: s, range: NSRange(location: 0, length: ns.length)).map { ns.substring(with: $0.range) }
    }
}
