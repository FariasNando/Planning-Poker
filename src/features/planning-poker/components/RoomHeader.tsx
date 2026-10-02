import Link from "next/link";
import type { ConnectionStatus } from "../model";

type RoomHeaderProps = {
  roomId: string;
  roomName: string;
  connectionStatus: ConnectionStatus;
  isAdmin: boolean;
  isPlayer: boolean;
  isLoading: boolean;
  onShare: () => void;
  onReset: () => void;
  onLeave: () => void;
  onClose: () => void;
};

export function RoomHeader({ roomId, roomName, connectionStatus, isAdmin, isPlayer, isLoading, onShare, onReset, onLeave, onClose }: RoomHeaderProps) {
  const statusLabel = connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting..." : "Reconnecting";

  return (
    <header className="flex h-[66px] items-center justify-between border-b border-slate-700 bg-slate-800 px-[34px] max-sm:h-[62px] max-sm:px-[17px]">
      <div className="flex items-center gap-[14px]">
        <Link className="text-[17px] font-extrabold text-slate-100 no-underline max-sm:text-[15px]" href="/">
          Planning<span className="text-sky-500">Poker</span>
        </Link>
        {roomName && (
          <span className="border border-sky-500/[.18] bg-sky-500/[.08] px-[10px] py-[5px] text-[12px] font-bold tracking-[.3px] text-sky-500">
            {roomName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-[9px] text-[13px] text-slate-400 max-sm:gap-[6px] max-sm:text-[12px]">
        <span className={`h-[7px] w-[7px] rounded-full ${connectionStatus === "connected" ? "bg-sky-500" : "bg-orange-500"}`} />
        {statusLabel}
        <span className="ml-2 border border-sky-500/30 px-[9px] py-[6px] text-[11px] font-extrabold tracking-[1.2px] text-sky-500 max-sm:hidden">
          ROOM {roomId}
        </span>
      </div>
      <div className="flex items-center gap-2 max-sm:gap-[5px]">
        {isAdmin && (
          <button
            className="min-h-[34px] cursor-pointer border border-orange-500/30 bg-transparent px-[10px] text-[12px] font-bold text-orange-500 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-[31px] max-sm:px-[7px] max-sm:text-[11px]"
            onClick={onReset} disabled={isLoading} title="Delete tasks and votes, but keep the room" aria-label="Reset room"
          >
            Reset room
          </button>
        )}
        {isAdmin && (
          <button
            className="min-h-[34px] cursor-pointer border border-red-500 bg-red-500 px-[10px] text-[12px] font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-[31px] max-sm:px-[7px] max-sm:text-[11px]"
            onClick={onClose} disabled={isLoading} title="Close room and permanently delete all room data" aria-label="Close room"
          >
            Close room
          </button>
        )}
        {isPlayer && !isAdmin && (
          <button
            className="min-h-[34px] cursor-pointer border border-slate-700 bg-transparent px-[10px] text-[12px] font-bold text-slate-400 hover:bg-[#263548] disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-[31px] max-sm:px-[7px] max-sm:text-[11px]"
            onClick={onLeave} disabled={isLoading} title="Leave room" aria-label="Leave room"
          >
            Leave room
          </button>
        )}
        <button
          className="flex min-h-[34px] cursor-pointer items-center gap-[9px] border border-slate-700 bg-slate-800 px-[11px] text-[12px] font-bold text-sky-500 max-sm:min-h-[31px] max-sm:px-[9px]"
          onClick={onShare} aria-label="Copy invite link" title="Copy invite link"
        >
          <span className="text-[15px]" aria-hidden="true">↗</span>
          <span className="max-sm:hidden">Share</span>
        </button>
      </div>
    </header>
  );
}
