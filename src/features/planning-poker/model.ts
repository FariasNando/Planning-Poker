export type Player = {
  readonly id: string;
  readonly name: string;
};

export type Task = {
  readonly id: string;
  readonly title: string;
  readonly votes: Readonly<Record<string, number>>;
  readonly voteLabels: Readonly<Record<string, string>>;
  readonly voterIds: readonly string[];
  readonly voteCount: number;
  readonly finalScore: number | null;
};

export type DeckType = "half-points" | "fibonacci";

export type Room = {
  readonly id: string;
  readonly adminId: string;
  readonly players: readonly Player[];
  readonly tasks: readonly Task[];
  readonly activeTaskId: string | null;
  readonly revealed: boolean;
  readonly deckType: DeckType;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const DECKS: Record<DeckType, readonly number[]> = {
  "half-points": [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
  "fibonacci": [1, 2, 3, 5, 8, 13, 21],
};

export const ESTIMATION_DECK = DECKS["half-points"];

export const ADMIN_TOKEN_PREFIX = "planning-poker-admin-";
export const PLAYER_ID_PREFIX = "planning-poker-player-";
export const PLAYER_TOKEN_PREFIX = "planning-poker-player-token-";
export const PLAYER_JOINED_PREFIX = "planning-poker-player-joined-";
export const PLAYER_VOTE_PREFIX = "planning-poker-vote-";
export const ROOM_NAME_PREFIX = "planning-poker-room-name-";