"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type Player = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  votes: Record<string, number>;
  voteLabels: Record<string, string>;
  voteCount: number;
  finalScore: number | null;
};
type Room = {
  id: string;
  adminId: string;
  players: Player[];
  tasks: Task[];
  activeTaskId: string | null;
  revealed: boolean;
};

const DECK = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const ADMIN_TOKEN_PREFIX = "planning-poker-admin-";
const PLAYER_ID_PREFIX = "planning-poker-player-";
const PLAYER_TOKEN_PREFIX = "planning-poker-player-token-";

function makeId() {
  return crypto.randomUUID();
}

function getStoredIdentity(key: string) {
  const persistentValue = window.localStorage.getItem(key);
  if (persistentValue) return persistentValue;
  const legacyValue = window.sessionStorage.getItem(key);
  if (legacyValue) {
    window.localStorage.setItem(key, legacyValue);
    window.sessionStorage.removeItem(key);
  }
  return legacyValue;
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function toRoom(value: unknown): Room {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    adminId: String(row.adminId ?? row.admin_id),
    players: (row.players ?? []) as Player[],
    tasks: ((row.tasks ?? []) as Record<string, unknown>[]).map((task) => ({
      id: String(task.id),
      title: String(task.title),
      votes: (task.votes ?? {}) as Record<string, number>,
      voteLabels: (task.voteLabels ?? {}) as Record<string, string>,
      voteCount: Number(task.voteCount ?? 0),
      finalScore: task.finalScore === null || task.finalScore === undefined ? null : Number(task.finalScore),
    })),
    activeTaskId: (row.activeTaskId ?? row.active_task_id ?? null) as string | null,
    revealed: Boolean(row.revealed),
  };
}

