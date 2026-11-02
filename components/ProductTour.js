"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  COMPANY_TUTORIAL_STEPS,
  COMPANY_TUTORIAL_STORAGE_KEY,
  TUTORIAL_FORCE_EVENT,
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
} from "@/lib/tutorial-steps";

const PAD = 8;
const CARD_GAP = 12;
const CARD_W = 320;
const CARD_W_WIDE = 360;

function storageKeyFor(user) {
  return user?.isCompany
    ? COMPANY_TUTORIAL_STORAGE_KEY
    : TUTORIAL_STORAGE_KEY;
}

function readLocalDone(user) {
  try {
    return localStorage.getItem(storageKeyFor(user)) === "1";
  } catch {
    return false;
  }
}

function writeLocalDone(user, done) {
  try {
    const key = storageKeyFor(user);
    if (done) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function measureTarget(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return null;
  return {
    el,
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    midX: rect.left + rect.width / 2,
    midY: rect.top + rect.height / 2,
    bottom: rect.bottom + PAD,
    right: rect.right + PAD,
  };
}

function placeCard(hole, placement, cardH = 200, cardW = CARD_W) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(cardW, vw - 24);
  let top;
  let left;

  const prefer = placement || "auto";
  const spaceBelow = vh - (hole?.bottom || 0);
  const spaceAbove = hole?.top || 0;

  let side = prefer;
  if (prefer === "auto") {
    side = spaceBelow >= cardH + CARD_GAP || spaceBelow >= spaceAbove ? "bottom" : "top";
  }

  if (!hole || side === "center") {
    return {
      top: Math.max(16, (vh - cardH) / 2),
      left: Math.max(12, (vw - w) / 2),
      width: w,
    };
  }

  if (side === "bottom") {
    top = hole.bottom + CARD_GAP;
    left = hole.midX - w / 2;
  } else if (side === "top") {
    top = hole.top - CARD_GAP - cardH;
    left = hole.midX - w / 2;
  } else if (side === "right") {
    top = hole.midY - cardH / 2;
    left = hole.right + CARD_GAP;
  } else {
    top = hole.midY - cardH / 2;
    left = hole.left - CARD_GAP - w;
  }

  left = Math.max(12, Math.min(left, vw - w - 12));
  top = Math.max(12, Math.min(top, vh - cardH - 12));
  return { top, left, width: w };
}

/**
 * @param {{
 *   user: { id: number, isCompany?: boolean, tutorialCompleted?: boolean } | null | undefined,
 *   menuOpen: boolean,
 *   setMenuOpen: (v: boolean | ((b: boolean) => boolean)) => void,
 * }} props
 */
export default function ProductTour({ user, menuOpen, setMenuOpen }) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState(null);
  const [cardPos, setCardPos] = useState({ top: 80, left: 16, width: CARD_W });
  const [readyGate, setReadyGate] = useState(false);
  const cardRef = useRef(null);
  const navigatingRef = useRef(false);
  const startedForUserRef = useRef(null);

  const isCompany = Boolean(user?.isCompany);
  const steps = isCompany ? COMPANY_TUTORIAL_STEPS : TUTORIAL_STEPS;
  const step = steps[stepIndex] || steps[0];
  const total = steps.length;
  const isLast = stepIndex >= total - 1;
  const homeRoute = isCompany ? "/empresa" : "/";

  const persistComplete = useCallback(
    async (completed) => {
      writeLocalDone(user, completed);
      try {
        await fetch("/api/profile/tutorial", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        });
      } catch {
        /* localStorage already updated */
      }
    },
    [user]
  );

  const finish = useCallback(async () => {
    setActive(false);
    setHole(null);
    await persistComplete(true);
    navigatingRef.current = true;
    router.push(homeRoute);
  }, [persistComplete, router, homeRoute]);

  const startTour = useCallback(
    (fromBeginning = true) => {
      if (!user || user.isAdmin) return;
      if (fromBeginning) setStepIndex(0);
      setActive(true);
      writeLocalDone(user, false);
    },
    [user]
  );

  // Auto-start on first authenticated visit
  useEffect(() => {
    if (!user || user.isAdmin) {
      setActive(false);
      return undefined;
    }
    if (startedForUserRef.current === user.id) return undefined;

    const serverDone = Boolean(user.tutorialCompleted);
    const localDone = readLocalDone(user);

    const t = setTimeout(() => {
      startedForUserRef.current = user.id;
      if (!serverDone && !localDone) {
        setStepIndex(0);
        setActive(true);
      }
      setReadyGate(true);
    }, 450);

    return () => clearTimeout(t);
  }, [user]);

  // Restart from perfil / menu
  useEffect(() => {
    function onForce() {
      if (!user || user.isAdmin) return;
      startedForUserRef.current = user.id;
      setStepIndex(0);
      setActive(true);
      persistComplete(false);
      const dest = user.isCompany ? "/empresa" : "/";
      if (pathname !== dest) {
        navigatingRef.current = true;
        router.push(dest);
      }
    }
    window.addEventListener(TUTORIAL_FORCE_EVENT, onForce);
    return () => window.removeEventListener(TUTORIAL_FORCE_EVENT, onForce);
  }, [user, pathname, router, persistComplete]);

  // Expose start for parent (optional)
  useEffect(() => {
    window.__goindicaStartTutorial = () => startTour(true);
    return () => {
      delete window.__goindicaStartTutorial;
    };
  }, [startTour]);

  const refreshHole = useCallback(() => {
    if (!active || !step) return;
    const wide = Boolean(step.tagline || step.placement === "center");
    const cardW = wide ? CARD_W_WIDE : CARD_W;
    if (!step.target) {
      setHole(null);
      const h = cardRef.current?.offsetHeight || 240;
      setCardPos(placeCard(null, "center", h, cardW));
      return;
    }
    let next = measureTarget(`[data-tour="${step.target}"]`);
    // Logo fica na sidebar (fechada no mobile) — fallback suave para o hero da home
    if (!next && step.target === "brand-logo") {
      next = measureTarget('[data-tour="home-hero"]');
    }
    setHole(next);
    const h = cardRef.current?.offsetHeight || (wide ? 240 : 210);
    setCardPos(placeCard(next, step.placement, h, cardW));
    if (next?.el && step.placement !== "center") {
      try {
        next.el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      } catch {
        /* ignore */
      }
    }
  }, [active, step]);

  // Navigate / open menu for step target
  useEffect(() => {
    if (!active || !step) return undefined;

    const needRoute = step.route && pathname !== step.route;
    if (needRoute) {
      navigatingRef.current = true;
      router.push(step.route);
      return undefined;
    }
    navigatingRef.current = false;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 900;
    if (step.openMenu && isMobile && !menuOpen) {
      setMenuOpen(true);
    }
    if (!step.openMenu && menuOpen && isMobile && step.target?.startsWith("nav-") === false) {
      // leave menu as user left it for non-nav steps after nav
    }

    const t = setTimeout(() => {
      refreshHole();
    }, needRoute ? 80 : 60);

    return () => clearTimeout(t);
  }, [active, step, stepIndex, pathname, router, menuOpen, setMenuOpen, refreshHole]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    refreshHole();
    const onResize = () => refreshHole();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const iv = setInterval(refreshHole, 400);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      clearInterval(iv);
    };
  }, [active, stepIndex, pathname, menuOpen, refreshHole, readyGate]);

  // Lock body scroll lightly
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, total - 1));
  }

  function goPrev() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (!active || !user || user.isAdmin) return null;

  const holeStyle = hole
    ? {
        top: Math.max(0, hole.top),
        left: Math.max(0, hole.left),
        width: hole.width,
        height: hole.height,
      }
    : null;
  const intentionalCenter = step.placement === "center" || !step.target;
  const bodyParts = String(step.body || "")
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const softHole = Boolean(step.softSpotlight);

  return (
    <div
      className="product-tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-tour-title"
      data-testid="product-tour"
      data-tour-step={step.id}
      data-tour-index={stepIndex}
    >
      <div className="product-tour-shade" aria-hidden />
      {holeStyle ? (
        <div
          className={`product-tour-hole${softHole ? " product-tour-hole--soft" : ""}`}
          style={holeStyle}
          aria-hidden
        />
      ) : (
        <div className="product-tour-hole product-tour-hole--fallback" aria-hidden />
      )}

      <div
        ref={cardRef}
        className={`product-tour-card${intentionalCenter ? " product-tour-card--center" : ""}`}
        style={{
          top: cardPos.top,
          left: cardPos.left,
          width: cardPos.width,
        }}
        data-testid="product-tour-card"
      >
        <div className="product-tour-progress" aria-live="polite">
          <span>
            {stepIndex + 1}/{total}
          </span>
          <div className="product-tour-progress-bar" aria-hidden>
            <span style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
          </div>
        </div>
        <h2 id="product-tour-title">{step.title}</h2>
        {step.tagline ? (
          <p className="product-tour-tagline">{step.tagline}</p>
        ) : null}
        {bodyParts.map((part) => (
          <p key={part}>{part}</p>
        ))}
        {!hole && !intentionalCenter ? (
          <p className="product-tour-hint muted">
            A preparar o destaque… Se o alvo estiver noutro ecrã, a navegação
            acontece automaticamente.
          </p>
        ) : null}
        <div className="product-tour-actions">
          <button
            type="button"
            className="product-tour-skip"
            data-testid="product-tour-skip"
            onClick={finish}
          >
            Saltar
          </button>
          <div className="product-tour-nav">
            <button
              type="button"
              className="pill-outline sm"
              data-testid="product-tour-prev"
              disabled={stepIndex === 0}
              onClick={goPrev}
            >
              Voltar
            </button>
            <button
              type="button"
              className="pill-cta sm"
              data-testid="product-tour-next"
              onClick={goNext}
            >
              {isLast ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function requestTutorialRestart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TUTORIAL_FORCE_EVENT));
}
