import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import {
  ADMIN_TOKEN_PREFIX,
  PLAYER_ID_PREFIX,
  PLAYER_JOINED_PREFIX,
  PLAYER_TOKEN_PREFIX,
  type ConnectionStatus,
  type Room,
} from "./model";
import { createId, createRoomCode, formatScore, mapRoom } from "./utils";

function clearRoomIdentity(roomId: string) {
  window.localStorage.removeItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
  window.localStorage.removeItem(`${PLAYER_ID_PREFIX}${roomId}`);
  window.localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
  window.localStorage.removeItem(`${PLAYER_JOINED_PREFIX}${roomId}`);
  window.sessionStorage.removeItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
  window.sessionStorage.removeItem(`${PLAYER_ID_PREFIX}${roomId}`);
  window.sessionStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
}

function getStoredIdentity(key: string) {
  const storedValue = window.localStorage.getItem(key);
  if (storedValue) return storedValue;

  const legacyValue = window.sessionStorage.getItem(key);
  if (!legacyValue) return null;

  window.localStorage.setItem(key, legacyValue);
  window.sessionStorage.removeItem(key);
  if (key.startsWith(PLAYER_ID_PREFIX) || key.startsWith(PLAYER_TOKEN_PREFIX)) {
    const prefix = key.startsWith(PLAYER_ID_PREFIX) ? PLAYER_ID_PREFIX : PLAYER_TOKEN_PREFIX;
    const roomId = key.slice(prefix.length);
    window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
  }
  return legacyValue;
}

function getOrCreateIdentity(key: string) {
  const existingValue = getStoredIdentity(key);
  if (existingValue) return existingValue;

  const newValue = createId();
  window.localStorage.setItem(key, newValue);
  return newValue;
}

