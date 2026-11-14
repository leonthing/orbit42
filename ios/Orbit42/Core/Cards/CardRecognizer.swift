import UIKit
import Vision

/// 기기 안 글자 인식(Vision, 한국어·영어). 이미지와 글자를 밖으로 보내지 않는다.
enum CardRecognizer {
    static func lines(in image: UIImage) async -> [CardLine] {
        guard let cg = image.cgImage else { return [] }
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        return await withCheckedContinuation { cont in
            DispatchQueue.global(qos: .userInitiated).async {
                let req = VNRecognizeTextRequest()
                req.recognitionLevel = .accurate
                req.recognitionLanguages = ["ko-KR", "en-US"]
                req.usesLanguageCorrection = true
                try? VNImageRequestHandler(cgImage: cg, orientation: orientation).perform([req])
                let out: [CardLine] = (req.results ?? []).compactMap { o in
                    guard let t = o.topCandidates(1).first?.string else { return nil }
                    return CardLine(text: t, box: o.boundingBox)
                }
                cont.resume(returning: out)
            }
        }
    }

    /// 앞·뒤(최대 2장) → 초안
    static func draft(from pages: [UIImage]) async -> CardDraft {
        var front: [CardLine] = []
        if let first = pages.first { front = await lines(in: first) }
        let back = pages.count > 1 ? await lines(in: pages[1]) : []
        return CardParser.parse(front: front, back: back)
    }
}

private extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
