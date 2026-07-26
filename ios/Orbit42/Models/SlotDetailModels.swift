import Foundation

// MARK: - 근무시간 구간

/// `workingHours` 의 `{"start":"10:00","end":"18:00"}` 구간 (HH:mm 문자열).
struct WorkingInterval: Codable, Equatable, Sendable {
    let start: String
    let end: String
}

// MARK: - 슬롯 상세

/// `GET /api/v1/slots/{id}` 의 slot 객체 — 목록 필드에 상세 편집 필드를 더한 형태.
/// 서버가 병렬 구현 중이므로 상세 전용 필드는 없으면 기본값으로 관대하게 디코딩한다.
struct SlotDetail: Decodable, Identifiable, Sendable {
    let id: String
    let slug: String
    let title: String
    let description: String?
    let durationMin: Int
    let priceCents: Int
    let currency: String
    let capacity: Int
    let slotType: String       // "1on1" | "companion" | "group"
    let mode: String           // "auto" | "manual"
    let pricingModel: String   // "fixed" | "auction"
    let active: Bool
    let autoApprove: Bool
    let shareUrl: String
    let createdAt: String

    // 상세 전용 필드
    let locations: [String]
    /// 요일 키("sun"~"sat") → 근무시간 구간 목록. off 인 요일은 키가 없다.
    let workingHours: [String: [WorkingInterval]]
    let slotIntervalMin: Int
    let minNoticeHours: Int
    let maxAdvanceDays: Int
    let bufferMin: Int
    let validFrom: String?
    let validUntil: String?

    var isAuction: Bool { pricingModel == "auction" }

    /// 목록(`SlotsViewModel`) 갱신용 변환.
    var asTimeSlot: TimeSlot {
        TimeSlot(
            id: id, slug: slug, title: title, description: description,
            durationMin: durationMin, priceCents: priceCents, currency: currency,
            capacity: capacity, slotType: slotType, mode: mode,
            pricingModel: pricingModel, active: active, autoApprove: autoApprove,
            shareUrl: shareUrl, createdAt: createdAt
        )
    }

    private enum CodingKeys: String, CodingKey {
        case id, slug, title, description, durationMin, priceCents, currency
        case capacity, slotType, mode, pricingModel, active, autoApprove
        case shareUrl, createdAt
        case locations, workingHours, slotIntervalMin, minNoticeHours
        case maxAdvanceDays, bufferMin, validFrom, validUntil
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        slug = try container.decode(String.self, forKey: .slug)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        durationMin = try container.decode(Int.self, forKey: .durationMin)
        priceCents = try container.decode(Int.self, forKey: .priceCents)
        currency = try container.decodeIfPresent(String.self, forKey: .currency) ?? "KRW"
        capacity = try container.decode(Int.self, forKey: .capacity)
        slotType = try container.decode(String.self, forKey: .slotType)
        mode = try container.decode(String.self, forKey: .mode)
        pricingModel = try container.decodeIfPresent(String.self, forKey: .pricingModel) ?? "fixed"
        active = try container.decode(Bool.self, forKey: .active)
        autoApprove = try container.decodeIfPresent(Bool.self, forKey: .autoApprove) ?? false
        shareUrl = try container.decode(String.self, forKey: .shareUrl)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""

        locations = try container.decodeIfPresent([String].self, forKey: .locations) ?? []
        workingHours = try container.decodeIfPresent([String: [WorkingInterval]].self, forKey: .workingHours) ?? [:]
        slotIntervalMin = try container.decodeIfPresent(Int.self, forKey: .slotIntervalMin) ?? 30
        minNoticeHours = try container.decodeIfPresent(Int.self, forKey: .minNoticeHours) ?? 24
        maxAdvanceDays = try container.decodeIfPresent(Int.self, forKey: .maxAdvanceDays) ?? 90
        bufferMin = try container.decodeIfPresent(Int.self, forKey: .bufferMin) ?? 0
        validFrom = try container.decodeIfPresent(String.self, forKey: .validFrom)
        validUntil = try container.decodeIfPresent(String.self, forKey: .validUntil)
    }
}

