"use client";

import { useSearchParams } from "next/navigation";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { GameArea } from "./components/GameArea";
import { RoomHeader } from "./components/RoomHeader";
import { RoomSidebar } from "./components/RoomSidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { usePlanningPokerRoom } from "./use-planning-poker-room";

const ROOM_ID_REGEX = /^[A-Z0-9]{6}$/;

export function PlanningPokerApp() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room")?.toUpperCase() ?? "";
  const roomNameFromUrl = searchParams.get("name") ?? "";
  const roomState = usePlanningPokerRoom(roomId, roomNameFromUrl);

  if (roomId && !ROOM_ID_REGEX.test(roomId)) {
    return <main className="loading-screen">Room not found. Check the invite link and try again.</main>;
  }

  if (!roomId) {
    return (
      <>
        <WelcomeScreen
          name={roomState.name}
          setName={roomState.setName}
          roomTitle={roomState.roomTitle}
          setRoomTitle={roomState.setRoomTitle}
          error={roomState.error}
          isConfigured={roomState.isConfigured}
          isLoading={roomState.isLoading}
          onCreateRoom={roomState.createRoom}
          onJoinRoom={roomState.joinRoomByCode}
        />
        {roomState.existingRoom && (
          <div className="confirm-overlay">
            <div className="confirm-box existing-room-dialog">
              <p className="existing-room-eyebrow">YOU ARE ALREADY IN A ROOM</p>
              <p className="confirm-message">
                {roomState.existingRoom.name
                  ? <>You are registered in the room <strong>&ldquo;{roomState.existingRoom.name}&rdquo;</strong>. Would you like to return?</>
                  : "You are registered in another room. Would you like to return?"}
              </p>
              <div className="confirm-actions">
                <button
                  className="confirm-cancel-button"
                  onClick={roomState.leaveExistingRoom}
                  disabled={roomState.isLoading}
                >
                  {roomState.isLoading ? "Leaving..." : "Leave room"}
                </button>
                <button
                  className="confirm-return-button"
                  onClick={roomState.returnToExistingRoom}
                  disabled={roomState.isLoading}
                >
                  Return to room <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!roomState.isConfigured) {
    return <main className="loading-screen">Configure Supabase in the environment file to connect to this room.</main>;
  }

  if (!roomState.currentRoom) {
    const loadingMessage = roomState.error || (roomState.connectionStatus === "connected" ? "Loading room..." : "Connecting to room...");
    return <main className="loading-screen">{loadingMessage}</main>;
  }

  return (
    <main className="app-shell">
      {roomState.confirmDialog && (
        <ConfirmDialog
          message={roomState.confirmDialog.message}
          onConfirm={roomState.confirmDialog.onConfirm}
          onCancel={roomState.dismissConfirm}
        />
      )}
      <RoomHeader
        roomId={roomId}
        roomName={roomState.currentRoomName}
        connectionStatus={roomState.connectionStatus}
        isAdmin={roomState.isAdmin}
        isPlayer={Boolean(roomState.currentPlayer)}
        isLoading={roomState.isLoading}
        onShare={roomState.copyInvite}
        onReset={roomState.resetRoom}
        onLeave={roomState.leaveRoom}
        onClose={roomState.closeRoom}
      />
      <div className="workspace">
        <RoomSidebar
          room={roomState.currentRoom}
          currentPlayerId={roomState.currentPlayerId}
          removedFromRoom={roomState.removedFromRoom}
          isAdmin={roomState.isAdmin}
          isLoading={roomState.isLoading}
          activeTask={roomState.activeTask}
          onRemovePlayer={roomState.removePlayer}
          name={roomState.name}
          setName={roomState.setName}
          taskTitle={roomState.taskTitle}
          setTaskTitle={roomState.setTaskTitle}
          onJoin={roomState.joinRoom}
          onAddTask={roomState.addTask}
          onSelectTask={roomState.selectTask}
        />
        <GameArea
          room={roomState.currentRoom}
          currentPlayer={roomState.currentPlayer}
          isAdmin={roomState.isAdmin}
          activeTask={roomState.activeTask}
          voteCount={roomState.voteCount}
          completedTaskCount={roomState.completedTaskCount}
          allTasksCompleted={roomState.allTasksCompleted}
          removedFromRoom={roomState.removedFromRoom}
          error={roomState.error}
          notice={roomState.notice}
          myVote={roomState.myVote}
          isLoading={roomState.isLoading}
          onVote={roomState.castVote}
          onFinalize={roomState.finalizeTask}
          onAdvance={roomState.advanceToNextTask}
        />
      </div>
    </main>
  );
}
