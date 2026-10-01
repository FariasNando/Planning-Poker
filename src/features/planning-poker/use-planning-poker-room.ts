import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import {
  ADMIN_TOKEN_PREFIX,
  PLAYER_ID_PREFIX,
  PLAYER_JOINED_PREFIX,
  PLAYER_TOKEN_PREFIX,
  PLAYER_VOTE_PREFIX,
  ROOM_NAME_PREFIX,
  type ConnectionStatus,
  type Room,
} from "./model";
import { createId, createRoomCode, formatScore, mapRoom } from "./utils";

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

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

export function usePlanningPokerRoom(roomId: string, roomNameFromUrl?: string) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [removedFromRoom, setRemovedFromRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [myVote, setMyVote] = useState<{ taskId: string; score: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [existingRoom, setExistingRoom] = useState<{ id: string; name: string } | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState("");
  const skipNextUpdateRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    return () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); };
  }, []);

  // Save room name from URL when entering a room
  useEffect(() => {
    if (!roomId || !roomNameFromUrl) return;
    const existing = window.localStorage.getItem(`${ROOM_NAME_PREFIX}${roomId}`);
    if (!existing) {
      window.localStorage.setItem(`${ROOM_NAME_PREFIX}${roomId}`, roomNameFromUrl);
    }
    setCurrentRoomName(existing || roomNameFromUrl);
  }, [roomId, roomNameFromUrl]);

  // Read room name from localStorage when in a room
  useEffect(() => {
    if (!roomId) return;
    const saved = window.localStorage.getItem(`${ROOM_NAME_PREFIX}${roomId}`);
    if (saved) setCurrentRoomName(saved);
  }, [roomId]);

  // Detect if user is already registered in a room (when on home screen)
  useEffect(() => {
    if (roomId || !supabase) return;
    setExistingRoom(null);

    const findExistingRoom = async () => {
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (key.startsWith(PLAYER_JOINED_PREFIX) && window.localStorage.getItem(key) === "true") {
          const roomCode = key.slice(PLAYER_JOINED_PREFIX.length);
          const { data, error: fetchError } = await supabase.rpc("get_planning_poker_room", { p_room_id: roomCode });
          if (fetchError || !data) {
            clearRoomIdentity(roomCode);
            window.localStorage.removeItem(`${ROOM_NAME_PREFIX}${roomCode}`);
            continue;
          }
          const roomName = window.localStorage.getItem(`${ROOM_NAME_PREFIX}${roomCode}`) ?? "";
          setExistingRoom({ id: roomCode, name: roomName });
          return;
        }
      }
    };

    void findExistingRoom();
  }, [roomId, supabase]);

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

      const restoreMyVote = () => {
        const activeTask = loadedRoom.tasks.find((t) => t.id === loadedRoom.activeTaskId);
        if (!activeTask) { setMyVote(null); return; }
        const stored = window.localStorage.getItem(`${PLAYER_VOTE_PREFIX}${roomId}-${activeTask.id}`);
        setMyVote(stored !== null ? { taskId: activeTask.id, score: Number(stored) } : null);
      };

      const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
      if (adminToken) {
        window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, adminToken);
        window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
        setPlayerId(loadedRoom.adminId);
        setRemovedFromRoom(false);
        restoreMyVote();
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

      // Detect admin promotion: player's id now matches admin_id but no admin token is saved locally.
      // This happens when the previous admin left and this player was promoted.
      // Promote their player token to admin token so admin actions work immediately.
      if (savedPlayerId === loadedRoom.adminId) {
        window.localStorage.setItem(`${ADMIN_TOKEN_PREFIX}${roomId}`, savedPlayerToken);
        window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
        setPlayerId(savedPlayerId);
        setRemovedFromRoom(false);
        restoreMyVote();
        return loadedRoom;
      }

      const playerStillInRoom = loadedRoom.players.some((player) => player.id === savedPlayerId);
      if (playerStillInRoom) {
        window.localStorage.setItem(`${PLAYER_JOINED_PREFIX}${roomId}`, "true");
        setPlayerId(savedPlayerId);
        setRemovedFromRoom(false);
        restoreMyVote();
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
        if (skipNextUpdateRef.current) { skipNextUpdateRef.current = false; return; }
        void refreshRoom();
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "planning_poker_rooms",
        filter: `id=eq.${roomId}`,
      }, () => {
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
    setIsLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc(functionName, parameters);
      if (rpcError) {
        setError(rpcError.message);
        return null;
      }
      const updatedRoom = mapRoom(data);
      setRoom(updatedRoom);
      skipNextUpdateRef.current = true;
      return updatedRoom;
    } finally {
      setIsLoading(false);
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("To create online rooms, configure both NEXT_PUBLIC_SUPABASE environment variables.");
      return;
    }
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!roomTitle.trim()) { setError("Please enter a room name."); return; }
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
    window.localStorage.setItem(`${ROOM_NAME_PREFIX}${roomCode}`, roomTitle.trim());
    router.push(`/?room=${roomCode}&name=${encodeURIComponent(roomTitle.trim())}`);
    setName("");
    setRoomTitle("");
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

  function joinRoomByCode(code: string) {
    const clean = code.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(clean)) {
      setError("Invalid room code. Please enter a valid 6-character code.");
      return;
    }
    setError("");
    router.push(`/?room=${clean}`);
  }

  function returnToExistingRoom() {
    if (!existingRoom) return;
    const nameParam = existingRoom.name ? `&name=${encodeURIComponent(existingRoom.name)}` : "";
    router.push(`/?room=${existingRoom.id}${nameParam}`);
  }

  async function leaveExistingRoom() {
    if (!existingRoom) return;
    setIsLoading(true);
    try {
      const adminToken = window.localStorage.getItem(`${ADMIN_TOKEN_PREFIX}${existingRoom.id}`);
      const savedPlayerId = window.localStorage.getItem(`${PLAYER_ID_PREFIX}${existingRoom.id}`);
      const savedPlayerToken = window.localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${existingRoom.id}`);

      if (supabase) {
        try {
          if (adminToken) {
            await supabase.rpc("admin_leave_planning_poker_room", {
              p_room_id: existingRoom.id,
              p_admin_token: adminToken,
            });
          } else if (savedPlayerId && savedPlayerToken) {
            await supabase.rpc("leave_planning_poker_room", {
              p_room_id: existingRoom.id,
              p_player_id: savedPlayerId,
              p_player_token: savedPlayerToken,
            });
          }
        } catch {
          // Ignore — room may no longer exist
        }
      }

      clearRoomIdentity(existingRoom.id);
      window.localStorage.removeItem(`${ROOM_NAME_PREFIX}${existingRoom.id}`);
      setExistingRoom(null);
    } finally {
      setIsLoading(false);
    }
  }

  function requestConfirm(message: string, onConfirm: () => void) {
    setConfirmDialog({ message, onConfirm });
  }

  function dismissConfirm() {
    setConfirmDialog(null);
  }

  function resetRoom() {
    if (!currentRoom || !isAdmin) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    requestConfirm("Reset this room? All tasks and votes will be permanently deleted.", async () => {
      dismissConfirm();
      const updated = await callRoomRpc("reset_planning_poker_room", {
        p_room_id: roomId,
        p_admin_token: token,
      });
      if (updated) {
        setMyVote(null);
        setTaskTitle("");
      }
    });
  }

  function removePlayer(targetPlayerId: string, targetPlayerName: string) {
    if (!isAdmin || !currentRoom || targetPlayerId === currentRoom.adminId) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    requestConfirm(`Remove ${targetPlayerName} from this room? Their votes will also be deleted.`, async () => {
      dismissConfirm();
      await callRoomRpc("remove_planning_poker_player", {
        p_room_id: roomId,
        p_admin_token: token,
        p_player_id: targetPlayerId,
      });
    });
  }

  function leaveRoom() {
    if (!currentRoom || !currentPlayerId || isAdmin) return;
    const playerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
    if (!playerToken) return setError("Player session not found in this browser.");
    requestConfirm("Leave this room? Your existing votes will remain, and you can rejoin from the invite link.", async () => {
      dismissConfirm();
      const leftRoom = await callRoomRpc("leave_planning_poker_room", {
        p_room_id: roomId,
        p_player_id: currentPlayerId,
        p_player_token: playerToken,
      });
      if (!leftRoom) return;
      clearRoomIdentity(roomId);
      router.replace("/");
    });
  }

  function closeRoom() {
    if (!currentRoom || !isAdmin) return;
    const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!adminToken) return setError("Admin session not found in this browser.");
    if (!supabase) return setError("Configure Supabase to manage this room.");
    const supabaseClient = supabase;
    requestConfirm("Close this room permanently? All room data, players, tasks, and votes will be deleted.", async () => {
      dismissConfirm();
      setError("");
      setIsLoading(true);
      try {
        const { error: closeError } = await supabaseClient.rpc("close_planning_poker_room", {
          p_room_id: roomId,
          p_admin_token: adminToken,
        });
        if (closeError) return setError(closeError.message);
        clearRoomIdentity(roomId);
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    });
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
    if (updated) {
      window.localStorage.setItem(`${PLAYER_VOTE_PREFIX}${roomId}-${activeTask.id}`, String(score));
      setMyVote({ taskId: activeTask.id, score });
    }
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

  async function advanceToNextTask() {
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token || !currentRoom) return setError("Admin session not found in this browser.");
    const updated = await callRoomRpc("advance_planning_poker_task", {
      p_room_id: roomId,
      p_admin_token: token,
    });
    if (updated) setMyVote(null);
  }

  async function setDeckType(deckType: string) {
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    await callRoomRpc("set_planning_poker_deck", {
      p_room_id: roomId,
      p_admin_token: token,
      p_deck_type: deckType,
    });
  }

  async function copyInvite() {
    const nameParam = currentRoomName ? `&name=${encodeURIComponent(currentRoomName)}` : "";
    const inviteUrl = `${window.location.origin}/?room=${roomId}${nameParam}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Invite link copied");
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setError("Could not copy the invite link in this browser.");
    }
  }

  return {
    name,
    setName,
    roomTitle,
    setRoomTitle,
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
    isLoading,
    confirmDialog,
    dismissConfirm,
    isConfigured: Boolean(supabase),
    existingRoom,
    currentRoomName,
    createRoom,
    joinRoom,
    joinRoomByCode,
    returnToExistingRoom,
    leaveExistingRoom,
    addTask,
    selectTask,
    castVote,
    finalizeTask,
    advanceToNextTask,
    resetRoom,
    removePlayer,
    leaveRoom,
    closeRoom,
    setDeckType,
    copyInvite,
    formatScore,
  };
}
