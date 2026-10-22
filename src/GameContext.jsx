import { createContext, useContext, useEffect, useState, useCallback } from "react";

const API_URL = "https://countriesnow.space/api/v0.1/countries/flag/images";
const GAME_SECONDS = 60;
const STORAGE_KEY = "tp11-leaderboard";

const GameContext = createContext(null);

// "Côte d'Ivoire" y "cote d ivoire" cuentan como lo mismo
const normalize = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Traduce el nombre usando el código iso2 que devuelve la API
const toSpanish = (list) => {
  let dn = null;
  try {
    dn = new Intl.DisplayNames(["es"], { type: "region" });
  } catch {}
  return list.map((c) => {
    let es = null;
    try {
      es = dn && c.iso2 ? dn.of(c.iso2) : null;
    } catch {}
    // si no hay traducción (o devuelve el mismo código), queda el nombre original
    const name = es && es !== c.iso2 ? es : c.name;
    return { ...c, nameEn: c.name, name };
  });
};

// Devuelve las pistas del país, de la más vaga a la más reveladora
const getHints = (c) => {
  const words = c.name.split(" ").length;
  const masked = [...c.name]
    .map((ch, i) => {
      if (ch === " ") return "/";
      if (ch === "-") return "-";
      return i === 0 || i === c.name.length - 1 || i % 3 === 0 ? ch : "_";
    })
    .join(" ");

  return [
    `Tiene ${c.name.replace(/ /g, "").length} letras en ${words} ${words === 1 ? "palabra" : "palabras"}`,
    `Empieza con "${c.name[0]}"`,
    c.iso3 && `Su código de 3 letras es ${c.iso3}`,
    `Pista final: ${masked}`,
  ].filter(Boolean);
};

const pickRandom = (list, avoid) => {
  if (list.length < 2) return list[0] ?? null;
  let next;
  do {
    next = list[Math.floor(Math.random() * list.length)];
  } while (next === avoid);
  return next;
};

const loadPlayers = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
};

export function GameProvider({ children }) {
  const [countries, setCountries] = useState([]);
  const [current, setCurrent] = useState(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState("loading"); // loading | error | ready | playing | over
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [hints, setHints] = useState([]); // pistas reveladas para el país actual
  const [feedback, setFeedback] = useState(null); // { ok: boolean, text: string }
  const [revealed, setRevealed] = useState(null); // país que se saltó (para mostrar "Era: ...")
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState(loadPlayers);

  // 1) Al montar: traer países y elegir uno al azar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_URL);
        const json = await res.json();
        const list = toSpanish((json.data ?? []).filter((c) => c.name && c.flag));
        if (cancelled) return;
        if (list.length === 0) throw new Error("Sin datos");
        setCountries(list);
        setCurrent(pickRandom(list));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Timer: cuenta regresiva mientras se juega
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // 3) Fin del juego: guardar en el ranking
  useEffect(() => {
    if (status === "playing" && timeLeft <= 0) {
      setStatus("over");
      setPlayers((prev) => {
        const next = [...prev, { name: playerName || "Anónimo", score, date: Date.now() }]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [timeLeft, status, playerName, score]);

  const nextCountry = useCallback(() => {
    setCurrent((prev) => pickRandom(countries, prev));
    setHints([]);
  }, [countries]);

  const startGame = useCallback(
    (name) => {
      setPlayerName(name.trim());
      setScore(0);
      setTimeLeft(GAME_SECONDS);
      setFeedback(null);
      setRevealed(null);
      setCurrent((prev) => pickRandom(countries, prev));
      setHints([]);
      setStatus("playing");
    },
    [countries]
  );

  const guess = useCallback(
    (text) => {
      if (status !== "playing" || !current || !text.trim()) return false;
      const answer = normalize(text);
      const ok = answer === normalize(current.name) || answer === normalize(current.nameEn);
      if (ok) {
        setScore((s) => s + 10);
        setFeedback({ ok: true, text: `¡Correcto! Era ${current.name}. +10` });
        nextCountry();
      } else {
        setScore((s) => s - 1);
        setFeedback({ ok: false, text: "Ese no es. −1" });
      }
      return ok;
    },
    [status, current, nextCountry]
  );

  // Pistas: cada una cuesta 2 puntos.
  const useHint = useCallback(() => {
    if (status !== "playing" || !current) return;
    const all = getHints(current);
    if (hints.length >= all.length) return;
    setHints((h) => [...h, all[hints.length]]);
    setScore((s) => s - 2);
  }, [status, current, hints]);

  // Saltar: cuesta 1 punto y muestra cuál era la bandera
  const skip = useCallback(() => {
    if (status !== "playing" || !current) return;
    setRevealed(current.name);
    setScore((s) => s - 1);
    setFeedback(null);
    nextCountry();
  }, [status, current, nextCountry]);

  const resetScore = useCallback(() => setScore(0), []);
  const clearFeedback = useCallback(() => setFeedback(null), []);

  const value = {
    countries, current, score, status, timeLeft, hints, feedback,
    playerName, players, revealed,
    maxHints: current ? getHints(current).length : 0,
    guess, nextCountry, resetScore, startGame, useHint, skip, clearFeedback,
    totalSeconds: GAME_SECONDS,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame debe usarse dentro de <GameProvider>");
  return ctx;
}