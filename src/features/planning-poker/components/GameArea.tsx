import { DECKS, type DeckType, type Player, type Room, type Task } from "../model";
import { formatScore } from "../utils";

type GameAreaProps = {
  room: Room;
  currentPlayer?: Player;
  isAdmin: boolean;
  activeTask: Task | null;
  voteCount: number;
  completedTaskCount: number;
  allTasksCompleted: boolean;
  removedFromRoom: boolean;
  error: string;
  notice: string;
  myVote: { taskId: string; score: number } | null;
  isLoading: boolean;
  onVote: (score: number) => void;
  onFinalize: () => void;
  onAdvance: () => void;
  onSetDeckType: (type: DeckType) => void;
};

export function GameArea(props: GameAreaProps) {
  const { room, currentPlayer, isAdmin, activeTask, voteCount, completedTaskCount, allTasksCompleted, removedFromRoom, error, notice, myVote, isLoading, onVote, onFinalize, onAdvance, onSetDeckType } = props;
  const showResults = activeTask !== null && activeTask.finalScore !== null;
  const roundNumber = Math.min(completedTaskCount + (activeTask && !showResults ? 1 : 0), room.tasks.length);

  return (
    <section className="w-[min(100%,1060px)] mx-auto px-[6.5vw] pt-[29px] pb-[72px] max-[900px]:px-[4vw] max-sm:w-full max-sm:px-[15px] max-sm:pt-5 max-sm:pb-[62px]">
      <div className="flex justify-between items-center pb-[14px] border-b border-slate-700">
        <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ESTIMATION ROUND</span>
        <span className="text-[#64748b] text-[12px] tracking-[.6px]">{room.tasks.length ? `${String(roundNumber).padStart(2, "0")} / ${String(room.tasks.length).padStart(2, "0")}` : "00 / 00"}</span>
      </div>
      {error && <p className="text-red-400 text-[13px] leading-[1.5]" role="alert">{error}</p>}
      {notice && <p className="mt-[10px] text-sky-500 text-[13px]" role="status">{notice}</p>}
      {removedFromRoom ? <RoomAccessRemoved /> : !currentPlayer ? <RoomInvitation /> : showResults ? (
        <TaskResults
          task={activeTask!}
          room={room}
          isAdmin={isAdmin}
          allTasksCompleted={allTasksCompleted}
          isLoading={isLoading}
          onAdvance={onAdvance}
        />
      ) : allTasksCompleted ? <AllTasksCompleted /> : activeTask ? (
        <ActiveRound
          task={activeTask}
          player={currentPlayer}
          isAdmin={isAdmin}
          playerCount={room.players.length}
          voteCount={voteCount}
          myVote={myVote}
          isLoading={isLoading}
          deckType={room.deckType}
          onVote={onVote}
          onFinalize={onFinalize}
          onSetDeckType={onSetDeckType}
        />
      ) : <RoomReady isAdmin={isAdmin} />}
      <div className="fixed right-[22px] bottom-[15px] text-[#475569] text-[11px] max-sm:right-3 max-sm:bottom-[9px] max-sm:left-3 max-sm:text-center max-sm:text-[10px]">Live online room · free for up to 10 players</div>
    </section>
  );
}

type TaskResultsProps = {
  task: Task;
  room: Room;
  isAdmin: boolean;
  allTasksCompleted: boolean;
  isLoading: boolean;
  onAdvance: () => void;
};

