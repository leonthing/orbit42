import Foundation

// MARK: - 글·사진 (1.10.0 시험, /api/v1/posts — 내부 계정만, 그 밖에는 404)

struct PostPhoto: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    /// 서명 URL(1시간) — 만료되면 글을 다시 받아 새 주소를 쓴다
    let url: String?
    let width: Int
    let height: Int
    let position: Int
    /// 사진 설명(선택, 200자)
    var caption: String?
}

struct PostAuthor: Decodable, Hashable, Sendable {
    let username: String
    let displayName: String?
    let avatarUrl: String?

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }
}

struct Post: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let author: PostAuthor
    let title: String
    let body: String
    /// "public" | "private"
    let visibility: String
    /// 운영자가 숨김 — 작성자에게만 보인다
    let hidden: Bool
    /// 목록은 첫 장만, 상세는 전부
    let photos: [PostPhoto]
    let photoCount: Int
    var likeCount: Int
    var liked: Bool
    let mine: Bool
    let createdAt: String
    let updatedAt: String
    /// 처음 공개한 시각 — 한 번도 공개 안 한 임시 저장 글은 nil
    let publishedAt: String?
    /// "수정됨" 기준(처음 공개 10분 뒤 고친 시각)
    let editedAt: String?
    /// 링크 페이지 맨 위 고정 글
    let pinned: Bool?
    let slug: String?
    /// 공유 주소
    let url: String?
    /// 지금 남이 이 주소를 열 수 있는지(공개 스위치 켜짐 + 공개) — 아니면 "공개 전" 안내
    let shareable: Bool?
    /// 공개 스위치가 꺼진 동안 공개 글 안내("11월 27일부터 다른 분들께 보여요.") — 서버 상수, 켜지면 nil
    let publicNotice: String?
    /// 상세에서만 — 예약하기 버튼 주소
    let bookingUrl: String?

    var isPublic: Bool { visibility == "public" }
    var isPinned: Bool { pinned ?? false }
    /// 한 번도 공개하지 않은 임시 저장 글
    var isDraft: Bool { !isPublic && publishedAt == nil }
}

struct PostsListResponse: Decodable, Sendable {
    let posts: [Post]
    let nextBefore: String?
}

struct PostResponse: Decodable, Sendable {
    let post: Post
}

struct PostPhotoResponse: Decodable, Sendable {
    let photo: PostPhoto
}

struct PostLikeResponse: Decodable, Sendable {
    let liked: Bool
    let likeCount: Int
}

struct PostOkResponse: Decodable, Sendable {
    let ok: Bool
}

struct PostWriteRequest: Encodable {
    let title: String
    let body: String
    let `public`: Bool
}

struct PostPublicRequest: Encodable {
    let `public`: Bool
}

struct PostOrderRequest: Encodable {
    let order: [String]
}

struct PostReportRequest: Encodable {
    let reason: String
}

struct PostEmptyBody: Encodable {}

struct PostCaptionRequest: Encodable {
    let caption: String?
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(caption, forKey: .caption) // nil 이면 null 로 보내 지운다
    }
    enum CodingKeys: String, CodingKey { case caption }
}

struct PostCaptionResponse: Decodable, Sendable {
    let ok: Bool
    let caption: String?
}

struct PostPinResponse: Decodable, Sendable {
    let ok: Bool
    let pinnedPostId: String?
}
