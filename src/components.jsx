import { useState } from "react";
import { useGame } from "./GameContext";

// Ningún componente recibe props de juego: todo sale del Context.

// Prueba primero la URL de la API; si falla, usa flagcdn con el código iso2;
// si también falla, pasa a otro país sin penalizar al jugador.
function FlagImage({ country, onBroken }) {
  const [stage, setStage] = useState(0);
  const sources = [
    country.flag,
    country.iso2 && `https://flagcdn.com/w320/${country.iso2.toLowerCase()}.png`,
  ].filter(Boolean);

  return (
    <div className="flag">
      <img
        src={sources[stage]}
        alt="Bandera del país a adivinar"
        onError={() => (stage + 1 < sources.length ? setStage(stage + 1) : onBroken())}
      />
    </div>
  );
}

export function Flag() {
  const { current, status, nextCountry } = useGame();
  if (!current || status === "loading") return <div className="flag skeleton" />;
  // key: al cambiar de país se reinicia el intento de carga
  return <FlagImage key={current.iso2 ?? current.name} country={current} onBroken={nextCountry} />;
}

export function ScoreBoard() {
  const { score, playerName } = useGame();
  return (
    <div className="score" aria-live="polite">
      <span className="score-label">{playerName || "Puntaje"}</span>
      <span className="score-value">{score}</span>
    </div>
  );
}

export function Timer() {
  const { timeLeft, totalSeconds } = useGame();
  const pct = Math.max(0, (timeLeft / totalSeconds) * 100);
  return (
    <div className="timer">
      <span className={timeLeft <= 10 ? "time low" : "time"}>{Math.max(0, timeLeft)}s</span>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const norm = (t) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function GuessForm() {
  const { countries, guess, useHint, hints, feedback } = useGame();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const names = [...new Set(countries.map((c) => c.name))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const query = norm(text.trim());
  const suggestions = query ? names.filter((n) => norm(n).includes(query)).slice(0, 6) : [];

  const submit = (value) => {
    if (guess(value)) setText("");
    setOpen(false);
  };

  return (
    <div className="guess">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <div className="field">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="Escribí el nombre del país"
            autoComplete="off"
            autoFocus
            aria-label="País"
          />
          {open && suggestions.length > 0 && (
            <ul className="suggestions" role="listbox">
              {suggestions.map((n) => (
                <li
                  key={n}
                  role="option"
                  onMouseDown={(e) => {
                    e.preventDefault(); // evita que el input pierda el foco antes del click
                    setText(n);
                    setOpen(false);
                  }}
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit">Adivinar</button>
      </form>

      <div className="hint-row">
        <button type="button" className="ghost" onClick={useHint} disabled={hints.length >= 2}>
          Pedir pista (−2)
        </button>
        <ul className="hints">
          {hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>

      {feedback && (
        <p className={feedback.ok ? "feedback ok" : "feedback bad"} role="status">
          {feedback.text}
        </p>
      )}
    </div>
  );
}

export function Leaderboard() {
  const { players } = useGame();
  return (
    <section className="leaderboard">
      <h2>Ranking</h2>
      {players.length === 0 ? (
        <p className="empty">Todavía no hay partidas. Jugá una para aparecer acá.</p>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Jugador</th><th>Puntos</th></tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.date}>
                <td>{i + 1}</td><td>{p.name}</td><td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
