import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AlexaViewer from "../components/AlexaViewer";
import loadingSvg from "../assets/loader/loading.svg";
import DemoSection from "@/components/DemoSection";

/* ------------------------------------------------------------------ */
/*  Karma landing: giant condensed type, one electric-blue ink,        */
/*  white paper. The 3D device stays on the right and overlaps the     */
/*  stretched KARMA wordmark.                                          */
/*  Intro: model flies in from the top-left, then the rest fades in.   */
/*  Palette: ink/blue #1F44FF, paper #FFFFFF, tint #EEF1FF             */
/*  Type: Anton (display, uppercase) + Archivo (body)                  */
/* ------------------------------------------------------------------ */

type DemoState = "idle" | "listening" | "thinking" | "speaking";
type IntroPhase = "wait" | "fly" | "done";

interface DemoStep {
  state: DemoState;
  who: "You" | "Karma";
  text: string;
  ms: number;
}

const DEMO_SCRIPT: DemoStep[] = [
  {
    state: "listening",
    who: "You",
    text: "Book a table for four on Saturday at 8.",
    ms: 2400,
  },
  {
    state: "thinking",
    who: "Karma",
    text: "Checking places near you with a free table…",
    ms: 1600,
  },
  {
    state: "speaking",
    who: "Karma",
    text: "Done. Saffron has a table for four, Saturday at 8:00 pm. I added it to your calendar.",
    ms: 3600,
  },
];

interface UseCase {
  id: string;
  label: string;
  say: string;
  actions: string[];
  reply: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "dinner",
    label: "Plan dinner",
    say: "Book a table for four on Saturday at 8.",
    actions: [
      "Searched 12 restaurants",
      "Reserved at Saffron",
      "Added to calendar",
    ],
    reply:
      "Table for four at Saffron, Saturday 8:00 pm. I added it to your calendar.",
  },
  {
    id: "inbox",
    label: "Catch up on email",
    say: "What did I miss in my inbox this morning?",
    actions: [
      "Read 23 unread emails",
      "Grouped by sender",
      "Drafted 2 replies",
    ],
    reply:
      "Two need you: Priya’s contract and the venue invoice. I drafted replies to both.",
  },
  {
    id: "home",
    label: "Wind down",
    say: "I’m heading to bed. Lock up and wake me at 6:30.",
    actions: ["Lights off", "Front door locked", "Alarm set for 6:30"],
    reply:
      "Everything’s off and the door is locked. Alarm is set for 6:30. Good night.",
  },
  {
    id: "trip",
    label: "Move a flight",
    say: "Push my Friday flight to Sunday evening.",
    actions: [
      "Found 3 Sunday options",
      "Compared fare change",
      "Held the 6:10 pm seat",
    ],
    reply:
      "The 6:10 pm costs ₹1,800 more. I’m holding it for 10 minutes. Want me to book it?",
  },
];

const ABILITIES = [
  {
    title: "It remembers the conversation",
    body: "Say “make it Sunday instead” and Karma knows what “it” is. No repeating yourself, no magic phrases.",
  },
  {
    title: "It finishes the job",
    body: "Karma books, sends, sets and pays. One request can run across your calendar, email, home and bookings.",
  },
  {
    title: "It asks before it spends",
    body: "Anything that costs money or can’t be undone waits for a spoken yes from you.",
  },
  {
    title: "It works with what you use",
    body: "Connect Google, Outlook, Spotify, your smart home and more. You choose what Karma can see.",
  },
];

const STEPS = [
  {
    title: "Say it",
    body: "Talk the way you would to a person. Karma starts listening when you say its name or tap the device.",
  },
  {
    title: "Karma works",
    body: "It breaks your request into steps and does them across your connected apps.",
  },
  {
    title: "You confirm",
    body: "You hear a short summary and say yes, change it, or cancel.",
  },
];

const PRIVACY = [
  "Karma listens only after it hears its name or you tap the device.",
  "Audio is processed, then deleted. Transcripts are kept only if you turn that on.",
  "Say “delete what I just said” or clear everything from Settings, any time.",
];

