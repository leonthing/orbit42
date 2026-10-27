export const NOTIFICATION_TYPES = [
  { key: "new_message", label: "새 메시지" },
  { key: "booking_message", label: "예약 대화" },
  { key: "booking_received", label: "예약 요청/확정" },
  { key: "booking_confirmed", label: "예약 확정" },
  { key: "booking_canceled", label: "예약 취소" },
  { key: "booking_reminder", label: "예약 리마인더 (하루 전)" },
  { key: "booking_reminder_1h", label: "예약 리마인더 (1시간 전)" },
  { key: "event_invite", label: "일정 초대" },
  { key: "new_follower", label: "새 팔로워" },
  { key: "comment_received", label: "댓글" },
  { key: "reply_received", label: "답글" },
  { key: "reaction", label: "반응(좋아요)" },
  { key: "review_received", label: "후기" },
  { key: "time_request", label: "시간 요청" },
  { key: "invite_used", label: "내 추천으로 가입됨" },
  { key: "weekly_digest", label: "주간 요약 이메일" },
] as const;

export type NotificationPref = {
  type: string;
  in_app: boolean;
  email: boolean;
  /** 앱 푸시 (1.8.0 — 지금은 예약 대화만 푸시를 보낸다) */
  push: boolean;
};

/** 앱 푸시를 보내는 알림 유형 — 앱 설정에 푸시 스위치가 보이는 곳 */
export const PUSH_TYPES = ["booking_message"] as const;
