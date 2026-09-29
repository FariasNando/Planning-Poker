import type { FormEvent } from "react";
import type { Player, Room, Task } from "../model";
import { formatScore } from "../utils";

type RoomSidebarProps = {
  room: Room;
  currentPlayerId: string;
  removedFromRoom: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  activeTask: Task | null;
  name: string;
  setName: (name: string) => void;
  taskTitle: string;
  setTaskTitle: (title: string) => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onSelectTask: (taskId: string) => void;
  onRemovePlayer: (playerId: string, playerName: string) => void;
};

export function RoomSidebar(props: RoomSidebarProps) {
  const {
    room,
    currentPlayerId,
    removedFromRoom,
    isAdmin,
    isLoading,
    activeTask,
    name,
    setName,
    taskTitle,
    setTaskTitle,
    onJoin,
    onAddTask,
    onSelectTask,
    onRemovePlayer,
  } = props;

  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <span className="eyebrow">PLAYERS</span>
        <span className="room-count">{room.players.length.toString().padStart(2, "0")} / 10</span>
      </div>
      <div className="people-list">
        {room.players.map((player, index) => (
          <PlayerRow
            key={player.id}
            player={player}
            index={index}
            room={room}
            currentPlayerId={currentPlayerId}
            activeTask={activeTask}
            canRemove={isAdmin && player.id !== room.adminId}
            isLoading={isLoading}
            onRemovePlayer={onRemovePlayer}
          />
        ))}
      </div>
      {!currentPlayerId && (
        <form className="join-form" onSubmit={onJoin}>
          <label htmlFor="join-name">{removedFromRoom ? "Re-join this room" : "Join this room"}</label>
          <input id="join-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Joining..." : <>Join room <span aria-hidden="true">↗</span></>}</button>
        </form>
      )}
      <div className="sidebar-rule" />
      <div className="sidebar-heading tasks-heading">
        <span className="eyebrow">TASKS</span>
        <span className="room-count">{room.tasks.length.toString().padStart(2, "0")}</span>
      </div>
      <nav className="task-list" aria-label="Tasks">
        {room.tasks.map((task, index) => {
          const isFinalized = task.finalScore !== null;
          const rowClass = `task-row ${task.id === room.activeTaskId ? "active-task" : ""} ${isFinalized ? "finalized-task" : ""}`;
          const inner = (
            <>
              <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="task-name">{task.title}</span>
              {isFinalized
                ? <span className="task-score-badge" aria-label={`Final average ${formatScore(task.finalScore!)}`}>{formatScore(task.finalScore!)}</span>
                : task.voteCount > 0 && <span className="task-complete">•</span>}
            </>
          );
          return isAdmin
            ? <button key={task.id} className={rowClass} onClick={() => !isFinalized && onSelectTask(task.id)} disabled={isFinalized || isLoading}>{inner}</button>
            : <div key={task.id} className={rowClass}>{inner}</div>;
        })}
        {room.tasks.length === 0 && <p className="empty-tasks">Your tasks will appear here.</p>}
      </nav>
      {isAdmin && (
        <form className="add-task" onSubmit={onAddTask}>
          <input aria-label="Task title" maxLength={80} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New task name" />
          <button type="submit" aria-label="Add task" disabled={isLoading}>+</button>
        </form>
      )}
      <div className="sidebar-bottom"><span>PLANNING POKER</span><span>FREE</span></div>
    </aside>
  );
}

type PlayerRowProps = {
  player: Player;
  index: number;
  room: Room;
  currentPlayerId: string;
  activeTask: Task | null;
  canRemove: boolean;
  isLoading: boolean;
  onRemovePlayer: (playerId: string, playerName: string) => void;
};

function PlayerRow({ player, index, room, currentPlayerId, activeTask, canRemove, isLoading, onRemovePlayer }: PlayerRowProps) {
  return (
    <div className={`person-row ${player.id === currentPlayerId ? "selected-person" : ""}`}>
      <span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span>
      <span className="person-name">{player.name}{player.id === room.adminId && <small>ADMIN</small>}</span>
      {activeTask && <span className={`vote-status ${activeTask.votes[player.id] !== undefined ? "voted" : ""}`}>{room.revealed ? (activeTask.voteLabels[player.id] ?? "·") : "·"}</span>}
      {canRemove && (
        <button
          className="remove-player-button"
          type="button"
          onClick={() => onRemovePlayer(player.id, player.name)}
          disabled={isLoading}
          aria-label={`Remove ${player.name}`}
          title={`Remove ${player.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}