function OnlinePoker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room")?.toUpperCase() ?? "";
  const [name, setName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [removedFromRoom, setRemovedFromRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [myVote, setMyVote] = useState<{ taskId: string; score: number } | null>(null);
  const supabase = getSupabaseClient();
  const currentRoom = room?.id === roomId ? room : null;
  const currentPlayerId = playerId && currentRoom?.players.some((player) => player.id === playerId) ? playerId : "";
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
      const loadedRoom = toRoom(data);
      setRoom(loadedRoom);
      const savedPlayerId = getStoredIdentity(`${PLAYER_ID_PREFIX}${roomId}`) ?? "";
      const savedPlayerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
      const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
      if (!adminToken && savedPlayerId && savedPlayerToken && !loadedRoom.players.some((player) => player.id === savedPlayerId)) {
        window.localStorage.removeItem(`${PLAYER_ID_PREFIX}${roomId}`);
        window.localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
        setPlayerId("");
        setRemovedFromRoom(true);
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
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          void refreshRoom().then((loadedRoom) => {
            if (cancelled) return;
            if (!loadedRoom) return;
            const adminToken = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
            if (adminToken) {
              window.localStorage.setItem(`${ADMIN_TOKEN_PREFIX}${roomId}`, adminToken);
              window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, adminToken);
              setPlayerId(loadedRoom.adminId);
            } else {
              const savedPlayerId = getStoredIdentity(`${PLAYER_ID_PREFIX}${roomId}`) ?? "";
              const savedPlayerToken = getStoredIdentity(`${PLAYER_TOKEN_PREFIX}${roomId}`);
              if (savedPlayerToken && loadedRoom.players.some((player) => player.id === savedPlayerId)) {
                setPlayerId(savedPlayerId);
                setRemovedFromRoom(false);
              } else if (savedPlayerToken && savedPlayerId) {
                window.localStorage.removeItem(`${PLAYER_ID_PREFIX}${roomId}`);
                window.localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
                setPlayerId("");
                setRemovedFromRoom(true);
              } else {
                setPlayerId("");
              }
            }
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

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
    const updatedRoom = toRoom(data);
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
    const adminId = makeId();
    const adminToken = makeId();
    const roomCode = makeRoomCode();
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
    router.push(`/?room=${roomCode}`);
    setName("");
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRoom || !name.trim()) return;
    const newPlayerId = makeId();
    const playerToken = makeId();
    const joined = await callRoomRpc("join_planning_poker_room", {
      p_room_id: roomId,
      p_player_id: newPlayerId,
      p_player_name: name.trim(),
      p_player_token: playerToken,
    });
    if (!joined) return;
    window.localStorage.setItem(`${PLAYER_ID_PREFIX}${roomId}`, newPlayerId);
    window.localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, playerToken);
    setPlayerId(newPlayerId);
    setRemovedFromRoom(false);
    setName("");
  }

  async function removePlayer(targetPlayer: Player) {
    if (!isAdmin || targetPlayer.id === currentRoom?.adminId) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    if (!window.confirm(`Remove ${targetPlayer.name} from this room? Their votes will also be deleted.`)) return;
    await callRoomRpc("remove_planning_poker_player", {
      p_room_id: roomId,
      p_admin_token: token,
      p_player_id: targetPlayer.id,
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
      p_task_id: makeId(),
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

  async function toggleReveal() {
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token || !currentRoom) return setError("Admin session not found in this browser.");
    await callRoomRpc("reveal_planning_poker_votes", {
      p_room_id: roomId,
      p_admin_token: token,
      p_revealed: true,
    });
  }

  async function resetRoom() {
    if (!currentRoom || !isAdmin) return;
    const token = getStoredIdentity(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Admin session not found in this browser.");
    if (!window.confirm("Reset this room? All tasks and votes will be permanently deleted.")) return;
    await callRoomRpc("reset_planning_poker_room", {
      p_room_id: roomId,
      p_admin_token: token,
    });
    setMyVote(null);
    setTaskTitle("");
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

  if (!roomId) {
    const missingConfig = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return (
      <main className="welcome-screen">
        <header className="topbar"><Link className="wordmark" href="/">Planning<span>Poker</span></Link><span className="local-tag">ONLINE · FREE</span></header>
        <section className="welcome-content">
          <div className="welcome-copy">
            <p className="eyebrow">TEAM ESTIMATION</p>
            <h1>Great estimates<br />start with <em>a conversation.</em></h1>
            <p className="intro">Create a room and share the link. Your team can vote together in real time, from anywhere.</p>
            <form className="create-form" onSubmit={createRoom}>
              <label htmlFor="creator-name">Your name</label>
              <div className="input-row"><input id="creator-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" /><button className="primary-button" type="submit">Create room <span aria-hidden="true">↗</span></button></div>
            </form>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <p className="local-note"><span /> Free · up to 10 players · live updates</p>
            {missingConfig && <p className="setup-hint">Before creating a room, connect a free Supabase project. See setup steps in the README.</p>}
          </div>
          <div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-card hero-card-back">13</div><div className="hero-card hero-card-mid">5</div><div className="hero-card hero-card-front"><span>ESTIMATE</span>8<i>✳</i></div><div className="art-caption"><b>One round at a time.</b><span>No pressure. Find consensus.</span></div></div>
        </section>
        <footer className="welcome-footer"><span>PLANNING POKER</span><span>01 / 01</span></footer>
      </main>
    );
  }

  if (!supabase) return <main className="loading-screen">Configure Supabase in the environment file to connect to this room.</main>;

  if (!currentRoom) {
    return <main className="loading-screen">{error || (connectionStatus === "connected" ? "Loading room..." : "Connecting to room...")}</main>;
  }

  const currentPlayer = currentRoom.players.find((player) => player.id === currentPlayerId);

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
        <div className="room-meta"><span className={`live-dot ${connectionStatus !== "connected" ? "offline-dot" : ""}`} />{connectionStatus === "connected" ? "Connected" : "Reconnecting"}<span className="local-tag">ROOM {roomId}</span></div>
        <div className="header-actions">
          {isAdmin && <button className="reset-button" onClick={() => void resetRoom()} title="Reset room" aria-label="Reset room">Reset room</button>}
          <button className="share-button" onClick={copyInvite} aria-label="Copy invite link" title="Copy invite link"><span aria-hidden="true">↗</span><span className="share-label">Share</span></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading"><span className="eyebrow">PLAYERS</span><span className="room-count">{currentRoom.players.length.toString().padStart(2, "0")} / 10</span></div>
          <div className="people-list">
            {currentRoom.players.map((player, index) => (
              <div key={player.id} className={`person-row ${player.id === currentPlayerId ? "selected-person" : ""}`}>
                <span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span><span className="person-name">{player.name}{player.id === currentRoom.adminId && <small>ADMIN</small>}</span>
                {activeTask && <span className={`vote-status ${activeTask.votes[player.id] !== undefined ? "voted" : ""}`}>{currentRoom.revealed ? (activeTask.voteLabels[player.id] ?? "·") : "·"}</span>}
                {isAdmin && player.id !== currentRoom.adminId && <button className="remove-player-button" type="button" onClick={() => void removePlayer(player)} aria-label={`Remove ${player.name}`} title={`Remove ${player.name}`}>×</button>}
              </div>
            ))}
          </div>
          {!currentPlayer && !removedFromRoom && <form className="join-form" onSubmit={joinRoom}><label htmlFor="join-name">Join this room</label><input id="join-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /><button className="primary-button" type="submit">Join room <span aria-hidden="true">↗</span></button></form>}
          <div className="sidebar-rule" />
          <div className="sidebar-heading tasks-heading"><span className="eyebrow">TASKS</span><span className="room-count">{currentRoom.tasks.length.toString().padStart(2, "0")}</span></div>
          <nav className="task-list" aria-label="Tasks">
            {currentRoom.tasks.map((task, index) => <button key={task.id} className={`task-row ${task.id === currentRoom.activeTaskId ? "active-task" : ""} ${task.finalScore !== null ? "finalized-task" : ""}`} onClick={() => isAdmin && task.finalScore === null && void selectTask(task.id)} disabled={!isAdmin || task.finalScore !== null}><span className="task-number">{String(index + 1).padStart(2, "0")}</span><span className="task-name">{task.title}</span>{task.finalScore !== null ? <span className="task-score-badge" aria-label={`Final average ${formatScore(task.finalScore)}`}>{formatScore(task.finalScore)}</span> : task.voteCount > 0 && <span className="task-complete">•</span>}</button>)}
            {currentRoom.tasks.length === 0 && <p className="empty-tasks">Your tasks will appear here.</p>}
          </nav>
          {isAdmin && <form className="add-task" onSubmit={addTask}><input aria-label="Task title" maxLength={80} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="New task name" /><button type="submit" aria-label="Add task">+</button></form>}
          <div className="sidebar-bottom"><span>PLANNING POKER</span><span>FREE</span></div>
        </aside>

        <section className="game-area">
          <div className="game-topline"><span className="eyebrow">ESTIMATION ROUND</span><span className="round-count">{currentRoom.tasks.length ? `${String(Math.min(completedTaskCount + (activeTask ? 1 : 0), currentRoom.tasks.length)).padStart(2, "0")} / ${String(currentRoom.tasks.length).padStart(2, "0")}` : "00 / 00"}</span></div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {notice && <p className="copy-notice" role="status">{notice}</p>}
          {removedFromRoom ? <div className="empty-state"><div className="empty-mark">×</div><span className="eyebrow">ROOM ACCESS REMOVED</span><h1>You were removed from this room.</h1><p>The room admin removed your access. You can close this page.</p></div> : !currentPlayer ? <div className="empty-state"><div className="empty-mark">✳</div><span className="eyebrow">ROOM INVITATION</span><h1>Join your team to estimate.</h1><p>Choose a name in the sidebar. This room supports up to 10 players.</p></div> : allTasksCompleted ? <div className="empty-state"><div className="empty-mark">✳</div><span className="eyebrow">ALL TASKS ESTIMATED</span><h1>Every score is locked in.</h1><p>Final averages are shown beside each task. Add another task to start a new round.</p></div> : activeTask ? <>
            <div className="task-prompt"><span className="task-kicker">CURRENT TASK</span><h1>{activeTask.title}</h1><p>{isAdmin ? "Cards stay hidden until you reveal the votes." : "Choose your estimate. The admin will reveal the votes."}</p></div>
            <div className="vote-panel">
              <div className="vote-label"><span>YOUR ESTIMATE</span><span>VOTING AS <b>{currentPlayer.name}</b></span></div>
              <div className="card-deck" role="group" aria-label="Choose your estimate">{DECK.map((score) => <button key={score} className={`score-card ${myVote?.taskId === activeTask.id && myVote.score === score ? "chosen-card" : ""}`} onClick={() => void castVote(score)} aria-pressed={myVote?.taskId === activeTask.id && myVote.score === score}>{formatScore(score)}</button>)}</div>
              <div className="vote-footer"><span>{voteCount} of {currentRoom.players.length} votes cast</span>{isAdmin && <button className="reveal-button" onClick={() => void toggleReveal()} disabled={voteCount === 0}>Finalize task<span aria-hidden="true">↗</span></button>}</div>
            </div>
            <div className="results-strip"><div className="results-heading"><span className="eyebrow">ROUND STATUS</span></div><div className="results-content"><p>Votes stay hidden until the admin finalizes this task.</p></div></div>
          </> : <div className="empty-state"><div className="empty-mark">✳</div><span className="eyebrow">ROOM READY</span><h1>{isAdmin ? "What's the first task?" : "Waiting for the first task"}</h1><p>{isAdmin ? "Add a task from the sidebar to start the round." : "The admin will add a task for the team to estimate."}</p></div>}
          <div className="device-note">Live online room · free for up to 10 players</div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<main className="loading-screen">Loading Planning Poker...</main>}><OnlinePoker /></Suspense>;
}
