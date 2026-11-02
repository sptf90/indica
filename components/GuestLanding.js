"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReputationRingGauge from "@/components/ReputationRingGauge";
import { getReputationTraffic } from "@/lib/reputation-ui";

const HOW_STEPS = [
  {
    n: "01",
    title: "Peça o que precisa",
    body: "Perfume importado, mecânico de confiança, restaurante escondido — descreva o pedido e a cidade resolve.",
  },
  {
    n: "02",
    title: "Receba indicações reais",
    body: "Vizinhos e gente da cidade respondem com o que já conhecem. Sem feed e sem catálogo: indicação de pessoa pra pessoa.",
  },
  {
    n: "03",
    title: "Compare, escolha e avalie",
    body: "Reputação à vista em cada opção. Escolha uma pra testar e diga se foi válida — a comunidade aprende com você.",
  },
];

const EXAMPLES = [
  {
    title: "Perfume importado",
    body: "Alguém da cidade sabe a loja certa — indica com endereço, faixa de preço e contexto.",
  },
  {
    title: "Mecânico de confiança",
    body: "Quem já levou o carro aponta o profissional honesto, com nome e referência.",
  },
  {
    title: "Restaurante escondido",
    body: "Pedidos de quem mora perto: o lugar bom que o algoritmo não mostra.",
  },
  {
    title: "Serviço local",
    body: "Do pedicure ao pet shop: respostas de quem já usou e pode contar como foi.",
  },
];

const HERO_WORDS = ["perfume", "mecânico", "restaurante", "serviço"];

const REP_TARGET = 92;
const EXAMPLE_MS = 3600;
const HERO_WORD_MS = 2400;
const SPLASH_HOLD_MS = 980;
const SPLASH_FADE_MS = 520;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useReveal() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const nodes = [...root.querySelectorAll("[data-reveal]")];
    if (!nodes.length) return undefined;

    root.classList.add("mkt-motion-ready");

    if (prefersReducedMotion()) {
      nodes.forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.12 }
    );

    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return rootRef;
}

function useReputationCounter(active, target = REP_TARGET) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setValue(0);
      setDone(false);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      setDone(true);
      return undefined;
    }

    let frame = 0;
    const duration = 1680;
    const start = performance.now();
    setDone(false);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out expo — sobe rápido no início, pousa no 92
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(eased * target));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return { value, done };
}

function useExampleCycle(count, enabled) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("in");

  useEffect(() => {
    if (!enabled || count < 2) return undefined;
    if (prefersReducedMotion()) return undefined;

    let timeoutId = 0;
    const intervalId = setInterval(() => {
      setPhase("out");
      timeoutId = window.setTimeout(() => {
        setIndex((i) => (i + 1) % count);
        setPhase("in");
      }, 300);
    }, EXAMPLE_MS);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [count, enabled]);

  return { index, phase };
}

function useHeroWordCycle(words, enabled) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("in");

  useEffect(() => {
    if (!enabled || words.length < 2) return undefined;
    if (prefersReducedMotion()) return undefined;

    let timeoutId = 0;
    const intervalId = setInterval(() => {
      setPhase("out");
      timeoutId = window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setPhase("in");
      }, 260);
    }, HERO_WORD_MS);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, words.length]);

  return { word: words[index], phase };
}

function useLandingSplash() {
  const [phase, setPhase] = useState("boot");

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase("done");
      return undefined;
    }

    const outId = window.setTimeout(() => setPhase("out"), SPLASH_HOLD_MS);
    const doneId = window.setTimeout(
      () => setPhase("done"),
      SPLASH_HOLD_MS + SPLASH_FADE_MS
    );

    return () => {
      clearTimeout(outId);
      clearTimeout(doneId);
    };
  }, []);

  return phase;
}

function ReputationScore({ active }) {
  const { value, done } = useReputationCounter(active);
  const traffic = getReputationTraffic(value);

  return (
    <div
      className={`mkt-rep-score is-${traffic.id}${active ? " is-on" : ""}${
        done ? " is-done" : ""
      }`}
      data-rep-traffic={traffic.id}
      style={{
        "--mkt-rep-color": traffic.color,
        "--mkt-rep-soft": traffic.soft,
      }}
      aria-label={`Reputação ${value}% de 100`}
    >
      <div className="mkt-rep-gauge-wrap">
        <ReputationRingGauge
          percent={value}
          size="100%"
          strokeWidth={9.5}
          className="mkt-rep-gauge"
          trackClassName="mkt-rep-track"
          progressClassName="mkt-rep-stroke"
        />
        <span className="mkt-rep-value">{value}%</span>
      </div>
      <div className="mkt-rep-scale" aria-hidden>
        <span className="mkt-rep-scale-line" />
        <span className="mkt-rep-scale-min">0</span>
        <span className="mkt-rep-scale-max">100</span>
      </div>
    </div>
  );
}

