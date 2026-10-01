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
    <section className="game-area">
      <div className="game-topline">
        <span className="eyebrow">ESTIMATION ROUND</span>
        <span className="round-count">{room.tasks.length ? `${String(roundNumber).padStart(2, "0")} / ${String(room.tasks.length).padStart(2, "0")}` : "00 / 00"}</span>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="copy-notice" role="status">{notice}</p>}
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
      <div className="device-note">Live online room · free for up to 10 players</div>
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
      <div className="task-prompt">
        <span className="task-kicker">TASK FINALIZED</span>
        <h1>{task.title}</h1>
        <p>{isAdmin ? "Review the votes below, then advance when ready." : "Waiting for the admin to continue."}</p>
      </div>
      <div className="results-panel">
        <div className="results-average">
          <span className="results-average-label">AVERAGE</span>
          <span className="results-average-score">{formatScore(task.finalScore!)}</span>
        </div>
        <div className="results-votes">
          {voters.map((player) => (
            <div key={player.id} className="results-vote-row">
              <span className="results-vote-name">{player.name}</span>
              <span className="results-vote-score">{task.voteLabels[player.id]}</span>
            </div>
          ))}
        </div>
        <div className="results-actions">
          {isAdmin
            ? <button className="advance-button" onClick={onAdvance} disabled={isLoading}>{allTasksCompleted ? "Finish session" : "Next task"}<span aria-hidden="true">↗</span></button>
            : <p className="results-waiting">Waiting for the admin to advance…</p>}
        </div>
      </div>
    </>
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
  deckType: DeckType;
  onVote: (score: number) => void;
  onFinalize: () => void;
  onSetDeckType: (type: DeckType) => void;
};

function ActiveRound({ task, player, isAdmin, playerCount, voteCount, myVote, isLoading, deckType, onVote, onFinalize, onSetDeckType }: ActiveRoundProps) {
  const deck = DECKS[deckType];
  return (
    <>
      <div className="task-prompt">
        <span className="task-kicker">CURRENT TASK</span>
        <h1>{task.title}</h1>
        <p>{isAdmin ? "Cards stay hidden until you reveal the votes." : "Choose your estimate. The admin will reveal the votes."}</p>
      </div>
      <div className="vote-panel">
        <div className="vote-label">
          <span>YOUR ESTIMATE</span>
          <span>VOTING AS <b>{player.name}</b></span>
        </div>
        {isAdmin && (
          <div className="deck-selector" role="group" aria-label="Scoring deck">
            <span className="deck-selector-label">DECK</span>
            <button
              className={`deck-option ${deckType === "half-points" ? "deck-option-active" : ""}`}
              onClick={() => onSetDeckType("half-points")}
              disabled={isLoading}
            >
              ½ pts
            </button>
            <button
              className={`deck-option ${deckType === "fibonacci" ? "deck-option-active" : ""}`}
              onClick={() => onSetDeckType("fibonacci")}
              disabled={isLoading}
            >
              Fibonacci
            </button>
          </div>
        )}
        <div className="card-deck" role="group" aria-label="Choose your estimate">
          {deck.map((score) => (
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
          {isAdmin && (
            <button
              className="reveal-button"
              onClick={onFinalize}
              disabled={isLoading || voteCount < playerCount}
              title={voteCount < playerCount ? "Waiting for all players to vote" : undefined}
            >
              Reveal votes<span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </div>
      <div className="results-strip">
        <div className="results-heading"><span className="eyebrow">ROUND STATUS</span></div>
        <div className="results-content">
          <p>{voteCount < playerCount ? `Waiting for ${playerCount - voteCount} more vote${playerCount - voteCount === 1 ? "" : "s"}.` : "All votes are in. Ready to reveal."}</p>
        </div>
      </div>
    </>
  );
}