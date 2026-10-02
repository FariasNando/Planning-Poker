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
    <main className="min-h-screen overflow-hidden px-[7.2vw] [background-color:var(--paper)] [background-image:radial-gradient(#1e3a5f_0.65px,transparent_0.65px)] [background-size:18px_18px] max-[900px]:px-[5vw] max-sm:px-[20px]">
      <header className="h-[82px] flex items-center justify-between border-b border-slate-700 max-sm:h-[62px]">
        <Link className="text-slate-100 no-underline font-extrabold text-[17px] tracking-[0]" href="/">
          Planning<span className="text-sky-500">Poker</span>
        </Link>
        <span className="px-[9px] py-[6px] border border-sky-500/30 text-sky-500 text-[11px] font-extrabold tracking-[1.2px]">ONLINE · FREE</span>
      </header>
      <section className="min-h-[calc(100vh-140px)] grid [grid-template-columns:1.05fr_.95fr] items-center max-w-[1260px] mx-auto max-[900px]:[grid-template-columns:1fr_0.82fr] max-sm:min-h-auto max-sm:flex max-sm:flex-col max-sm:items-stretch">
        <div className="relative z-[1] pt-[54px] pb-[68px] [animation:reveal-up_.65s_ease-out_both] max-sm:pb-[29px]">
          <p className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">TEAM ESTIMATION</p>
          <h1 className="mt-[22px] mb-4 font-medium text-[clamp(42px,5vw,66px)] leading-[1.04] [font-family:var(--serif)] tracking-[0] max-sm:text-[45px]">Great estimates<br />start with <em className="text-sky-500">a conversation.</em></h1>
          <p className="max-w-[420px] text-[#94a3b8] text-[15px] leading-[1.7] max-sm:max-w-[350px] max-sm:text-[13px]">Create a room and share the link. Your team can vote together in real time, from anywhere.</p>
          <form className="max-w-[500px] mt-[38px] max-sm:mt-[28px]" onSubmit={onCreateRoom}>
            <label className="block mb-[9px] text-[12px] font-bold" htmlFor="creator-name">Your name</label>
            <input
              id="creator-name"
              className="w-full h-[48px] border border-slate-700 bg-slate-800 px-[14px] text-slate-100 text-[13px] placeholder:text-[#475569]"
              autoFocus
              maxLength={28}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What should we call you?"
            />
            <label className="block mt-[14px] mb-[9px] text-[12px] font-bold" htmlFor="room-name">Room name</label>
            <div className="flex gap-2 max-sm:flex-col">
              <input
                id="room-name"
                className="min-w-0 flex-1 h-[48px] border border-slate-700 bg-slate-800 px-[14px] text-slate-100 text-[13px] placeholder:text-[#475569] max-sm:w-full"
                maxLength={48}
                value={roomTitle}
                onChange={(event) => setRoomTitle(event.target.value)}
                placeholder="What are you estimating?"
              />
              <button className="h-[48px] px-[19px] border-0 bg-sky-500 text-white font-bold cursor-pointer transition-[background,transform] duration-[180ms] hover:bg-sky-600 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed max-sm:w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : <>Create room <span className="ml-[15px]" aria-hidden="true">↗</span></>}
              </button>
            </div>
          </form>
          {error && <p className="text-red-400 text-[13px] leading-[1.5]" role="alert">{error}</p>}
          {!isConfigured && <p className="max-w-[420px] mt-3 text-[#94a3b8] text-[13px] leading-[1.6]">Before creating a room, connect a free Supabase project. See setup steps in the README.</p>}
          <div className="relative flex items-center gap-3 max-w-[500px] mt-[26px] mb-5 text-[#475569] text-[12px] before:content-[''] before:flex-1 before:h-px before:bg-slate-700 after:content-[''] after:flex-1 after:h-px after:bg-slate-700"><span>or join an existing room</span></div>
          <form className="max-w-[500px]" onSubmit={handleJoin}>
            <label className="block mb-[9px] text-[12px] font-bold" htmlFor="join-code">Room code</label>
            <div className="flex gap-2 max-sm:flex-col">
              <input
                id="join-code"
                className="min-w-0 flex-1 h-[48px] border border-slate-700 bg-slate-800 px-[14px] text-slate-100 text-[13px] uppercase tracking-[3px] font-bold placeholder:text-[#475569] placeholder:tracking-normal placeholder:font-normal max-sm:w-full"
                maxLength={6}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="e.g. A3KZ9F"
                spellCheck={false}
                autoComplete="off"
              />
              <button className="h-[48px] px-[19px] border border-slate-700 bg-slate-800 text-slate-100 font-bold cursor-pointer transition-[background] duration-[180ms] hover:bg-[#263548] disabled:text-[#475569] disabled:cursor-not-allowed max-sm:w-full" type="submit" disabled={isLoading || !joinCode.trim()}>
                Join <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </div>
        <div className="relative h-[500px] overflow-hidden bg-slate-800 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:36px_36px] [animation:reveal-up_.7s_.12s_ease-out_both] max-[900px]:h-[410px] max-sm:h-[270px] max-sm:-mx-5" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg">
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
          <div className="absolute right-5 bottom-[22px] flex flex-col gap-[5px] text-right text-[13px]">
            <b>One round at a time.</b><span className="text-[#64748b] text-[12px]">No pressure. Find consensus.</span>
          </div>
        </div>
      </section>
      <footer className="flex justify-between items-center py-[18px] border-t border-slate-700 text-[#64748b] text-[11px] font-bold tracking-[1.2px] max-sm:-mx-5 max-sm:px-5 max-sm:py-4">
        <span>PLANNING POKER</span>
        <span className="text-[11px] font-normal tracking-[0] text-[#475569]">
          Built by <a className="text-sky-500 no-underline hover:underline" href="mailto:lu.is.fernando@hotmail.com">Luís Fernando Farias Oliveira</a>
        </span>
        <span>1.13.0</span>
      </footer>
    </main>
  );
}