export function usePlanningPokerRoom(roomId: string) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [removedFromRoom, setRemovedFromRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [myVote, setMyVote] = useState<{ taskId: string; score: number } | null>(null);
  const supabase = getSupabaseClient();
  const currentRoom = room?.id === roomId ? room : null;
  const currentPlayerId = playerId && currentRoom?.players.some((player) => player.id === playerId) ? playerId : "";
  const currentPlayer = currentRoom?.players.find((player) => player.id === currentPlayerId);
  const isAdmin = Boolean(currentRoom && currentPlayerId === currentRoom.adminId);
  const activeTask = currentRoom?.tasks.find((task) => task.id === currentRoom.activeTaskId) ?? null;
  const voteCount = activeTask?.voteCount ?? 0;
  const completedTaskCount = currentRoom?.tasks.filter((task) => task.finalScore !== null).length ?? 0;
  const allTasksCompleted = Boolean(currentRoom && currentRoom.tasks.length > 0 && completedTaskCount === currentRoom.tasks.length);

  useEffect(() => {
    if (!roomId || !supabase) return;
    let cancelled = false;

    const refreshRoom = async () => {
      const { data, error: fetchError } = await supabase.rpc("get_planning_poker_room", { p_room_id: roomId });
      if (cancelled) return null;
      if (fetchError) {
        setError(fetchError.message);
        return null;
      }
      const loadedRoom = mapRoom(data);
      setRoom(loadedRoom);
      const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
      if (adminToken) {
        window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, adminToken);
        window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
        setPlayerId(loadedRoom.adminId);
        setRemovedFromRoom(false);
        return loadedRoom;
      }

      const wasPreviouslyJoined = window.localStorage.getItem(`${PLAYER_JOINED_PREFIX}${roomId}`) === "true";
      const savedPlayerId = getStoredIdentity(`${PLAYER_ID_PREFIX}${roomId}`);
      const savedPlayerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
      if (!savedPlayerId || !savedPlayerToken) {
        setPlayerId("");
        setRemovedFromRoom(wasPreviouslyJoined);
        return loadedRoom;
      }

      const playerStillInRoom = loadedRoom.players.some((player) => player.id === savedPlayerId);
      if (playerStillInRoom) {
        window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
        setPlayerId(savedPlayerId);
        setRemovedFromRoom(false);
      } else if (wasPreviouslyJoined) {
        clearRoomIdentity(roomId);
        setPlayerId("");
        setRemovedFromRoom(true);
      } else {
        setPlayerId("");
        setRemovedFromRoom(false);
      }
      return loadedRoom;
    };

    const channel = supabase
      .channel(`planning-poker:${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "planning_poker_rooms",
        filter: `id=eq.${roomId}`,
      }, () => {
        void refreshRoom();
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "planning_poker_rooms",
      }, (payload) => {
        const deletedRoomId = (payload.old as Record<string, unknown>).id;
        if (deletedRoomId !== roomId) return;
        clearRoomIdentity(roomId);
        router.replace("/");
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          void refreshRoom();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId, router, supabase]);

  async function callRoomRpc(functionName: string, parameters: Record<string, unknown>) {
    if (!supabase) {
      setError("Configure Supabase to enable online rooms.");
      return null;
    }
    setError("");
    const { data, error: rpcError } = await supabase.rpc(functionName, parameters);
    if (rpcError) {
      setError(rpcError.message);
      return null;
    }
    const updatedRoom = mapRoom(data);
    setRoom(updatedRoom);
    return updatedRoom;
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("To create online rooms, configure both NEXT_PUBLIC_SUPABASE environment variables.");
      return;
    }
    if (!name.trim()) return;
    const adminId = createId();
    const adminToken = createId();
    const roomCode = createRoomCode();
    const created = await callRoomRpc("create_planning_poker_room", {
      p_room_id: roomCode,
      p_admin_id: adminId,
      p_admin_name: name.trim(),
      p_admin_token: adminToken,
    });
    if (!created) return;
    window.localStorage.setItem(`${ADMIN_TOKEN_PREFIX}${roomCode}`, adminToken);
    window.localStorage.setItem(`${PLAYER_ID_PREFIX}${roomCode}`, adminId);
    window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomCode}`, adminToken);
    window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomCode}`, "true");
    router.push(`/?room=${roomCode}`);
    setName("");
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRoom || !name.trim()) return;
    const newPlayerId = createId();
    const playerToken = createId();
    const joined = await callRoomRpc("join_planning_poker_room", {
      p_room_id: roomId,
      p_player_id: newPlayerId,
      p_player_name: name.trim(),
      p_player_token: playerToken,
    });
    if (!joined) return;
    window.localStorage.setItem(`${PLAYER_ID_PREFIX}${roomId}`, newPlayerId);
    window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, playerToken);
    window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
    setPlayerId(newPlayerId);
    setRemovedFromRoom(false);
    setName("");
  }

  async function resetRoom() {
    if (!currentRoom || !isAdmin) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    if (!window.confirm("Reset this room? All tasks and votes will be permanently deleted.")) return;
    const updated = await callRoomRpc("reset_planning_poker_room", {
      p_room_id: roomId,
      p_admin_token: token,
    });
    if (updated) {
      setMyVote(null);
      setTaskTitle("");
    }
  }

  async function removePlayer(targetPlayerId: string, targetPlayerName: string) {
    if (!isAdmin || !currentRoom || targetPlayerId === currentRoom.adminId) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    if (!window.confirm(`Remove ${targetPlayerName} from this room? Their votes will also be deleted.`)) return;
    await callRoomRpc("remove_planning_poker_player", {
      p_room_id: roomId,
      p_admin_token: token,
      p_player_id: targetPlayerId,
    });
  }

  async function leaveRoom() {
    if (!currentRoom || !currentPlayerId || isAdmin) return;
    const playerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
    if (!playerToken) return setError("Player session not found in this browser.");
    if (!window.confirm("Leave this room? Your existing votes will remain, and you can rejoin from the invite link.")) return;
    const leftRoom = await callRoomRpc("leave_planning_poker_room", {
      p_room_id: roomId,
      p_player_id: currentPlayerId,
      p_player_token: playerToken,
    });
    if (!leftRoom) return;
    clearRoomIdentity(roomId);
    router.replace("/");
  }

  async function closeRoom() {
    if (!currentRoom || !isAdmin) return;
    const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!adminToken) return setError("Admin session not found in this browser.");
    if (!window.confirm("Close this room permanently? All room data, players, tasks, and votes will be deleted.")) return;
    if (!supabase) return setError("Configure Supabase to manage this room.");
    setError("");
    const { error: closeError } = await supabase.rpc("close_planning_poker_room", {
      p_room_id: roomId,
      p_admin_token: adminToken,
    });
    if (closeError) return setError(closeError.message);
    clearRoomIdentity(roomId);
    router.replace("/");
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRoom || !taskTitle.trim()) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    const updated = await callRoomRpc("add_planning_poker_task", {
      p_room_id: roomId,
      p_admin_token: token,
      p_task_id: createId(),
      p_title: taskTitle.trim(),
    });
    if (updated) setTaskTitle("");
  }

  async function selectTask(taskId: string) {
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    await callRoomRpc("select_planning_poker_task", { p_room_id: roomId, p_admin_token: token, p_task_id: taskId });
  }

  async function castVote(score: number) {
    if (!currentRoom || !activeTask || !currentPlayerId) return;
    const playerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
    if (!playerToken) return setError("Player session not found in this browser.");
    const updated = await callRoomRpc("vote_planning_poker", {
      p_room_id: roomId,
      p_player_id: currentPlayerId,
      p_player_token: playerToken,
      p_task_id: activeTask.id,
      p_score: score,
      p_card_label: formatScore(score),
    });
    if (updated) setMyVote({ taskId: activeTask.id, score });
  }

  async function finalizeTask() {
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token || !currentRoom) return setError("Admin session not found in this browser.");
    await callRoomRpc("reveal_planning_poker_votes", {
      p_room_id: roomId,
      p_admin_token: token,
      p_revealed: true,
    });
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Invite link copied");
      window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setError("Could not copy the invite link in this browser.");
    }
  }

  return {
    name,
    setName,
    taskTitle,
    setTaskTitle,
    room,
    currentRoom,
    currentPlayer,
    currentPlayerId,
    removedFromRoom,
    isAdmin,
    activeTask,
    voteCount,
    completedTaskCount,
    allTasksCompleted,
    connectionStatus,
    error,
    notice,
    myVote,
    isConfigured: Boolean(supabase),
    createRoom,
    joinRoom,
    addTask,
    selectTask,
    castVote,
    finalizeTask,
    resetRoom,
    removePlayer,
    leaveRoom,
    closeRoom,
    copyInvite,
    formatScore,
  };
}