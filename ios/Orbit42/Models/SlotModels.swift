import Foundation

// MARK: - 타임슬롯

/// API v1 계약의 slot 객체 (`GET /api/v1/slots`).
struct TimeSlot: Decodable, Identifiable, Sendable {
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

    // MARK: 표시용 파생값

    /// 슬롯 유형 뱃지 텍스트
    var typeBadgeText: String {
        switch slotType {
        case "1on1": return "1:1"
        case "companion": return "동행"
        case "group": return "그룹"
        default: return slotType
        }
    }

    /// 수락 방식 뱃지 텍스트
    var modeBadgeText: String {
        mode == "manual" ? "수동" : "자동"
    }

    var isAuction: Bool { pricingModel == "auction" }

    /// "60분"
    var durationText: String { "\(durationMin)분" }

    /// priceCents/100 을 "₩12,000" 형식으로. 0이면 "무료".
    var priceText: String {
        if priceCents == 0 { return "무료" }
        let amount = priceCents / 100
        let formatted = Self.priceFormatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "₩\(formatted)"
    }

    private static let priceFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()
}

// MARK: - 빠른 생성 프리셋

/// `POST /api/v1/slots/presets` 의 key 값과 1:1 대응.
enum SlotPreset: String, CaseIterable, Identifiable {
    case meeting
    case meal
    case coffee

    var id: String { rawValue }

    var title: String {
        switch self {
        case .meeting: return "업무 미팅"
        case .meal: return "식사"
        case .coffee: return "커피챗"
        }
    }

    var systemImage: String {
        switch self {
        case .meeting: return "briefcase"
        case .meal: return "fork.knife"
        case .coffee: return "cup.and.saucer"
        }
    }
}

// MARK: - 요청/응답 페이로드

struct SlotsResponse: Decodable {
    let slots: [TimeSlot]
}

struct UpdateSlotRequest: Encodable {
    let active: Bool
}

struct SlotResponse: Decodable {
    let slot: TimeSlot
}

struct SlotPresetRequest: Encodable {
    let key: String
}

/// `{"created":true,"slug":"..."}` 또는 `{"skipped":true}`
struct SlotPresetResponse: Decodable {
    let created: Bool?
    let skipped: Bool?
    let slug: String?

    var wasSkipped: Bool { skipped == true }
}
