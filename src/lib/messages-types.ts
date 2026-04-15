export type ConversationSummary = {
  id: string;
  other: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_is_me: boolean;
  unread: boolean;
};

export type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
