export type ReactionTarget = "event" | "post" | "slot";

export const REACTION_EMOJIS = ["❤️", "🔥", "👀", "✋", "👏"] as const;

export type ReactionSummary = {
  emoji: string;
  count: number;
  by_me: boolean;
};
