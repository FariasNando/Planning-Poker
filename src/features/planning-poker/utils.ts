import type { Room } from "./model";

export function createId() {
  return crypto.randomUUID();
}

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function mapRoom(value: unknown): Room {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    adminId: String(row.adminId ?? row.admin_id),
    players: (row.players ?? []) as Room["players"],
    tasks: ((row.tasks ?? []) as Record<string, unknown>[]).map((task) => ({
      id: String(task.id),
      title: String(task.title),
      votes: (task.votes ?? {}) as Record<string, number>,
      voteLabels: (task.voteLabels ?? {}) as Record<string, string>,
      voteCount: Number(task.voteCount ?? 0),
      finalScore: task.finalScore === null || task.finalScore === undefined ? null : Number(task.finalScore),
    })),
    activeTaskId: (row.activeTaskId ?? row.active_task_id ?? null) as string | null,
    revealed: Boolean(row.revealed),
  };
}