function TaskResults({ task, room, isAdmin, allTasksCompleted, isLoading, onAdvance }: TaskResultsProps) {
  const voters = room.players.filter((player) => task.voteLabels[player.id] !== undefined);
  return (
    <>
      <div className="pt-[34px] pb-[29px] [animation:reveal-up_.4s_ease-out_both] max-sm:pt-[26px] max-sm:pb-[22px]">
        <span className="text-[#64748b] text-[11px] font-extrabold tracking-[1.4px]">TASK FINALIZED</span>
        <h1 className="max-w-[780px] my-[9px] font-medium text-[38px] leading-[1.12] [font-family:var(--serif)] tracking-[0] [overflow-wrap:anywhere] max-sm:text-[31px]">{task.title}</h1>
        <p className="m-0 text-[#94a3b8] text-[14px]">{isAdmin ? "Review the votes below, then advance when ready." : "Waiting for the admin to continue."}</p>
      </div>
      <div className="mt-[23px] p-[19px] border-t border-b border-slate-700">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-[11px] font-extrabold tracking-[1px] text-slate-400">AVERAGE</span>
          <span className="text-[48px] [font-family:var(--serif)] text-sky-500 leading-none">{formatScore(task.finalScore!)}</span>
        </div>
        <div className="flex flex-col gap-[6px] mb-[18px]">
          {voters.map((player) => (
            <div key={player.id} className="flex items-center justify-between p-[7px_10px] border border-slate-700 bg-slate-800">
              <span className="text-[13px] text-slate-100">{player.name}</span>
              <span className="text-[13px] font-bold text-sky-500">{task.voteLabels[player.id]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end">
          {isAdmin
            ? <button className="h-9 px-[14px] border-0 bg-sky-500 text-white text-[13px] font-bold cursor-pointer transition-[background,transform] duration-[180ms] hover:bg-sky-600 hover:-translate-y-px disabled:bg-slate-700 disabled:cursor-not-allowed disabled:transform-none" onClick={onAdvance} disabled={isLoading}>{allTasksCompleted ? "Finish session" : "Next task"}<span className="ml-[10px]" aria-hidden="true">↗</span></button>
            : <p className="text-[13px] text-slate-400">Waiting for the admin to advance…</p>}
        </div>
      </div>
    </>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[58vh] flex flex-col justify-center items-start p-[20px_8%] [animation:reveal-up_.4s_ease-out_both] max-sm:min-h-[42vh] max-sm:p-[28px_8px]">
      {children}
    </div>
  );
}

function RoomAccessRemoved() {
  return (
    <EmptyState>
      <div className="mb-[27px] text-orange-500 text-[28px]">×</div>
      <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ROOM ACCESS REMOVED</span>
      <h1 className="mt-[13px] mb-2 font-medium text-[42px] leading-[1.04] [font-family:var(--serif)] tracking-[0] max-sm:text-[34px]">You were removed from this room.</h1>
      <p className="max-w-[390px] text-[#94a3b8] text-[14px] leading-[1.7]">Your current session was removed and your votes were deleted. Refresh this page or reopen the invite to join again with your name.</p>
    </EmptyState>
  );
}

function RoomInvitation() {
  return (
    <EmptyState>
      <div className="mb-[27px] text-orange-500 text-[28px]">✳</div>
      <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ROOM INVITATION</span>
      <h1 className="mt-[13px] mb-2 font-medium text-[42px] leading-[1.04] [font-family:var(--serif)] tracking-[0] max-sm:text-[34px]">Join your team to estimate.</h1>
      <p className="max-w-[390px] text-[#94a3b8] text-[14px] leading-[1.7]">Choose a name in the sidebar. This room supports up to 10 players.</p>
    </EmptyState>
  );
}

function AllTasksCompleted() {
  return (
    <EmptyState>
      <div className="mb-[27px] text-orange-500 text-[28px]">✳</div>
      <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ALL TASKS ESTIMATED</span>
      <h1 className="mt-[13px] mb-2 font-medium text-[42px] leading-[1.04] [font-family:var(--serif)] tracking-[0] max-sm:text-[34px]">Every score is locked in.</h1>
      <p className="max-w-[390px] text-[#94a3b8] text-[14px] leading-[1.7]">Final averages are shown beside each task. Add another task to start a new round.</p>
    </EmptyState>
  );
}

function RoomReady({ isAdmin }: { isAdmin: boolean }) {
  return (
    <EmptyState>
      <div className="mb-[27px] text-orange-500 text-[28px]">✳</div>
      <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ROOM READY</span>
      <h1 className="mt-[13px] mb-2 font-medium text-[42px] leading-[1.04] [font-family:var(--serif)] tracking-[0] max-sm:text-[34px]">{isAdmin ? "What's the first task?" : "Waiting for the first task"}</h1>
      <p className="max-w-[390px] text-[#94a3b8] text-[14px] leading-[1.7]">{isAdmin ? "Add a task from the sidebar to start the round." : "The admin will add a task for the team to estimate."}</p>
    </EmptyState>
  );
}

type ActiveRoundProps = {
  task: Task;
  player: Player;
  isAdmin: boolean;
  playerCount: number;
  voteCount: number;
  myVote: { taskId: string; score: number } | null;
  isLoading: boolean;
  deckType: DeckType;
  onVote: (score: number) => void;
  onFinalize: () => void;
  onSetDeckType: (type: DeckType) => void;
};

function ActiveRound({ task, player, isAdmin, playerCount, voteCount, myVote, isLoading, deckType, onVote, onFinalize, onSetDeckType }: ActiveRoundProps) {
  const deck = DECKS[deckType];
  return (
    <>
      <div className="pt-[34px] pb-[29px] [animation:reveal-up_.4s_ease-out_both] max-sm:pt-[26px] max-sm:pb-[22px]">
        <span className="text-[#64748b] text-[11px] font-extrabold tracking-[1.4px]">CURRENT TASK</span>
        <h1 className="max-w-[780px] my-[9px] font-medium text-[38px] leading-[1.12] [font-family:var(--serif)] tracking-[0] [overflow-wrap:anywhere] max-sm:text-[31px]">{task.title}</h1>
        <p className="m-0 text-[#94a3b8] text-[14px]">{isAdmin ? "Cards stay hidden until you reveal the votes." : "Choose your estimate. The admin will reveal the votes."}</p>
      </div>
      <div className="p-[18px_20px_0] bg-[#1a2333] border border-slate-700 max-sm:pt-[15px] max-sm:px-3 max-sm:pb-0">
        <div className="flex justify-between gap-[10px] mb-[15px] text-[#64748b] text-[11px] font-extrabold tracking-[1px] max-sm:flex-col max-sm:gap-[6px]">
          <span>YOUR ESTIMATE</span>
          <span>VOTING AS <b className="text-sky-500">{player.name}</b></span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-[6px] mb-[14px]" role="group" aria-label="Scoring deck">
            <span className="text-[#475569] text-[11px] font-extrabold tracking-[1px] mr-[2px]">DECK</span>
            <button
              className={`h-6 px-[10px] border text-[12px] font-bold cursor-pointer transition-[background,color,border-color] duration-[150ms] hover:border-sky-500 hover:text-sky-500 ${deckType === "half-points" ? "border-sky-500 bg-sky-500/10 text-sky-500" : "border-slate-700 bg-transparent text-[#64748b]"}`}
              onClick={() => onSetDeckType("half-points")}
              disabled={isLoading}
            >
              ½ pts
            </button>
            <button
              className={`h-6 px-[10px] border text-[12px] font-bold cursor-pointer transition-[background,color,border-color] duration-[150ms] hover:border-sky-500 hover:text-sky-500 ${deckType === "fibonacci" ? "border-sky-500 bg-sky-500/10 text-sky-500" : "border-slate-700 bg-transparent text-[#64748b]"}`}
              onClick={() => onSetDeckType("fibonacci")}
              disabled={isLoading}
            >
              Fibonacci
            </button>
          </div>
        )}
        <div className="grid grid-cols-9 gap-2 max-[900px]:gap-[5px] max-sm:grid-cols-5 max-sm:gap-[7px]" role="group" aria-label="Choose your estimate">
          {deck.map((score) => {
            const isChosen = myVote?.taskId === task.id && myVote.score === score;
            return (
              <button
                key={score}
                className={`aspect-[2/2.7] min-w-0 text-[24px] [font-family:var(--serif)] cursor-pointer transition-[transform,border-color,background] duration-[160ms] max-[900px]:text-[19px] max-sm:aspect-[1/1.25] max-sm:text-[20px] ${isChosen ? "-translate-y-[6px] border border-sky-500 bg-sky-500 text-white hover:bg-sky-600" : "border border-slate-700 bg-slate-800 text-slate-100 hover:-translate-y-[5px] hover:border-sky-500"}`}
                onClick={() => onVote(score)}
                disabled={isLoading}
                aria-pressed={isChosen}
              >
                {formatScore(score)}
              </button>
            );
          })}
        </div>
        <div className="min-h-[55px] flex items-center justify-between gap-3 text-[#64748b] text-[12px] max-sm:min-h-[58px] max-sm:text-[11px]">
          <span aria-live="polite">{voteCount} of {playerCount} votes cast</span>
          {isAdmin && (
            <button
              className="h-[33px] px-3 border-0 bg-sky-500 text-white text-[12px] font-bold cursor-pointer transition-[background,transform] duration-[180ms] hover:bg-sky-600 hover:-translate-y-px disabled:bg-slate-700 disabled:cursor-not-allowed disabled:transform-none max-sm:px-2 max-sm:text-[11px]"
              onClick={onFinalize}
              disabled={isLoading || voteCount < playerCount}
              title={voteCount < playerCount ? "Waiting for all players to vote" : undefined}
            >
              Reveal votes<span className="ml-[13px] max-sm:ml-[7px]" aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-[23px] pt-[17px] pb-[17px] px-[19px] border-t border-b border-slate-700 max-sm:px-1">
        <div className="flex items-center justify-between">
          <span className="text-sky-500 text-[11px] font-extrabold tracking-[1.7px]">ROUND STATUS</span>
        </div>
        <div className="min-h-[53px] flex items-center gap-[15px] max-sm:flex-wrap max-sm:gap-[10px] max-sm:py-[9px]">
          <p className="text-[#64748b] text-[13px]">{voteCount < playerCount ? `Waiting for ${playerCount - voteCount} more vote${playerCount - voteCount === 1 ? "" : "s"}.` : "All votes are in. Ready to reveal."}</p>
        </div>
      </div>
    </>
  );
}
