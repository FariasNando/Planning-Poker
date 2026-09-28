export type Player = {
  id: string;
  name: string;
};

export type Task = {
  id: string;
  title: string;
  votes: Record<string, number>;
  voteLabels: Record<string, string>;
  voteCount: number;
  finalScore: number | null;
};

export type Room = {
  id: string;
  adminId: string;
  players: Player[];
  tasks: Task[];
  activeTaskId: string | null;
  revealed: boolean;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const ESTIMATION_DECK = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export const ADMIN_TOKEN_PREFIX = "planning-poker-admin-";
export const PLAYER_ID_PREFIX = "planning-poker-player-";
export const PLAYER_TOKEN_PREFIX = "planning-poker-player-token-";
export const PLAYER_JOINED_PREFIX = "planning-poker-player-joined-";