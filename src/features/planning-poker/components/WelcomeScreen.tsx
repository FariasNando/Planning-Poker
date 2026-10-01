import { type FormEvent, useState } from "react";
import Link from "next/link";

type WelcomeScreenProps = {
  name: string;
  setName: (name: string) => void;
  roomTitle: string;
  setRoomTitle: (title: string) => void;
  error: string;
  isConfigured: boolean;
  isLoading: boolean;
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
  onJoinRoom: (code: string) => void;
};

export function WelcomeScreen({ name, setName, roomTitle, setRoomTitle, error, isConfigured, isLoading, onCreateRoom, onJoinRoom }: WelcomeScreenProps) {
  const [joinCode, setJoinCode] = useState("");

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoinRoom(joinCode);
  }

  return (
    <main className="welcome-screen">
      <header className="topbar">
        <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
        <span className="local-tag">ONLINE · FREE</span>
      </header>
      <section className="welcome-content">
        <div className="welcome-copy">
          <p className="eyebrow">TEAM ESTIMATION</p>
          <h1>Great estimates<br />start with <em>a conversation.</em></h1>
          <p className="intro">Create a room and share the link. Your team can vote together in real time, from anywhere.</p>
          <form className="create-form" onSubmit={onCreateRoom}>
            <label htmlFor="creator-name">Your name</label>
            <input
              id="creator-name"
              className="standalone-input"
              autoFocus
              maxLength={28}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What should we call you?"
            />
            <label htmlFor="room-name" className="form-label-spaced">Room name</label>
            <div className="input-row">
              <input
                id="room-name"
                maxLength={48}
                value={roomTitle}
                onChange={(event) => setRoomTitle(event.target.value)}
                placeholder="What are you estimating?"
              />
              <button className="primary-button" type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : <>Create room <span aria-hidden="true">↗</span></>}
              </button>
            </div>
          </form>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <p className="local-note"><span /> Free · up to 10 players · live updates</p>
          {!isConfigured && <p className="setup-hint">Before creating a room, connect a free Supabase project. See setup steps in the README.</p>}
          <div className="join-divider"><span>or join an existing room</span></div>
          <form className="join-code-form" onSubmit={handleJoin}>
            <label htmlFor="join-code">Room code</label>
            <div className="input-row">
              <input
                id="join-code"
                className="join-code-input"
                maxLength={6}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="e.g. A3KZ9F"
                spellCheck={false}
                autoComplete="off"
              />
              <button className="secondary-button" type="submit" disabled={isLoading || !joinCode.trim()}>
                Join <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-card hero-card-back">13</div>
          <div className="hero-card hero-card-mid">5</div>
          <div className="hero-card hero-card-front"><span>ESTIMATE</span>8<i>✳</i></div>
          <div className="art-caption"><b>One round at a time.</b><span>No pressure. Find consensus.</span></div>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>PLANNING POKER</span>
        <span className="welcome-credit">
          Built by <a href="mailto:luis.f.oliveira@accenture.com">Luís Fernando Farias Oliveira</a>
        </span>
        <span>01 / 01</span>
      </footer>
    </main>
  );
}
