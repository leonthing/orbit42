import Foundation
import Observation
import UIKit

/// 글·사진 (1.10.0 시험) 켜짐 상태. 서버가 허용 목록(내부 계정) 밖이면 /api/v1/posts 에 404 를 주므로,
/// 그때는 프로필의 '글·사진' 진입점을 숨긴다. 새 빌드 없이 서버 허용 목록만으로 열고 닫힌다.
@MainActor
@Observable
final class PostsStore {
    static let shared = PostsStore()
    private(set) var open = false
    /// 글을 쓰거나 지우면 늘어난다 — 목록 화면이 다시 받는 신호
    private(set) var revision = 0

    func refresh() async {
        guard !BrowseMode.shared.active else { open = false; return }
        do {
            let _: PostsListResponse = try await APIClient.shared.get("/api/v1/posts")
            open = true
        } catch let e as APIError where e.isNotSupported {
            open = false
        } catch {
            // 네트워크 오류 등 — 상태를 바꾸지 않는다
        }
    }

    func bump() { revision += 1 }

    func clear() { open = false }
}

/// 사진을 올리기 전에 기기에서 줄인다: 긴 변 2048px, JPEG 85%.
/// 다시 그려서 저장하므로 촬영 위치·기기 같은 사진 속 정보(EXIF·GPS)는 따라가지 않는다(서버도 한 번 더 지운다).
enum PostImage {
    static let maxSide: CGFloat = 2048

    static func jpeg(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        return jpeg(from: image)
    }

    static func jpeg(from image: UIImage) -> Data? {
        let size = image.size
        let longest = max(size.width, size.height)
        let scale = longest > maxSide ? maxSide / longest : 1
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1 // 화면 배율(3x)로 커지지 않게
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: target))
            image.draw(in: CGRect(origin: .zero, size: target)) // 방향(orientation)도 여기서 맞춰진다
        }
        return rendered.jpegData(compressionQuality: 0.85)
    }
}
