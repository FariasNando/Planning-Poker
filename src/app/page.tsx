"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type Player = { id: string; name: string };
type Task = { id: string; title: string; votes: Record<string, number>; voteCount: number };
type Room = {
  id: string;
  adminId: string;
  players: Player[];
  tasks: Task[];
  activeTaskId: string | null;
  revealed: boolean;
};

const DECK = [0, 1, 2, 3, 5, 8, 13, 20, 40, 100];
const ADMIN_TOKEN_PREFIX = "planning-poker-admin-";
const PLAYER_ID_PREFIX = "planning-poker-player-";
const PLAYER_TOKEN_PREFIX = "planning-poker-player-token-";

function makeId() {
  return crypto.randomUUID();
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function toRoom(value: unknown): Room {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    adminId: String(row.adminId ?? row.admin_id),
    players: (row.players ?? []) as Player[],
    tasks: (row.tasks ?? []) as Task[],
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
  const average = useMemo(() => {
    if (!activeTask || voteCount === 0) return null;
    return Object.values(activeTask.votes).reduce((sum, score) => sum + score, 0) / voteCount;
  }, [activeTask, voteCount]);

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
            const adminToken = window.sessionStorage.getItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
            if (adminToken) {
              window.sessionStorage.setItem(`${ADMIN_TOKEN_PREFIX}${roomId}`, adminToken);
              window.sessionStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, adminToken);
              setPlayerId(loadedRoom.adminId);
            } else {
              const savedPlayerId = window.sessionStorage.getItem(`${PLAYER_ID_PREFIX}${roomId}`) ?? "";
              const savedPlayerToken = window.sessionStorage.getItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
              setPlayerId(savedPlayerToken && loadedRoom.players.some((player) => player.id === savedPlayerId) ? savedPlayerId : "");
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
      setError("Configure o Supabase gratuito para habilitar salas online.");
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
      setError("Para criar salas online, configure as duas variáveis NEXT_PUBLIC_SUPABASE no projeto.");
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
    window.sessionStorage.setItem(`${ADMIN_TOKEN_PREFIX}${roomCode}`, adminToken);
    window.sessionStorage.setItem(`${PLAYER_ID_PREFIX}${roomCode}`, adminId);
    window.sessionStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomCode}`, adminToken);
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
    window.sessionStorage.setItem(`${PLAYER_ID_PREFIX}${roomId}`, newPlayerId);
    window.sessionStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomId}`, playerToken);
    setPlayerId(newPlayerId);
    setName("");
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRoom || !taskTitle.trim()) return;
    const token = window.sessionStorage.getItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Sessão de administrador não encontrada neste navegador.");
    const updated = await callRoomRpc("add_planning_poker_task", {
      p_room_id: roomId,
      p_admin_token: token,
      p_task_id: makeId(),
      p_title: taskTitle.trim(),
    });
    if (updated) setTaskTitle("");
  }

  async function selectTask(taskId: string) {
    const token = window.sessionStorage.getItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token) return setError("Sessão de administrador não encontrada neste navegador.");
    await callRoomRpc("select_planning_poker_task", { p_room_id: roomId, p_admin_token: token, p_task_id: taskId });
  }

  async function castVote(score: number) {
    if (!currentRoom || !activeTask || !currentPlayerId) return;
    const playerToken = window.sessionStorage.getItem(`${PLAYER_TOKEN_PREFIX}${roomId}`);
    if (!playerToken) return setError("Sessão de participante não encontrada neste navegador.");
    const updated = await callRoomRpc("vote_planning_poker", {
      p_room_id: roomId,
      p_player_id: currentPlayerId,
      p_player_token: playerToken,
      p_task_id: activeTask.id,
      p_score: score,
    });
    if (updated) setMyVote({ taskId: activeTask.id, score });
  }

  async function toggleReveal() {
    const token = window.sessionStorage.getItem(`${ADMIN_TOKEN_PREFIX}${roomId}`);
    if (!token || !currentRoom) return setError("Sessão de administrador não encontrada neste navegador.");
    await callRoomRpc("reveal_planning_poker_votes", {
      p_room_id: roomId,
      p_admin_token: token,
      p_revealed: !currentRoom.revealed,
    });
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Link copiado");
      window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setError("Não foi possível copiar o link neste navegador.");
    }
  }

  if (!roomId) {
    const missingConfig = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return (
      <main className="welcome-screen">
        <header className="topbar"><Link className="wordmark" href="/">Planning<span>Poker</span></Link><span className="local-tag">ONLINE · GRATUITO</span></header>
        <section className="welcome-content">
          <div className="welcome-copy">
            <p className="eyebrow">ESTIMATIVAS EM EQUIPE</p>
            <h1>Boas estimativas<br />começam com <em>conversa.</em></h1>
            <p className="intro">Crie uma sala e compartilhe o link. O time vota em tempo real, de qualquer lugar.</p>
            <form className="create-form" onSubmit={createRoom}>
              <label htmlFor="creator-name">Seu nome</label>
              <div className="input-row"><input id="creator-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos te chamar?" /><button className="primary-button" type="submit">Criar sala <span aria-hidden="true">↗</span></button></div>
            </form>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <p className="local-note"><span /> Gratuito · até 10 participantes · atualizações ao vivo</p>
            {missingConfig && <p className="setup-hint">Antes de criar: conecte um projeto gratuito do Supabase. Veja os passos no README.</p>}
          </div>
          <div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-card hero-card-back">13</div><div className="hero-card hero-card-mid">5</div><div className="hero-card hero-card-front"><span>ESTIMATIVA</span>8<i>✳</i></div><div className="art-caption"><b>Uma rodada por vez.</b><span>Sem pressão. Com consenso.</span></div></div>
        </section>
        <footer className="welcome-footer"><span>PLANNING POKER</span><span>01 / 01</span></footer>
      </main>
    );
  }

  if (!supabase) return <main className="loading-screen">Configure o Supabase no arquivo de ambiente para conectar a sala.</main>;

  if (!currentRoom) {
    return <main className="loading-screen">{error || (connectionStatus === "connected" ? "Carregando sala..." : "Conectando à sala...")}</main>;
  }

  const currentPlayer = currentRoom.players.find((player) => player.id === currentPlayerId);

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
        <div className="room-meta"><span className={`live-dot ${connectionStatus !== "connected" ? "offline-dot" : ""}`} />{connectionStatus === "connected" ? "Conectado" : "Reconectando"}<span className="local-tag">SALA {roomId}</span></div>
        <button className="share-button" onClick={copyInvite} aria-label="Copiar link de convite" title="Copiar link de convite"><span aria-hidden="true">↗</span><span className="share-label">Compartilhar</span></button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading"><span className="eyebrow">PARTICIPANTES</span><span className="room-count">{currentRoom.players.length.toString().padStart(2, "0")} / 10</span></div>
          <div className="people-list">
            {currentRoom.players.map((player, index) => (
              <div key={player.id} className={`person-row ${player.id === currentPlayerId ? "selected-person" : ""}`}>
                <span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span><span className="person-name">{player.name}{player.id === currentRoom.adminId && <small>ADMIN</small>}</span>
                {activeTask && <span className={`vote-status ${activeTask.votes[player.id] !== undefined ? "voted" : ""}`}>{currentRoom.revealed ? (activeTask.votes[player.id] ?? "·") : "·"}</span>}
              </div>
            ))}
          </div>
          {!currentPlayer && <form className="join-form" onSubmit={joinRoom}><label htmlFor="join-name">Entre na sala</label><input id="join-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" /><button className="primary-button" type="submit">Participar <span aria-hidden="true">↗</span></button></form>}
          <div className="sidebar-rule" />
          <div className="sidebar-heading tasks-heading"><span className="eyebrow">TAREFAS</span><span className="room-count">{currentRoom.tasks.length.toString().padStart(2, "0")}</span></div>
          <nav className="task-list" aria-label="Tarefas">
            {currentRoom.tasks.map((task, index) => <button key={task.id} className={`task-row ${task.id === currentRoom.activeTaskId ? "active-task" : ""}`} onClick={() => isAdmin && void selectTask(task.id)} disabled={!isAdmin}><span className="task-number">{String(index + 1).padStart(2, "0")}</span><span className="task-name">{task.title}</span>{task.voteCount > 0 && <span className="task-complete">•</span>}</button>)}
            {currentRoom.tasks.length === 0 && <p className="empty-tasks">As tarefas aparecerão aqui.</p>}
          </nav>
          {isAdmin && <form className="add-task" onSubmit={addTask}><input aria-label="Título da tarefa" maxLength={80} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Nome da nova tarefa" /><button type="submit" aria-label="Adicionar tarefa">+</button></form>}
          <div className="sidebar-bottom"><span>PLANNING POKER</span><span>GRATUITO</span></div>
        </aside>

        <section className="game-area">
          <div className="game-topline"><span className="eyebrow">RODADA DE ESTIMATIVA</span><span className="round-count">{currentRoom.tasks.length ? `${String(currentRoom.tasks.findIndex((task) => task.id === currentRoom.activeTaskId) + 1).padStart(2, "0")} / ${String(currentRoom.tasks.length).padStart(2, "0")}` : "00 / 00"}</span></div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {notice && <p className="copy-notice" role="status">{notice}</p>}
          {!currentPlayer ? <div className="empty-state"><div className="empty-mark">✳</div><span className="eyebrow">CONVITE PARA A SALA</span><h1>Entre para estimar junto.</h1><p>Escolha um nome na lateral. Esta sala aceita até 10 participantes.</p></div> : activeTask ? <>
            <div className="task-prompt"><span className="task-kicker">TAREFA ATUAL</span><h1>{activeTask.title}</h1><p>{isAdmin ? "As cartas ficam ocultas até você revelar a votação." : "Escolha sua estimativa. Os votos são revelados pelo administrador."}</p></div>
            <div className="vote-panel">
              <div className="vote-label"><span>SUA ESTIMATIVA</span><span>VOTANDO COMO <b>{currentPlayer.name}</b></span></div>
              <div className="card-deck" role="group" aria-label="Escolha sua estimativa">{DECK.map((score) => <button key={score} className={`score-card ${myVote?.taskId === activeTask.id && myVote.score === score ? "chosen-card" : ""}`} onClick={() => void castVote(score)} aria-pressed={myVote?.taskId === activeTask.id && myVote.score === score}>{score}</button>)}</div>
              <div className="vote-footer"><span>{voteCount} de {currentRoom.players.length} votos registrados</span>{isAdmin && <button className="reveal-button" onClick={() => void toggleReveal()}>{currentRoom.revealed ? "Ocultar votos" : "Revelar votação"}<span aria-hidden="true">↗</span></button>}</div>
            </div>
            <div className={`results-strip ${currentRoom.revealed ? "results-visible" : ""}`}><div className="results-heading"><span className="eyebrow">RESULTADO DA RODADA</span>{currentRoom.revealed && <span className="result-state">VOTAÇÃO REVELADA</span>}</div><div className="results-content">{currentRoom.revealed ? <><div className="average-value">{average === null ? "—" : Number.isInteger(average) ? average : average.toFixed(1)}</div><div><b>Média do time</b><span>{voteCount} voto{voteCount === 1 ? "" : "s"} contabilizado{voteCount === 1 ? "" : "s"}</span></div><div className="revealed-votes">{currentRoom.players.map((player) => <span key={player.id} title={player.name}>{player.name.slice(0, 1)} <b>{activeTask.votes[player.id] ?? "—"}</b></span>)}</div></> : <p>As estimativas aparecem aqui quando o administrador revelar a votação.</p>}</div></div>
          </> : <div className="empty-state"><div className="empty-mark">✳</div><span className="eyebrow">SALA PRONTA</span><h1>{isAdmin ? "Qual é a primeira tarefa?" : "Aguardando a primeira tarefa"}</h1><p>{isAdmin ? "Adicione uma tarefa pela coluna à esquerda para começar a rodada." : "O administrador vai adicionar a tarefa que o time vai estimar."}</p></div>}
          <div className="device-note">Sala online em tempo real · gratuita para até 10 participantes</div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<main className="loading-screen">Carregando Planning Poker...</main>}><OnlinePoker /></Suspense>;
}
