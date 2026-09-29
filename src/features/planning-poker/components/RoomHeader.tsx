import Link from "next/link";
import type { ConnectionStatus } from "../model";

type RoomHeaderProps = {
  roomId: string;
  connectionStatus: ConnectionStatus;
  isAdmin: boolean;
  isPlayer: boolean;
  isLoading: boolean;
  onShare: () => void;
  onReset: () => void;
  onLeave: () => void;
  onClose: () => void;
};

export function RoomHeader({ roomId, connectionStatus, isAdmin, isPlayer, isLoading, onShare, onReset, onLeave, onClose }: RoomHeaderProps) {
  const statusLabel = connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting..." : "Reconnecting";

  return (
    <header className="app-header">
      <div className="header-brand">
        <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
        <span className="accenture-mark" aria-label="Accenture">
          <svg viewBox="0 0 18 18" fill="none" width="13" height="13" aria-hidden="true"><polyline points="3,2 15,9 3,16" stroke="#a100ff" strokeWidth="2.5" strokeLinejoin="miter" strokeLinecap="square"/></svg>
          accenture
        </span>
      </div>
      <div className="room-meta">
        <span className={`live-dot ${connectionStatus === "connected" ? "" : "offline-dot"}`} />
        {statusLabel}
        <span className="local-tag">ROOM {roomId}</span>
      </div>
      <div className="header-actions">
        {isAdmin && <button className="reset-button" onClick={onReset} disabled={isLoading} title="Delete tasks and votes, but keep the room" aria-label="Reset room">Reset room</button>}
        {isAdmin && <button className="close-room-button" onClick={onClose} disabled={isLoading} title="Close room and permanently delete all room data" aria-label="Close room">Close room</button>}
        {isPlayer && !isAdmin && <button className="leave-room-button" onClick={onLeave} disabled={isLoading} title="Leave room" aria-label="Leave room">Leave room</button>}
        <button className="share-button" onClick={onShare} aria-label="Copy invite link" title="Copy invite link">
          <span aria-hidden="true">↗</span><span className="share-label">Share</span>
        </button>
      </div>
    </header>
  );
}