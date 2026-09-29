import { ESTIMATION_DECK, type Player, type Room, type Task } from "../model";
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
};

export function GameArea(props: GameAreaProps) {
  const { room, currentPlayer, isAdmin, activeTask, voteCount, completedTaskCount, allTasksCompleted, removedFromRoom, error, notice, myVote, isLoading, onVote, onFinalize } = props;
  const roundNumber = Math.min(completedTaskCount + (activeTask ? 1 : 0), room.tasks.length);

  return (
    <section className="game-area">
      <div className="game-topline">
        <span className="eyebrow">ESTIMATION ROUND</span>
        <span className="round-count">{room.tasks.length ? `${String(roundNumber).padStart(2, "0")} / ${String(room.tasks.length).padStart(2, "0")}` : "00 / 00"}</span>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="copy-notice" role="status">{notice}</p>}
      {removedFromRoom ? <RoomAccessRemoved /> : !currentPlayer ? <RoomInvitation /> : allTasksCompleted ? <AllTasksCompleted /> : activeTask ? (
        <ActiveRound
          task={activeTask}
          player={currentPlayer}
          isAdmin={isAdmin}
          playerCount={room.players.length}
          voteCount={voteCount}
          myVote={myVote}
          isLoading={isLoading}
          onVote={onVote}
          onFinalize={onFinalize}
        />
      ) : <RoomReady isAdmin={isAdmin} />}
      <div className="device-note">Live online room · free for up to 10 players</div>
    </section>
  );
}

function RoomAccessRemoved() {
  return (
    <div className="empty-state">
      <div className="empty-mark">×</div>
      <span className="eyebrow">ROOM ACCESS REMOVED</span>
      <h1>You were removed from this room.</h1>
      <p>Your current session was removed and your votes were deleted. Refresh this page or reopen the invite to join again with your name.</p>
    </div>
  );
}

function RoomInvitation() {
  return (
    <div className="empty-state">
      <div className="empty-mark">✳</div>
      <span className="eyebrow">ROOM INVITATION</span>
      <h1>Join your team to estimate.</h1>
      <p>Choose a name in the sidebar. This room supports up to 10 players.</p>
    </div>
  );
}

function AllTasksCompleted() {
  return (
    <div className="empty-state">
      <div className="empty-mark">✳</div>
      <span className="eyebrow">ALL TASKS ESTIMATED</span>
      <h1>Every score is locked in.</h1>
      <p>Final averages are shown beside each task. Add another task to start a new round.</p>
    </div>
  );
}

function RoomReady({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">✳</div>
      <span className="eyebrow">ROOM READY</span>
      <h1>{isAdmin ? "What's the first task?" : "Waiting for the first task"}</h1>
      <p>{isAdmin ? "Add a task from the sidebar to start the round." : "The admin will add a task for the team to estimate."}</p>
    </div>
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
  onVote: (score: number) => void;
  onFinalize: () => void;
};

function ActiveRound({ task, player, isAdmin, playerCount, voteCount, myVote, isLoading, onVote, onFinalize }: ActiveRoundProps) {
  return (
    <>
      <div className="task-prompt">
        <span className="task-kicker">CURRENT TASK</span>
        <h1>{task.title}</h1>
        <p>{isAdmin ? "Cards stay hidden until you reveal the votes." : "Choose your estimate. The admin will reveal the votes."}</p>
      </div>
      <div className="vote-panel">
        <div className="vote-label"><span>YOUR ESTIMATE</span><span>VOTING AS <b>{player.name}</b></span></div>
        <div className="card-deck" role="group" aria-label="Choose your estimate">
          {ESTIMATION_DECK.map((score) => (
            <button
              key={score}
              className={`score-card ${myVote?.taskId === task.id && myVote.score === score ? "chosen-card" : ""}`}
              onClick={() => onVote(score)}
              disabled={isLoading}
              aria-pressed={myVote?.taskId === task.id && myVote.score === score}
            >
              {formatScore(score)}
            </button>
          ))}
        </div>
        <div className="vote-footer">
          <span aria-live="polite">{voteCount} of {playerCount} votes cast</span>
          {isAdmin && <button className="reveal-button" onClick={onFinalize} disabled={isLoading || voteCount === 0}>Finalize task<span aria-hidden="true">↗</span></button>}
        </div>
      </div>
      <div className="results-strip">
        <div className="results-heading"><span className="eyebrow">ROUND STATUS</span></div>
        <div className="results-content"><p>Votes stay hidden until the admin finalizes this task.</p></div>
      </div>
    </>
  );
}