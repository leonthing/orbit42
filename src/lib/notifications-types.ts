export type NotificationType =
  | "booking_received"
  | "booking_confirmed"
  | "booking_canceled"
  | "new_message"
  | "new_follower"
  | "bid_placed"
  | "comment_received";

export type AppNotification = {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  link: string | null;
  actor: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  read_at: string | null;
  created_at: string;
};
