"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms) {
  if (ms <= 0) return "Prazo esgotado";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function Countdown({ deadlineAt, serverNow }) {
  const deadlineMs = new Date(deadlineAt).getTime();
  const skew = serverNow ? Date.now() - new Date(serverNow).getTime() : 0;
  const [remaining, setRemaining] = useState(
    () => deadlineMs - (Date.now() - skew)
  );

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - (Date.now() - skew));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, skew]);

  return <p className="countdown">Prazo restante: {formatRemaining(remaining)}</p>;
}
