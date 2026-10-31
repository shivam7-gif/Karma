import React, { useEffect, useRef, useState } from "react";

interface DemoSectionProps {
  sectionRef?: React.Ref<HTMLElement>;
}

const DemoSection: React.FC<DemoSectionProps> = ({ sectionRef }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  // Load (and so start) the demo only when it is mostly on screen
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="demo"
      style={{
        width: "100%",
        padding: "96px 24px",
        background: "linear-gradient(180deg, #FAF9F7 0%, #F3F1FF 100%)",
        borderTop: "1px solid #E6E7EC",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#111114",
          }}
        >
          Watch Karma shop for you
        </h2>
        <p
          style={{
            margin: "14px 0 40px",
            fontSize: 18,
            color: "#6B7280",
            maxWidth: 560,
          }}
        >
          One request. Karma searches, compares, fills the cart and waits for
          your approval before it pays.
        </p>

        <div
          ref={stageRef}
          style={{
            aspectRatio: "16 / 9",
            width: "100%",
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #E6E7EC",
            background: "#fff",
            boxShadow: "0 24px 60px rgba(60, 50, 150, 0.12)",
          }}
        >
          {started && (
            <iframe
              src="/demo/karma-demo.html"
              title="Karma shopping agent demo"
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