function LandingSplash({ phase }) {
  if (phase === "done") return null;

  return (
    <div
      className={`mkt-splash is-${phase}`}
      data-splash
      aria-hidden
      role="presentation"
    >
      <div className="mkt-splash-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/goindica-logo.png"
          alt=""
          className="mkt-splash-logo"
          width={220}
          height={48}
        />
        <span className="mkt-splash-pulse" />
      </div>
    </div>
  );
}

export default function GuestLanding() {
  const rootRef = useReveal();
  const splashPhase = useLandingSplash();
  const [repActive, setRepActive] = useState(false);
  const [examplesActive, setExamplesActive] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const { index: exampleIndex, phase: examplePhase } = useExampleCycle(
    EXAMPLES.length,
    examplesActive
  );
  const { word: heroWord, phase: heroWordPhase } = useHeroWordCycle(
    HERO_WORDS,
    heroReady
  );
  const activeExample = EXAMPLES[exampleIndex];

  useEffect(() => {
    if (splashPhase === "done" || prefersReducedMotion()) {
      setHeroReady(true);
    }
  }, [splashPhase]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const rep = root.querySelector("[data-rep]");
    const examples = root.querySelector("[data-examples]");
    if (!rep && !examples) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target.hasAttribute("data-rep")) setRepActive(true);
          if (entry.target.hasAttribute("data-examples")) setExamplesActive(true);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.32 }
    );

    if (rep) io.observe(rep);
    if (examples) io.observe(examples);
    return () => io.disconnect();
  }, [rootRef]);

  return (
    <div
      className={`mkt${splashPhase !== "done" ? " is-booting" : ""}${
        heroReady ? " is-live" : ""
      }`}
      ref={rootRef}
    >
      <LandingSplash phase={splashPhase} />

      <section className="mkt-hero" aria-label="Apresentação GoIndica">
        <div className="mkt-hero-media" aria-hidden>
          <Image
            src="/home/landing-hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="mkt-hero-img"
            unoptimized
          />
          <div className="mkt-hero-wash" />
          <div className="mkt-hero-vignette" />
          <div className="mkt-hero-grain" />
        </div>

        <div className="mkt-hero-inner">
          <p className="mkt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/goindica-logo.png"
              alt="GoIndica"
              className="mkt-brand-logo"
              width={280}
              height={60}
            />
          </p>
          <h1 className="mkt-headline">
            <span className="mkt-headline-line">Você procura.</span>
            <span className="mkt-headline-line mkt-headline-accent">
              Alguém indica.
            </span>
          </h1>
          <p className="mkt-lead">
            Peça o que precisa na sua cidade —{" "}
            <span
              className={`mkt-lead-word is-${heroWordPhase}`}
              aria-live="polite"
            >
              {heroWord}
            </span>{" "}
            — e receba indicações de gente de verdade.
          </p>
          <div className="mkt-cta-row">
            <Link className="mkt-btn mkt-btn-primary" href="/cadastro">
              Começar agora
            </Link>
            <Link className="mkt-btn mkt-btn-ghost" href="/login">
              Já tenho conta
            </Link>
          </div>
          <p className="mkt-cta-note">
            Grátis · leva cerca de um minuto · começa na sua cidade
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-how" aria-labelledby="mkt-how-title">
        <div className="mkt-wrap" data-reveal>
          <p className="mkt-eyebrow">Como funciona</p>
          <h2 id="mkt-how-title" className="mkt-h2">
            Três passos. Zero catálogo.
          </h2>
          <p className="mkt-section-lead">
            Não é busca de empresas. É um pedido real e respostas de quem já
            conhece o caminho.
          </p>
          <ol className="mkt-steps">
            {HOW_STEPS.map((step, i) => (
              <li
                key={step.n}
                className="mkt-step"
                style={{ "--mkt-stagger": `${i * 90}ms` }}
              >
                <span className="mkt-step-n" aria-hidden>
                  {step.n}
                </span>
                <div>
                  <h3 className="mkt-h3">{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="mkt-section mkt-community"
        aria-labelledby="mkt-community-title"
      >
        <div className="mkt-wrap mkt-community-grid" data-reveal data-examples>
          <div>
            <p className="mkt-eyebrow">Comunidade</p>
            <h2 id="mkt-community-title" className="mkt-h2">
              Ajuda local, de gente pra gente.
            </h2>
            <p className="mkt-section-lead">
              Tudo nasce de um pedido na sua cidade. Quem indica permanece
              visível pela reputação; quem pede escolhe com tranquilidade.
            </p>
          </div>

          <div className="mkt-cycle" aria-live="polite">
            <div className={`mkt-cycle-panel is-${examplePhase}`}>
              <p className="mkt-cycle-label">Pedido na cidade</p>
              <h3 className="mkt-h3">{activeExample.title}</h3>
              <p>{activeExample.body}</p>
            </div>
            <div className="mkt-cycle-dots" aria-hidden>
              {EXAMPLES.map((item, i) => (
                <span
                  key={item.title}
                  className={
                    i === exampleIndex
                      ? "mkt-cycle-dot is-active"
                      : "mkt-cycle-dot"
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-rep" aria-labelledby="mkt-rep-title">
        <div className="mkt-wrap mkt-rep-grid" data-reveal data-rep>
          <ReputationScore active={repActive} />
          <div className="mkt-rep-copy">
            <p className="mkt-eyebrow">Reputação</p>
            <h2 id="mkt-rep-title" className="mkt-h2">
              Confiança que dá pra ver.
            </h2>
            <p className="mkt-section-lead">
              A métrica de confiança do GoIndica, sempre à vista. Quem indica
              bem sobe; quem erra, desce — a comunidade vê o número em cada
              indicação.
            </p>
            <ul className="mkt-rep-facts">
              <li className="mkt-rep-fact is-scale">
                <strong>0–100</strong>
                <span>Escala completa, legível de relance</span>
              </li>
              <li className="mkt-rep-fact is-up">
                <strong>↑ Sobe</strong>
                <span>Indicações válidas elevam o número</span>
              </li>
              <li className="mkt-rep-fact is-down">
                <strong>↓ Desce</strong>
                <span>Avaliações ruins baixam a reputação</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        className="mkt-section mkt-ranks mkt-ranks-dark"
        aria-labelledby="mkt-ranks-title"
      >
        <div className="mkt-wrap" data-reveal>
          <p className="mkt-eyebrow">Rankings e prêmios</p>
          <h2 id="mkt-ranks-title" className="mkt-h2">
            Quem indica bem, sobe e pode ganhar.
          </h2>
          <p className="mkt-section-lead">
            Rankings semanais e mensais da sua cidade valorizam quem indica bem.
            Com patrocínio local, há posições premiadas e benefícios pra
            resgatar no fim do período.
          </p>
          <div className="mkt-rank-strip" role="list">
            <div className="mkt-rank-item" role="listitem">
              <strong>Semanal</strong>
              <span>Ritmo curto, incentivo constante</span>
            </div>
            <div className="mkt-rank-item" role="listitem">
              <strong>Mensal</strong>
              <span>Pódio e reconhecimento da cidade</span>
            </div>
            <div className="mkt-rank-item" role="listitem">
              <strong>Prêmios</strong>
              <span>Benefícios de patrocinadores locais</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-finale" aria-labelledby="mkt-finale-title">
        <div className="mkt-wrap mkt-finale-inner" data-reveal>
          <p className="mkt-eyebrow">Sua cidade</p>
          <h2 id="mkt-finale-title" className="mkt-h2">
            Pronto pra pedir ou pra indicar?
          </h2>
          <p className="mkt-section-lead">
            Entre na comunidade da sua cidade. Leva um minuto pra criar conta.
          </p>
          <div className="mkt-cta-row">
            <Link className="mkt-btn mkt-btn-primary mkt-btn-pulse" href="/cadastro">
              Criar conta grátis
            </Link>
            <Link className="mkt-btn mkt-btn-ghost" href="/login">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="mkt-footer">
        <div className="mkt-wrap mkt-footer-inner">
          <Link href="/" className="mkt-footer-brand">
            GoIndica
          </Link>
          <p className="mkt-footer-tag">Você procura. Alguém indica.</p>
          <nav className="mkt-footer-nav" aria-label="Conta">
            <Link href="/cadastro">Cadastrar</Link>
            <Link href="/login">Entrar</Link>
          </nav>
          <p className="mkt-footer-copy">
            © {new Date().getFullYear()} GoIndica. Comunidade de indicações
            locais.
          </p>
        </div>
      </footer>
    </div>
  );
}
