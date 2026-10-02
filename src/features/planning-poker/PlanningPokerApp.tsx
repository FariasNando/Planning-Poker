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
    return <main className="min-h-screen grid place-items-center text-slate-400">Room not found. Check the invite link and try again.</main>;
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
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65" role="dialog" aria-modal="true" aria-label="Existing room">
            <div className="w-[min(420px,90vw)] border border-slate-700 border-t-[3px] border-t-sky-500 bg-slate-800 p-7 pb-[22px]">
              <p className="mb-3 text-sky-500 text-[11px] font-extrabold tracking-[1.5px]">YOU ARE ALREADY IN A ROOM</p>
              <p className="mb-[22px] text-[13px] leading-[1.6] text-slate-100">
                {roomState.existingRoom.name
                  ? <>You are registered in the room <strong>&ldquo;{roomState.existingRoom.name}&rdquo;</strong>. Would you like to return?</>
                  : "You are registered in another room. Would you like to return?"}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="h-9 cursor-pointer border border-slate-700 bg-transparent px-3.5 text-[13px] font-bold text-slate-400 hover:bg-[#263548] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={roomState.leaveExistingRoom}
                  disabled={roomState.isLoading}
                >
                  {roomState.isLoading ? "Leaving..." : "Leave room"}
                </button>
                <button
                  className="h-9 px-[14px] border-0 bg-sky-500 text-white text-[13px] font-bold cursor-pointer transition-[background] duration-[180ms] hover:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed"
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
    return <main className="min-h-screen grid place-items-center text-slate-400">Configure Supabase in the environment file to connect to this room.</main>;
  }

  if (!roomState.currentRoom) {
    const loadingMessage = roomState.error || (roomState.connectionStatus === "connected" ? "Loading room..." : "Connecting to room...");
    return <main className="min-h-screen grid place-items-center text-slate-400">{loadingMessage}</main>;
  }

  return (
    <main className="min-h-screen">
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
      <div className="grid [grid-template-columns:278px_minmax(0,1fr)] min-h-[calc(100vh-66px)] max-[900px]:[grid-template-columns:240px_minmax(0,1fr)] max-sm:flex max-sm:flex-col">
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
          onSetDeckType={roomState.setDeckType}
        />
      </div>
    </main>
  );
}
