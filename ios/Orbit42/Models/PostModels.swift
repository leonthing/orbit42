import Foundation

// MARK: - 글·사진 (1.10.0 시험, /api/v1/posts — 내부 계정만, 그 밖에는 404)

struct PostPhoto: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    /// 서명 URL(1시간) — 만료되면 글을 다시 받아 새 주소를 쓴다
    let url: String?
    let width: Int
    let height: Int
    let position: Int
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
    /// 상세에서만 — 예약하기 버튼 주소
    let bookingUrl: String?

    var isPublic: Bool { visibility == "public" }
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