const MENU_LINKS = [
  { label: "Examples", href: "#examples" },
  { label: "What it does", href: "#abilities" },
  { label: "How it works", href: "#how" },
  { label: "Privacy", href: "#privacy" },
  { label: "Demo", href: "#demo" },
];

/* ------------------------------------------------------------------ */
/*  FitWord: draws text as SVG and stretches the glyphs to fill the    */
/*  width of its container (the wordmark look). Height is set by the   */
/*  `height` prop; letters stretch horizontally to match.              */
/* ------------------------------------------------------------------ */
const FitWord: React.FC<{ text: string; height: string }> = ({
  text,
  height,
}) => {
  const [m, setM] = useState({
    x: 0,
    y: 88,
    w: 100 * text.length * 0.5,
    h: 88,
  });

  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      try {
        await document.fonts.load("100px Anton");
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      ctx.font = "100px Anton";
      const t = ctx.measureText(text);
      const w = t.actualBoundingBoxLeft + t.actualBoundingBoxRight;
      const h = t.actualBoundingBoxAscent + t.actualBoundingBoxDescent;
      if (w > 0 && h > 0)
        setM({
          x: t.actualBoundingBoxLeft,
          y: t.actualBoundingBoxAscent,
          w,
          h,
        });
    };
    measure();
    document.fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${m.w} ${m.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height }}
    >
      <text
        x={m.x}
        y={m.y}
        fontFamily="Anton, Impact, sans-serif"
        fontSize="100"
        fill="currentColor"
      >
        {text}
      </text>
    </svg>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const videoSectionRef = useRef<HTMLElement>(null);

  const scrollToDemo = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* ---------- intro: model flies in from the top-left ---------- */
  const stageRef = useRef<HTMLDivElement>(null);
  const [flyFrom, setFlyFrom] = useState("");
  const [phase, setPhase] = useState<IntroPhase>("wait");
  const done = phase === "done";

  // Work out the starting transform (top-left, small) before the first paint
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done"); // skip the animation entirely
      return;
    }
    window.scrollTo(0, 0);
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = 90 - (r.left + r.width / 2); // start centre: 90px from the left
    const dy = 130 - (r.top + r.height / 2); // start centre: 130px from the top
    setFlyFrom(`translate(${dx}px, ${dy}px) scale(0.3)`);
  }, []);

  // Start the flight once the model has loaded (with a fallback if it never does)
  useEffect(() => {
    if (phase !== "wait") return;
    const delay = modelLoaded ? 350 : 8000;
    const t = window.setTimeout(() => setPhase("fly"), delay);
    return () => window.clearTimeout(t);
  }, [modelLoaded, phase]);

  // Safety net: finish the intro even if transitionend never fires
  useEffect(() => {
    if (phase !== "fly") return;
    const t = window.setTimeout(() => setPhase("done"), 2200);
    return () => window.clearTimeout(t);
  }, [phase]);

  // No scrolling until the intro is finished
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  /* ---------- hero demo state machine ---------- */
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [caption, setCaption] = useState<DemoStep | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const runDemo = () => {
    clearTimers();
    let elapsed = 0;
    DEMO_SCRIPT.forEach((step) => {
      timers.current.push(
        window.setTimeout(() => {
          setDemoState(step.state);
          setCaption(step);
        }, elapsed),
      );
      elapsed += step.ms;
    });
    timers.current.push(window.setTimeout(() => setDemoState("idle"), elapsed));
  };

  useEffect(() => clearTimers, []);

  /* close the menu with Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- use-case picker ---------- */
  const [activeCase, setActiveCase] = useState(USE_CASES[0].id);
  const current = USE_CASES.find((u) => u.id === activeCase) ?? USE_CASES[0];

  const active = demoState !== "idle";
  const waving = demoState === "listening" || demoState === "speaking";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&display=swap');

        .kl { --c:#1F44FF; --p:#FFFFFF; --t:#EEF1FF;
              background:var(--p); color:var(--c); font-family:'Archivo',system-ui,sans-serif; font-weight:500; line-height:1.5; }
        .kl h1,.kl h2,.kl h3 { font-family:'Anton','Impact',sans-serif; font-weight:400; text-transform:uppercase; margin:0; line-height:.95; letter-spacing:.005em; }
        .kl p { margin:0; }
        .kl-wrap { max-width:1280px; margin:0 auto; padding:0 32px; }
        .kl-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
        .kl button:focus-visible, .kl a:focus-visible { outline:3px solid var(--c); outline-offset:4px; }

        /* intro reveal: content waits until the model has landed */
        .kl-reveal { opacity:0; transform:translateY(18px);
                     transition:opacity .7s ease, transform .8s cubic-bezier(.22,1,.36,1); }
        .kl-reveal.in { opacity:1; transform:none; }

        /* underlined text links */
        .kl-u { background:none; border:0; padding:0; font:700 15px 'Archivo',sans-serif; letter-spacing:.01em; color:inherit; text-transform:uppercase;
                text-decoration:underline; text-decoration-thickness:2px; text-underline-offset:5px; cursor:pointer; }
        .kl-u:hover { text-decoration-thickness:4px; }

        /* header */
        .kl-nav { position:fixed; top:0; left:0; right:0; height:64px; z-index:50; background:rgba(255,255,255,.9); backdrop-filter:blur(10px);
                  display:flex; align-items:center; justify-content:space-between; padding:0 32px; }
        .kl-brand { font-family:'Anton',sans-serif; font-size:32px; line-height:1; text-transform:uppercase; }
        .kl-nav-r { display:flex; align-items:center; gap:28px; }
        .kl-burger { background:none; border:0; padding:8px 0; display:flex; flex-direction:column; gap:8px; width:44px; cursor:pointer; }
        .kl-burger span { display:block; height:3px; background:var(--c); width:100%; }
        .kl-menu { position:fixed; inset:0; z-index:60; background:var(--c); color:#fff; padding:28px 32px 48px; display:flex; flex-direction:column;
                   opacity:0; visibility:hidden; transition:opacity .25s, visibility .25s; }
        .kl-menu.on { opacity:1; visibility:visible; }
        .kl-menu-top { display:flex; justify-content:space-between; align-items:center; }
        .kl-menu nav { margin-top:auto; display:flex; flex-direction:column; }
        .kl-menu nav a { font-family:'Anton',sans-serif; text-transform:uppercase; text-decoration:none; color:#fff; font-size:clamp(56px,11vw,150px); line-height:1; }
        .kl-menu nav a:hover { text-decoration:underline; text-decoration-thickness:6px; text-underline-offset:8px; }
        .kl-menu .kl-u, .kl-menu .kl-brand { color:#fff; }
        .kl-menu button:focus-visible, .kl-menu a:focus-visible { outline-color:#fff; }

        /* hero */
        .kl-hero { position:relative; min-height:max(100vh,720px); padding-top:64px; overflow:hidden; }
        .kl-intro { position:absolute; left:0; width:62%; top:max(15vh,112px); display:flex; flex-direction:column; align-items:center; text-align:center; gap:26px; z-index:2; padding:0 24px; }
        .kl-meta { display:flex; align-items:center; gap:18px; font-size:15px; font-weight:600; }
        .kl-flank { display:grid; grid-template-columns:auto minmax(0,580px) auto; align-items:center; gap:36px; justify-content:center; }
        .kl-flank small { font-size:13px; font-weight:700; text-transform:uppercase; }
        .kl-statement { font-size:clamp(24px,2.3vw,38px); font-weight:700; text-transform:uppercase; line-height:1.08; letter-spacing:-.015em; }
        .kl-sub { max-width:34em; font-size:16px; }
        .kl-links { display:flex; gap:28px; flex-wrap:wrap; justify-content:center; }

        .kl-stage { position:absolute; right:3vw; top:max(11vh,88px); width:min(44vw,700px); height:min(66vh,640px); z-index:3; cursor:pointer; }
        .kl-glow { position:absolute; inset:14% 8%; border-radius:50%; background:radial-gradient(closest-side, rgba(31,68,255,.28), transparent 70%);
                   opacity:0; transition:opacity .5s ease; pointer-events:none; }
        .kl-glow.on { opacity:1; animation:kl-breathe 1.6s ease-in-out infinite; }
        @keyframes kl-breathe { 50% { transform:scale(1.08); } }
        .kl-say { position:absolute; top:0; left:50%; transform:translateX(-50%); z-index:4; max-width:92%; width:max-content; text-align:center;
                  background:var(--c); color:#fff; border-radius:22px; padding:10px 20px; font-size:14px; font-weight:600; line-height:1.35; }
        .kl-say.idle { font-size:12px; letter-spacing:.06em; text-transform:uppercase; border-radius:999px; }
        .kl-wave { display:flex; justify-content:center; align-items:center; gap:3px; height:16px; margin-top:6px; }
        .kl-wave i { display:block; width:3px; height:4px; background:#fff; border-radius:2px; opacity:.5; }
        .kl-wave.on i { opacity:1; animation:kl-bar .9s ease-in-out infinite; }
        @keyframes kl-bar { 50% { height:15px; } }

        .kl-giant { position:absolute; left:2vw; right:2vw; bottom:2.5vh; margin:0; z-index:1; }

        @media (max-width:900px){
          .kl-hero { display:flex; flex-direction:column; min-height:0; padding-bottom:24px; }
          .kl-intro { position:static; width:100%; padding:40px 20px 0; }
          .kl-flank { grid-template-columns:1fr; gap:14px; }
          .kl-flank small { display:none; }
          .kl-stage { position:static; width:100%; height:48vh; margin-top:16px; }
          .kl-giant { position:static; margin:8px 3vw 0; }
          .kl-nav, .kl-menu { padding-left:20px; padding-right:20px; }
        }

        /* sections */
        .kl-section { padding:120px 0; border-top:2px solid var(--c); }
        .kl-h2 { font-size:clamp(52px,9vw,140px); max-width:11em; }
        .kl-lede { margin-top:20px; font-size:18px; max-width:32em; }

        /* use cases */
        .kl-cases { margin-top:56px; display:grid; grid-template-columns:1fr 1.25fr; gap:56px; align-items:start; }
        @media (max-width:900px){ .kl-cases{grid-template-columns:1fr; gap:32px;} }
        .kl-tabs { display:flex; flex-direction:column; }
        .kl-tab { text-align:left; padding:14px 18px; border:0; border-top:2px solid var(--c); background:transparent; color:var(--c);
                  font:400 clamp(30px,3.6vw,52px)/1 'Anton',sans-serif; text-transform:uppercase; cursor:pointer; }
        .kl-tab:last-child { border-bottom:2px solid var(--c); }
        .kl-tab:hover { background:var(--t); }
        .kl-tab[aria-selected="true"] { background:var(--c); color:#fff; }
        .kl-chat { border:2px solid var(--c); padding:32px; display:flex; flex-direction:column; gap:22px; min-height:360px; background:var(--t); }
        .kl-bubble-you { align-self:flex-end; background:var(--c); color:#fff; padding:14px 20px; border-radius:20px 20px 4px 20px; max-width:82%; font-size:17px; }
        .kl-actions { display:flex; flex-wrap:wrap; gap:8px; }
        .kl-chip { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:6px 12px; border:2px solid var(--c); border-radius:999px; background:var(--p); }
        .kl-bubble-ai { font-size:22px; font-weight:600; line-height:1.3; max-width:24em; }

        /* abilities */
        .kl-abilities { margin-top:64px; display:grid; grid-template-columns:1fr 1fr; gap:56px 64px; }
        @media (max-width:760px){ .kl-abilities{grid-template-columns:1fr;} }
        .kl-ability { border-top:2px solid var(--c); padding-top:20px; }
        .kl-ability h3 { font-size:clamp(32px,3.4vw,48px); }
        .kl-ability p { margin-top:12px; max-width:28em; }

        /* steps */
        .kl-steps { margin-top:64px; display:grid; grid-template-columns:repeat(3,1fr); gap:32px; }
        @media (max-width:820px){ .kl-steps{grid-template-columns:1fr;} }
        .kl-step { border-top:2px solid var(--c); padding-top:20px; }
        .kl-step h3 { font-size:clamp(36px,4vw,60px); }
        .kl-step p { margin-top:12px; }

        /* privacy */
        .kl-privacy { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:start; }
        @media (max-width:820px){ .kl-privacy{grid-template-columns:1fr;} }
        .kl-privacy ul { list-style:none; margin:0; padding:0; }
        .kl-privacy li { padding:22px 0; border-top:2px solid var(--c); font-size:19px; font-weight:600; }
        .kl-privacy li:last-child { border-bottom:2px solid var(--c); }

        /* final */
        .kl-final { background:var(--c); color:#fff; border-top:0; padding:96px 0 72px; }
        .kl-final .kl-lede { max-width:none; margin-top:28px; }
        .kl-final-row { margin-top:28px; display:flex; gap:28px; align-items:center; flex-wrap:wrap; }
        .kl-btn { background:#fff; color:var(--c); border:0; border-radius:6px; padding:16px 30px; font:700 16px 'Archivo',sans-serif; text-transform:uppercase; cursor:pointer; }
        .kl-btn:hover { transform:translateY(-2px); }
        .kl-final .kl-u { color:#fff; }
        .kl-final button:focus-visible { outline-color:#fff; }
        .kl-foot { background:var(--c); color:#fff; border-top:1px solid rgba(255,255,255,.35); padding:24px 0 36px; font-size:14px; }
        .kl-foot-in { display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; }

        @media (prefers-reduced-motion: reduce) {
          .kl *, .kl *::before, .kl *::after { animation:none !important; transition:none !important; }
          .kl-reveal { opacity:1; transform:none; }
        }
      `}</style>

      {/* Loading overlay */}
      {!modelLoaded && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            zIndex: 100,
          }}
        >
          <img
            src={loadingSvg}
            alt="Loading"
            style={{ width: 110, height: 110, objectFit: "contain" }}
          />
        </div>
      )}

      <div className="kl">
        {/* ---------- HEADER + MENU ---------- */}
        <header className={`kl-nav kl-reveal ${done ? "in" : ""}`}>
          <span className="kl-brand">Karma</span>
          <div className="kl-nav-r">
            <button
              type="button"
              className="kl-u"
              onClick={() => navigate("/signup")}
            >
              Sign up
            </button>
            <button
              type="button"
              className="kl-burger"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span />
              <span />
            </button>
          </div>
        </header>

        <div
          className={`kl-menu ${menuOpen ? "on" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div className="kl-menu-top">
            <span className="kl-brand">Karma</span>
            <button
              type="button"
              className="kl-u"
              onClick={() => setMenuOpen(false)}
              tabIndex={menuOpen ? 0 : -1}
            >
              Close
            </button>
          </div>
          <nav aria-label="Primary">
            {MENU_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>

        <main>
          {/* ---------- HERO ---------- */}
          <section className="kl-hero">
            <div
              className={`kl-intro kl-reveal ${done ? "in" : ""}`}
              style={{ transitionDelay: ".1s" }}
            >
              <div className="kl-meta">
                <span>Voice first</span>
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="15"
                    cy="15"
                    r="12"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <circle cx="15" cy="15" r="4" fill="currentColor" />
                </svg>
                <span>Works across your apps</span>
              </div>

              <div className="kl-flank">
                <small>Beta</small>
                <p className="kl-statement">
                  Say it once. Karma handles the rest.
                </p>
                <small>2026</small>
              </div>

              <p className="kl-sub">
                A voice agent that books, sends, sets and pays across your apps.
                You talk, it does the work.
              </p>

              <div className="kl-links">
                <button
                  type="button"
                  className="kl-u"
                  onClick={() => navigate("/signup")}
                >
                  Get Karma
                </button>
                <button type="button" className="kl-u" onClick={runDemo}>
                  Hear a demo
                </button>
                <button type="button" className="kl-u" onClick={scrollToDemo}>
                  Watch the shopping demo
                </button>
              </div>
            </div>

            {/* 3D device on the right: flies in first, then click to talk */}
            <div className="kl-stage" ref={stageRef} onClick={runDemo}>
              <div className={`kl-glow ${active ? "on" : ""}`} />
              <div
                className={`kl-say ${active ? "" : "idle"}`}
                aria-live="polite"
                style={{
                  opacity: done ? 1 : 0,
                  transition: "opacity .5s ease .2s",
                }}
              >
                {active && caption ? (
                  <>
                    {caption.who}: {caption.text}
                    <div
                      className={`kl-wave ${waving ? "on" : ""}`}
                      aria-hidden="true"
                    >
                      {Array.from({ length: 14 }).map((_, i) => (
                        <i
                          key={i}
                          style={{ animationDelay: `${(i % 7) * 0.09}s` }}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  "Tap the device to talk"
                )}
              </div>

              <div
                onTransitionEnd={(e) => {
                  if (
                    e.propertyName === "transform" &&
                    e.target === e.currentTarget
                  )
                    setPhase("done");
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  transform: phase === "wait" ? flyFrom : "none",
                  opacity: phase === "wait" ? 0 : 1,
                  transition:
                    phase === "wait"
                      ? "none"
                      : "transform 1.5s cubic-bezier(.22,1,.36,1), opacity .4s ease",
                }}
              >
                <AlexaViewer
                  onLoad={() => setModelLoaded(true)}
                  onClick={runDemo}
                />
              </div>
            </div>

            {/* Stretched wordmark behind the device */}
            <h1
              className={`kl-giant kl-reveal ${done ? "in" : ""}`}
              style={{ transitionDelay: ".3s" }}
            >
              <span className="kl-sr">Karma</span>
              <FitWord text="KARMA" height="min(46vh, 30vw)" />
            </h1>
          </section>

          {/* ---------- USE CASES ---------- */}
          <section className="kl-section" id="examples">
            <div className="kl-wrap">
              <h2 className="kl-h2">Ask for the outcome, not the steps</h2>
              <p className="kl-lede">
                Pick a request to see what Karma does with it.
              </p>

              <div className="kl-cases">
                <div
                  className="kl-tabs"
                  role="tablist"
                  aria-label="Example requests"
                >
                  {USE_CASES.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="tab"
                      aria-selected={u.id === activeCase}
                      className="kl-tab"
                      onClick={() => setActiveCase(u.id)}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>

                <div className="kl-chat" role="tabpanel" key={current.id}>
                  <div className="kl-bubble-you">{current.say}</div>
                  <div className="kl-actions">
                    {current.actions.map((a) => (
                      <span className="kl-chip" key={a}>
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="kl-bubble-ai">{current.reply}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- ABILITIES ---------- */}
          <section className="kl-section" id="abilities">
            <div className="kl-wrap">
              <h2 className="kl-h2">More conversation, less commands</h2>
              <div className="kl-abilities">
                {ABILITIES.map((a) => (
                  <div className="kl-ability" key={a.title}>
                    <h3>{a.title}</h3>
                    <p>{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- HOW IT WORKS ---------- */}
          <section className="kl-section" id="how">
            <div className="kl-wrap">
              <h2 className="kl-h2">Three moments, start to finish</h2>
              <div className="kl-steps">
                {STEPS.map((s) => (
                  <div className="kl-step" key={s.title}>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- PRIVACY ---------- */}
          <section className="kl-section" id="privacy">
            <div className="kl-wrap kl-privacy">
              <div>
                <h2 className="kl-h2">You decide what Karma hears</h2>
                <p className="kl-lede">
                  A microphone in your home should come with clear rules. These
                  are ours.
                </p>
                <div style={{ marginTop: 28 }}>
                  <button
                    type="button"
                    className="kl-u"
                    onClick={() => navigate("/privacy")}
                  >
                    Read the privacy details
                  </button>
                </div>
              </div>
              <ul>
                {PRIVACY.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- SHOPPING DEMO VIDEO ---------- */}
          <DemoSection sectionRef={videoSectionRef} />

          {/* ---------- FINAL CTA ---------- */}
          <section className="kl-final">
            <div className="kl-wrap">
              <FitWord text="TRY KARMA" height="min(26vh, 17vw)" />
              <p className="kl-lede">
                Free to start. Connect your first app in two minutes.
              </p>
              <div className="kl-final-row">
                <button
                  type="button"
                  className="kl-btn"
                  onClick={() => navigate("/signup")}
                >
                  Get Karma
                </button>
                <button type="button" className="kl-u" onClick={runDemo}>
                  Hear a demo
                </button>
              </div>
            </div>
          </section>
        </main>

        <footer className="kl-foot">
          <div className="kl-wrap kl-foot-in">
            <span>© 2026 Karma</span>
            <span>Privacy · Terms · Contact</span>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;