struct SlotDetailResponse: Decodable {
    let slot: SlotDetail
}

// MARK: - 예약 가능 시간 (availability)

/// `GET /api/v1/slots/{id}/availability` 응답.
struct SlotAvailabilityResponse: Decodable, Sendable {
    let options: [AvailabilityOption]
    /// manual 슬롯의 시간 창. auto 슬롯이면 빈 배열.
    let windows: [AvailabilityWindow]

    private enum CodingKeys: String, CodingKey {
        case options, windows
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        options = try container.decodeIfPresent([AvailabilityOption].self, forKey: .options) ?? []
        windows = try container.decodeIfPresent([AvailabilityWindow].self, forKey: .windows) ?? []
    }
}

/// 예약 가능 시각 후보 하나.
struct AvailabilityOption: Decodable, Identifiable, Sendable {
    let startAt: String
    let endAt: String
    let remaining: Int
    let availabilityId: String?

    var id: String { "\(startAt)|\(endAt)" }

    /// "7월 30일 (목) 15:00" — 파싱에 실패하면 원문 그대로.
    var displayText: String {
        guard let date = APIDateParser.parse(startAt) else { return startAt }
        return SlotDetailFormat.dayTime.string(from: date)
    }
}

/// manual 슬롯의 등록된 시간 창.
struct AvailabilityWindow: Decodable, Identifiable, Sendable {
    let id: String
    let startAt: String
    let capacity: Int
    let bookedCount: Int

    var displayText: String {
        guard let date = APIDateParser.parse(startAt) else { return startAt }
        return SlotDetailFormat.dayTime.string(from: date)
    }
}

struct CreateAvailabilityRequest: Encodable {
    let startAt: String
    let capacity: Int?
}

/// `{"ok":true}` — 필드가 없어도 2xx 면 성공으로 취급한다.
struct OkResponse: Decodable {
    let ok: Bool?
}

// MARK: - 변경분 PATCH

/// PATCH 시 "필드 생략(변경 없음) / 값 / 명시적 null" 3가지 상태를 표현한다.
/// `SlotPatchRequest` 의 프로퍼티가 nil 이면 JSON 에서 키 자체가 빠지고,
/// `.null` 이면 `"validFrom": null` 처럼 명시적 null 로 인코딩된다.
enum PatchValue<Value: Encodable & Sendable>: Encodable, Sendable {
    case value(Value)
    case null

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .value(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

/// `PATCH /api/v1/slots/{id}` — 바뀐 필드만 담아 보낸다.
struct SlotPatchRequest: Encodable, Sendable {
    var title: PatchValue<String>?
    var description: PatchValue<String>?
    var durationMin: PatchValue<Int>?
    var priceCents: PatchValue<Int>?
    var capacity: PatchValue<Int>?
    var slotType: PatchValue<String>?
    var autoApprove: PatchValue<Bool>?
    var locations: PatchValue<[String]>?
    var mode: PatchValue<String>?
    var workingHours: PatchValue<[String: [WorkingInterval]]>?
    var slotIntervalMin: PatchValue<Int>?
    var minNoticeHours: PatchValue<Int>?
    var maxAdvanceDays: PatchValue<Int>?
    var bufferMin: PatchValue<Int>?
    var validFrom: PatchValue<String>?
    var validUntil: PatchValue<String>?
    var active: PatchValue<Bool>?

    var isEmpty: Bool {
        title == nil && description == nil && durationMin == nil && priceCents == nil
            && capacity == nil && slotType == nil && autoApprove == nil && locations == nil
            && mode == nil && workingHours == nil && slotIntervalMin == nil
            && minNoticeHours == nil && maxAdvanceDays == nil && bufferMin == nil
            && validFrom == nil && validUntil == nil && active == nil
    }
}

// MARK: - 표시용 포맷터

enum SlotDetailFormat {
    /// "7월 30일 (목) 15:00"
    static let dayTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) HH:mm"
        return formatter
    }()
}
