import SwiftUI

/// 글 본문 렌더러(1.10.0) — 웹 PostBody(src/components/posts/PostBody.tsx)와 같은 규칙의 가벼운 마크다운.
/// 그리는 것: 소제목(# ~ ######은 모두 소제목 하나로), 굵게·기울임·취소선, 목록(•·숫자), 인용(>), 링크, 주소 자동 링크, 문단·줄바꿈.
/// 그리지 않는 것: HTML 태그(태그는 빼고 사이 글자만), 본문 이미지(![](…)), 코드 블록·표·구분선(글자만).
struct PostBodyView: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(PostMarkdown.blocks(text).enumerated()), id: \.offset) { _, block in
                view(for: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .tint(Theme.accent)
    }

    @ViewBuilder
    private func view(for block: PostMarkdown.Block) -> some View {
        switch block {
        case .heading(let s):
            Text(PostMarkdown.inline(s))
                .font(.headline)
                .foregroundStyle(Theme.primaryText)
                .padding(.top, 4)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let s):
            Text(PostMarkdown.inline(s))
                .font(.body)
                .foregroundStyle(Theme.primaryText.opacity(0.9))
                .textSelection(.enabled)
        case .list(let items, let ordered):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(ordered ? "\(i + 1)." : "•")
                            .font(.body)
                            .foregroundStyle(Theme.secondaryText)
                            .monospacedDigit()
                        Text(PostMarkdown.inline(item))
                            .font(.body)
                            .foregroundStyle(Theme.primaryText.opacity(0.9))
                            .textSelection(.enabled)
                    }
                }
            }
            .padding(.leading, 4)
        case .quote(let s):
            Text(PostMarkdown.inline(s))
                .font(.body)
                .foregroundStyle(Theme.secondaryText)
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Theme.secondaryText.opacity(0.5)).frame(width: 2)
                }
                .textSelection(.enabled)
        }
    }
}

enum PostMarkdown {
    enum Block: Equatable {
        case heading(String)
        case paragraph(String)
        case list([String], ordered: Bool)
        case quote(String)
    }

    private static let headingRx = try! NSRegularExpression(pattern: #"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$"#)
    private static let bulletRx = try! NSRegularExpression(pattern: #"^\s{0,3}[-*+]\s+(.*)$"#)
    private static let orderedRx = try! NSRegularExpression(pattern: #"^\s{0,3}\d{1,9}[.)]\s+(.*)$"#)
    private static let quoteRx = try! NSRegularExpression(pattern: #"^\s{0,3}>\s?(.*)$"#)
    private static let fenceRx = try! NSRegularExpression(pattern: #"^\s{0,3}(```|~~~)"#)
    private static let ruleRx = try! NSRegularExpression(pattern: #"^\s{0,3}([-*_])(\s*\1){2,}\s*$"#)

    private static func match(_ rx: NSRegularExpression, _ line: String) -> String? {
        let ns = line as NSString
        guard let m = rx.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { return nil }
        if m.numberOfRanges > 1, m.range(at: 1).location != NSNotFound { return ns.substring(with: m.range(at: 1)) }
        return ""
    }

    /// 줄 단위로 블록을 나눈다. 빈 줄이 문단을 끊고, 문단 안 줄바꿈은 그대로(웹 remark-breaks 와 같게).
    static func blocks(_ raw: String) -> [Block] {
        let text = clean(raw)
        var out: [Block] = []
        var para: [String] = []
        var list: (items: [String], ordered: Bool)?
        var quote: [String] = []

        func flush() {
            if !para.isEmpty { out.append(.paragraph(para.joined(separator: "\n"))); para = [] }
            if let l = list { out.append(.list(l.items, ordered: l.ordered)); list = nil }
            if !quote.isEmpty { out.append(.quote(quote.joined(separator: "\n"))); quote = [] }
        }

        for line in text.components(separatedBy: "\n") {
            if line.trimmingCharacters(in: .whitespaces).isEmpty { flush(); continue }
            if match(fenceRx, line) != nil || match(ruleRx, line) != nil { continue } // 코드 울타리·구분선은 글자만(울타리 줄은 버림)
            if let h = match(headingRx, line) { flush(); if !h.isEmpty { out.append(.heading(h)) }; continue }
            if let q = match(quoteRx, line) {
                if !para.isEmpty || list != nil { let keep = quote; flush(); quote = keep }
                quote.append(q); continue
            }
            if let b = match(bulletRx, line) {
                if list?.ordered != false { flush(); list = ([], false) }
                list?.items.append(b); continue
            }
            if let o = match(orderedRx, line) {
                if list?.ordered != true { flush(); list = ([], true) }
                list?.items.append(o); continue
            }
            if !quote.isEmpty { // 인용 다음 줄(게으른 이어짐)
                quote.append(line); continue
            }
            if list != nil { flush() }
            para.append(line)
        }
        flush()
        return out
    }

    /// HTML 태그와 본문 이미지는 미리 뺀다
    static func clean(_ s: String) -> String {
        var t = s.replacingOccurrences(of: "\r\n", with: "\n")
        t = t.replacingOccurrences(of: #"!\[[^\]]*\]\([^)]*\)"#, with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: #"</?[A-Za-z][^>]*>"#, with: "", options: .regularExpression)
        return t
    }

    private static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

    /// 굵게·기울임·취소선·[글자](주소) + 그냥 붙인 주소 자동 링크. http(s)·mailto 만 링크로 둔다.
    static func inline(_ s: String) -> AttributedString {
        var attr = (try? AttributedString(
            markdown: s,
            options: .init(allowsExtendedAttributes: false, interpretedSyntax: .inlineOnlyPreservingWhitespace, failurePolicy: .returnPartiallyParsedIfPossible)
        )) ?? AttributedString(s)

        // 위험한 스킴의 링크는 글자만 남긴다
        for run in attr.runs {
            if let url = run.link, !["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") {
                attr[run.range].link = nil
            }
            // 코드(`x`)는 웹처럼 보통 글자로
            if let intent = run.inlinePresentationIntent, intent.contains(.code) {
                attr[run.range].inlinePresentationIntent = intent.subtracting(.code)
            }
        }

        // 자동 링크(이미 링크인 곳은 건너뜀)
        let plain = String(attr.characters)
        if let detector {
            let ns = plain as NSString
            for m in detector.matches(in: plain, range: NSRange(location: 0, length: ns.length)) {
                // 웹(remark-gfm)처럼 http(s):// 나 www. 로 시작하는 것만 — "orbit42.org" 같은 맨 도메인은 글자로
                let word = ns.substring(with: m.range).lowercased()
                guard word.hasPrefix("http://") || word.hasPrefix("https://") || word.hasPrefix("www."),
                      let url = m.url, ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                      let r = Range(m.range, in: plain),
                      let lower = AttributedString.Index(r.lowerBound, within: attr),
                      let upper = AttributedString.Index(r.upperBound, within: attr) else { continue }
                if attr[lower..<upper].runs.contains(where: { $0.link != nil }) { continue }
                attr[lower..<upper].link = url
            }
        }
        for run in attr.runs where run.link != nil {
            attr[run.range].underlineStyle = .single
        }
        return attr
    }
}
