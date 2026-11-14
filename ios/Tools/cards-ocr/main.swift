// 명함 정확도 시험(Mac): 이미지 → Vision 글자 인식(ko·en, 기기 안) → CardParser → JSON 한 줄씩.
// swiftc -O main.swift ../../Orbit42/Core/Cards/CardParser.swift -o /tmp/cards-ocr && /tmp/cards-ocr front.png[,back.png] ...
import Foundation
import Vision
import AppKit

func recognize(_ path: String) -> [CardLine] {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [] }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg).perform([req])
    return (req.results ?? []).compactMap { o in
        guard let t = o.topCandidates(1).first?.string else { return nil }
        return CardLine(text: t, box: o.boundingBox)
    }
}

var out: [[String: Any]] = []
for arg in CommandLine.arguments.dropFirst() {
    let sides = arg.split(separator: ",").map(String.init)
    let front = recognize(sides[0])
    let back = sides.count > 1 ? recognize(sides[1]) : []
    let d = CardParser.parse(front: front, back: back)
    let data = try! JSONEncoder().encode(d)
    var obj = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
    obj["_file"] = sides[0]
    obj["_lines"] = (front + back).map(\.text)
    out.append(obj)
}
let json = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(json)
