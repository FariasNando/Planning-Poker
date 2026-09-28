"use client";

import { useSearchParams } from "next/navigation";
import { GameArea } from "./components/GameArea";
import { RoomHeader } from "./components/RoomHeader";
import { RoomSidebar } from "./components/RoomSidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { usePlanningPokerRoom } from "./use-planning-poker-room";

export function PlanningPokerApp() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room")?.toUpperCase() ?? "";
  const roomState = usePlanningPokerRoom(roomId);

  if (!roomId) {
    return (
      <WelcomeScreen
        name={roomState.name}
        setName={roomState.setName}
        error={roomState.error}
        isConfigured={roomState.isConfigured}
        onCreateRoom={roomState.createRoom}
      />
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
      <RoomHeader
        roomId={roomId}
        connectionStatus={roomState.connectionStatus}
        isAdmin={roomState.isAdmin}
        isPlayer={Boolean(roomState.currentPlayer)}
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
          onVote={roomState.castVote}
          onFinalize={roomState.finalizeTask}
        />
      </div>
    </main>
  );
}