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
          <svg className="fib-art" viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">
            <path d="M260,200 m-130,0 a130,130 0 0,1 130,-130" fill="none" stroke="rgba(14,165,233,.10)" strokeWidth="80"/>
            <path d="M260,200 m0,-130 a80,80 0 0,1 80,80" fill="none" stroke="rgba(14,165,233,.09)" strokeWidth="54"/>
            <path d="M260,200 m80,-50 a50,50 0 0,1 -50,50" fill="none" stroke="rgba(14,165,233,.09)" strokeWidth="36"/>
            <path d="M260,200 m30,-0 a30,30 0 0,1 -30,30" fill="none" stroke="rgba(14,165,233,.10)" strokeWidth="22"/>
            <path d="M260,200 m0,18 a18,18 0 0,1 -18,-18" fill="none" stroke="rgba(14,165,233,.12)" strokeWidth="14"/>
            <path d="M260,200 m-130,0 a130,130 0 0,1 130,-130 a80,80 0 0,1 80,80 a50,50 0 0,1 -50,50 a30,30 0 0,1 -30,30 a18,18 0 0,1 -18,-18" fill="none" stroke="#0ea5e9" strokeWidth="1.5" opacity="0.5"/>
            <text x="88"  y="210" fill="#0ea5e9" fontSize="34" fontFamily="Georgia, serif" fontWeight="700" opacity="0.35">1</text>
            <text x="118" y="168" fill="#0ea5e9" fontSize="44" fontFamily="Georgia, serif" fontWeight="700" opacity="0.45">2</text>
            <text x="158" y="156" fill="#0ea5e9" fontSize="56" fontFamily="Georgia, serif" fontWeight="700" opacity="0.55">3</text>
            <text x="208" y="148" fill="#0ea5e9" fontSize="72" fontFamily="Georgia, serif" fontWeight="700" opacity="0.70">5</text>
            <text x="296" y="172" fill="#0ea5e9" fontSize="56" fontFamily="Georgia, serif" fontWeight="700" opacity="0.60">8</text>
            <text x="354" y="206" fill="#0ea5e9" fontSize="44" fontFamily="Georgia, serif" fontWeight="700" opacity="0.45">13</text>
            <text x="404" y="234" fill="#0ea5e9" fontSize="34" fontFamily="Georgia, serif" fontWeight="700" opacity="0.30">21</text>
            <text x="260" y="340" fill="#334155" fontSize="9" fontFamily="Trebuchet MS, sans-serif" letterSpacing="3" textAnchor="middle">FIBONACCI ESTIMATION SCALE</text>
          </svg>
          <div className="art-caption"><b>One round at a time.</b><span>No pressure. Find consensus.</span></div>
        </div>
      </section>
      <footer className="welcome-footer">
        <span>PLANNING POKER</span>
        <span className="welcome-credit">
          Built by <a href="mailto:lu.is.fernando@hotmail.com">Luís Fernando Farias Oliveira</a>
        </span>
        <span>01 / 01</span>
      </footer>
    </main>
  );
}
