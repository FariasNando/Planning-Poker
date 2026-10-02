import type { FormEvent } from "react";
import type { Player, Room, Task } from "../model";
import { formatScore } from "../utils";

const AVATAR_COLORS = ["bg-[#334155]", "bg-[#5b6fa6]", "bg-[#a06050]", "bg-[#4a7a9b]", "bg-[#8a7640]"] as const;

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
  const { room, currentPlayerId, removedFromRoom, isAdmin, isLoading, activeTask, name, setName, taskTitle, setTaskTitle, onJoin, onAddTask, onSelectTask, onRemovePlayer } = props;

  return (
    <aside className="relative flex flex-col min-h-[calc(100vh-66px)] pt-[25px] px-[18px] pb-[58px] border-r border-slate-700 bg-[#0b1220] max-sm:min-h-0 max-sm:pt-[15px] max-sm:px-[15px] max-sm:pb-[16px] max-sm:border-r-0 max-sm:border-b max-sm:border-b-slate-700">
      <div className="flex justify-between items-center px-[6px] pb-[12px] max-sm:pb-2">
        <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">PLAYERS</span>
        <span className="text-[#64748b] text-[12px] tracking-[.6px]">{room.players.length.toString().padStart(2, "0")} / 10</span>
      </div>
      <div className="grid gap-[3px] max-sm:flex max-sm:overflow-x-auto max-sm:pb-[2px]">
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
        <form className="flex flex-col gap-2 mt-[18px] p-[12px_7px_4px] max-sm:max-w-[270px]" onSubmit={onJoin}>
          <label className="text-sky-500 text-[12px] font-extrabold tracking-[1px] uppercase" htmlFor="join-name">
            {removedFromRoom ? "Re-join this room" : "Join this room"}
          </label>
          <input
            id="join-name"
            className="h-[37px] border border-slate-700 bg-slate-800 px-[9px] text-slate-100 text-[13px]"
            autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name"
          />
          <button
            className="h-9 px-3 text-[12px] border-0 bg-sky-500 text-white font-bold cursor-pointer transition-[background,transform] duration-[180ms] hover:bg-sky-600 hover:-translate-y-px disabled:cursor-not-allowed"
            type="submit" disabled={isLoading}
          >
            {isLoading ? "Joining..." : <>Join room <span className="ml-[9px]" aria-hidden="true">↗</span></>}
          </button>
        </form>
      )}
      <div className="h-px mt-[22px] mb-[20px] bg-slate-700 max-sm:hidden" />
      <div className="flex justify-between items-center px-[6px] pb-[9px] max-sm:pb-2 max-sm:mt-2">
        <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">TASKS</span>
        <span className="text-[#64748b] text-[12px] tracking-[.6px]">{room.tasks.length.toString().padStart(2, "0")}</span>
      </div>
      <nav className="grid gap-[3px] max-sm:max-h-[100px] max-sm:overflow-auto" aria-label="Tasks">
        {room.tasks.map((task, index) => {
          const isFinalized = task.finalScore !== null;
          const isActive = task.id === room.activeTaskId;
          const rowCls = [
            "min-h-[37px] flex items-center gap-[10px] px-2 w-full border bg-transparent text-left text-slate-100 cursor-pointer disabled:cursor-default",
            isActive ? "border-sky-500/25 bg-sky-500/[.06]" : "border-transparent",
            isFinalized ? "cursor-default hover:bg-transparent hover:border-transparent" : "",
          ].join(" ");
          const inner = (
            <>
              <span className="text-[#475569] text-[11px]">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">{task.title}</span>
              {isFinalized
                ? <span className="min-w-[34px] px-[6px] py-1 bg-sky-500/10 text-sky-500 text-[12px] font-bold [font-family:var(--serif)] text-center" aria-label={`Final average ${formatScore(task.finalScore!)}`}>{formatScore(task.finalScore!)}</span>
                : task.voteCount > 0 && <span className="text-orange-500">•</span>}
            </>
          );
          return isAdmin
            ? <button key={task.id} className={rowCls} onClick={() => !isFinalized && onSelectTask(task.id)} disabled={isFinalized || isLoading}>{inner}</button>
            : <div key={task.id} className={rowCls}>{inner}</div>;
        })}
        {room.tasks.length === 0 && <p className="my-[6px] mx-2 text-[#475569] text-[12px]">Your tasks will appear here.</p>}
      </nav>
      {isAdmin && (
        <form className="flex gap-[5px] mt-[10px] max-sm:mt-2" onSubmit={onAddTask}>
          <input
            className="min-w-0 flex-1 h-[34px] px-[9px] border border-slate-700 bg-[rgba(30,41,59,0.72)] text-slate-100 text-[13px]"
            aria-label="Task title" maxLength={80} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New task name"
          />
          <button
            className="w-[34px] flex-[0_0_34px] border border-slate-700 bg-slate-800 text-sky-500 text-[20px] leading-none cursor-pointer"
            type="submit" aria-label="Add task" disabled={isLoading}
          >
            +
          </button>
        </form>
      )}
      <div className="absolute right-[18px] bottom-[19px] left-[18px] flex justify-between text-[#475569] text-[10px] font-bold tracking-[1px] max-sm:hidden">
        <span>PLANNING POKER</span><span>FREE</span>
      </div>
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
  const isSelected = player.id === currentPlayerId;
  const avatarColor = AVATAR_COLORS[index % 5];
  return (
    <div className={`w-full min-h-[40px] flex items-center gap-[9px] px-[7px] py-1 border bg-transparent text-left cursor-pointer hover:bg-white/5 max-sm:w-auto max-sm:min-w-max max-sm:min-h-[36px] ${isSelected ? "bg-white/5 border-slate-700" : "border-transparent hover:border-slate-700"}`}>
      <span className={`w-[27px] h-[27px] grid flex-[0_0_27px] place-items-center text-white text-[12px] font-bold ${avatarColor}`}>
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="flex flex-1 items-center gap-[6px] overflow-hidden text-[13px] text-ellipsis whitespace-nowrap max-sm:max-w-[105px]">
        {player.name}{player.id === room.adminId && <small className="text-sky-500 text-[10px] font-extrabold tracking-[.7px]">ADMIN</small>}
      </span>
      {activeTask && (() => {
        const hasVoted = activeTask.voterIds.includes(player.id);
        const label = room.revealed ? (activeTask.voteLabels[player.id] ?? "·") : hasVoted ? "✓" : "·";
        return <span className={`text-[12px] ${hasVoted ? "text-sky-500 font-extrabold" : "text-[#475569]"}`} title={hasVoted ? "Voted" : "Waiting"}>{label}</span>;
      })()}
      {canRemove && (
        <button
          className="w-[22px] h-[24px] grid flex-[0_0_22px] place-items-center border-0 bg-transparent text-red-400 text-[19px] leading-none cursor-pointer hover:bg-red-500/10"
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
