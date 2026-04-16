export const NOTIFICATION_TYPES = [
  { key: "new_message", label: "새 메시지" },
  { key: "booking_received", label: "예약 요청/확정" },
  { key: "booking_confirmed", label: "예약 확정" },
  { key: "booking_canceled", label: "예약 취소" },
  { key: "new_follower", label: "새 팔로워" },
  { key: "comment_received", label: "댓글" },
  { key: "reply_received", label: "답글" },
  { key: "reaction", label: "반응(좋아요)" },
  { key: "invite_used", label: "내 초대 코드 사용됨" },
] as const;

export type NotificationPref = {
  type: string;
  in_app: boolean;
  email: boolean;
};
