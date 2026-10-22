import { useState } from "react";
import { GameProvider, useGame } from "./GameContext";
import { Flag, GuessForm, ScoreBoard, Timer, Leaderboard } from "./components";
import "./styles.css";

function Screen() {
  const { status, startGame, score, playerName } = useGame();
  const [name, setName] = useState("");

  if (status === "loading") return <p className="center">Cargando países…</p>;
  if (status === "error")
    return <p className="center">No se pudo cargar la API. Revisá tu conexión y recargá la página.</p>;

  if (status === "playing")
    return (
      <>
        <header className="hud">
          <ScoreBoard />
          <Timer />
        </header>
        <Flag />
        <GuessForm />
      </>
    );

  return (
    <div className="lobby">
      {status === "over" && (
        <p className="final">
          Se acabó el tiempo, {playerName || "jugador"}: <strong>{score} puntos</strong>
        </p>
      )}
      <form
        className="start"
        onSubmit={(e) => {
          e.preventDefault();
          startGame(name);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={20}
          aria-label="Tu nombre"
        />
        <button type="submit">{status === "over" ? "Jugar de nuevo" : "Empezar"}</button>
      </form>
      <Leaderboard />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <main>
        <h1>¿De qué país es la bandera?</h1>
        <Screen />
      </main>
    </GameProvider>
  );
}
