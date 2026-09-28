import Link from "next/link";
import type { ConnectionStatus } from "../model";

type RoomHeaderProps = {
  roomId: string;
  connectionStatus: ConnectionStatus;
  isAdmin: boolean;
  isPlayer: boolean;
  onShare: () => void;
  onReset: () => void;
  onLeave: () => void;
  onClose: () => void;
};

export function RoomHeader({ roomId, connectionStatus, isAdmin, isPlayer, onShare, onReset, onLeave, onClose }: RoomHeaderProps) {
  const connected = connectionStatus === "connected";

  return (
    <header className="app-header">
      <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
      <div className="room-meta">
        <span className={`live-dot ${connected ? "" : "offline-dot"}`} />
        {connected ? "Connected" : "Reconnecting"}
        <span className="local-tag">ROOM {roomId}</span>
      </div>
      <div className="header-actions">
        {isAdmin && <button className="reset-button" onClick={onReset} title="Delete tasks and votes, but keep the room" aria-label="Reset room">Reset room</button>}
        {isAdmin && <button className="close-room-button" onClick={onClose} title="Close room and permanently delete all room data" aria-label="Close room">Close room</button>}
        {isPlayer && !isAdmin && <button className="leave-room-button" onClick={onLeave} title="Leave room" aria-label="Leave room">Leave room</button>}
        <button className="share-button" onClick={onShare} aria-label="Copy invite link" title="Copy invite link">
          <span aria-hidden="true">↗</span><span className="share-label">Share</span>
        </button>
      </div>
    </header>
  );
}