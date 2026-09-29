import type { FormEvent } from "react";
import Link from "next/link";

type WelcomeScreenProps = {
  name: string;
  setName: (name: string) => void;
  error: string;
  isConfigured: boolean;
  isLoading: boolean;
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
};

export function WelcomeScreen({ name, setName, error, isConfigured, isLoading, onCreateRoom }: WelcomeScreenProps) {
  return (
    <main className="welcome-screen">
      <header className="topbar">
        <Link className="wordmark" href="/">Planning<span>Poker</span></Link>
        <img src="/accenture-logo.png" alt="Accenture" className="accenture-logo" />
        <span className="local-tag">ONLINE · FREE</span>
      </header>
      <section className="welcome-content">
        <div className="welcome-copy">
          <p className="eyebrow">TEAM ESTIMATION</p>
          <h1>Great estimates<br />start with <em>a conversation.</em></h1>
          <p className="intro">Create a room and share the link. Your team can vote together in real time, from anywhere.</p>
          <form className="create-form" onSubmit={onCreateRoom}>
            <label htmlFor="creator-name">Your name</label>
            <div className="input-row">
              <input id="creator-name" autoFocus maxLength={28} value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" />
              <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Creating..." : <>Create room <span aria-hidden="true">↗</span></>}</button>
            </div>
          </form>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <p className="local-note"><span /> Free · up to 10 players · live updates</p>
          {!isConfigured && <p className="setup-hint">Before creating a room, connect a free Supabase project. See setup steps in the README.</p>}
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