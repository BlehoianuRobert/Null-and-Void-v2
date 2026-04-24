"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ─── Icons (inline SVG) ──────────────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function IconArrowRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Radar Visualization ─────────────────────────────────────────────────────

function RadarViz({ size = 340 }) {
  const rings = [size * 0.94, size * 0.7, size * 0.48, size * 0.26];
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background with grid */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(29,158,117,0.06) 0%, transparent 70%),
            linear-gradient(rgba(29,158,117,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,158,117,0.07) 1px, transparent 1px)
          `,
          backgroundSize: `100% 100%, 28px 28px, 28px 28px`,
          border: "1px solid rgba(29,158,117,0.2)",
        }}
      />
      {/* Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-px bg-[#1D9E75]/12" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-px h-full bg-[#1D9E75]/12" />
      </div>
      {/* Diagonal crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
        <div className="w-full h-px bg-[#1D9E75]/06" style={{ transform: "rotate(45deg)" }} />
        <div className="absolute w-full h-px bg-[#1D9E75]/06" style={{ transform: "rotate(-45deg)" }} />
      </div>
      {/* Static rings */}
      {rings.map((s, i) => (
        <div key={i} className="absolute rounded-full border border-[#1D9E75]/18" style={{ width: s, height: s }} />
      ))}
      {/* Radar sweep */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          animation: "scan-line 4s linear infinite",
          background: "conic-gradient(from 0deg, rgba(29,158,117,0.30) 0deg, rgba(29,158,117,0.07) 50deg, transparent 50deg)",
        }}
      />
      {/* Expanding ping rings */}
      {[0, 1.2, 2.4].map((delay, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-[#1D9E75]"
          style={{ width: size * 0.24, height: size * 0.24, animation: `radar-ring 3.6s ease-out ${delay}s infinite` }}
        />
      ))}
      {/* Obstacle dots */}
      <div className="absolute w-3 h-3 rounded-full bg-amber-400" style={{ top: "18%", left: "67%", boxShadow: "0 0 10px #f59e0b, 0 0 20px #f59e0b55" }} />
      <div className="absolute w-2.5 h-2.5 rounded-full bg-red-400" style={{ top: "61%", left: "22%", boxShadow: "0 0 10px #f87171, 0 0 20px #f8717155" }} />
      <div className="absolute w-2 h-2 rounded-full bg-emerald-400" style={{ top: "33%", left: "37%", boxShadow: "0 0 8px #34d39980" }} />
      <div className="absolute w-2 h-2 rounded-full bg-amber-300" style={{ top: "72%", left: "64%", boxShadow: "0 0 8px #fcd34d80" }} />
      {/* Compass labels */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-[#1D9E75]/40 font-mono">N</div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-[#1D9E75]/40 font-mono">S</div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#1D9E75]/40 font-mono">E</div>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#1D9E75]/40 font-mono">W</div>
      {/* Distance labels */}
      {["1m", "2m", "3m"].map((label, i) => (
        <div key={i} className="absolute text-[9px] text-[#1D9E75]/30 font-mono" style={{ left: "52%", top: `${50 - (i + 1) * 14}%` }}>
          {label}
        </div>
      ))}
      {/* Center sensor */}
      <div
        className="relative w-5 h-5 rounded-full bg-[#1D9E75] z-10"
        style={{ animation: "glow-pulse 2s ease-in-out infinite", boxShadow: "0 0 20px #1D9E75, 0 0 40px #1D9E7555" }}
      />
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ scrolled }) {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(6,10,15,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(29,158,117,0.15)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#1D9E75]"
            style={{ background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.35)" }}
          >
            <IconEye />
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">BlindHat</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "#features" },
            { label: "Platform", href: "#platform" },
            { label: "Pros & Cons", href: "#tradeoffs" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Hardware", href: "#hardware" },
            { label: "Gallery", href: "#gallery" },
          ].map((item) => (
            <a key={item.label} href={item.href} className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
              {item.label}
            </a>
          ))}
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #1D9E75, #0f7a5a)",
            boxShadow: "0 0 16px rgba(29,158,117,0.35)",
          }}
        >
          Sign In
          <IconArrowRight />
        </Link>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(29,158,117,0.09) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(14,165,233,0.05) 0%, transparent 50%)",
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(29,158,117,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(29,158,117,0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          animation: "grid-pulse 4s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Text */}
        <div style={{ animation: "fade-in-up 0.8s ease both" }}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[#1D9E75] text-xs font-semibold tracking-wide mb-6"
            style={{ border: "1px solid rgba(29,158,117,0.3)", background: "rgba(29,158,117,0.1)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }} />
            Advanced Assistive Technology
          </div>

          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            <span className="text-white">Intelligent</span>
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #1D9E75 0%, #22d3a3 50%, #0ea5e9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Navigation
            </span>
            <br />
            <span className="text-white">for the Visually</span>
            <br />
            <span className="text-slate-400">Impaired</span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
            BlindHat pairs a smart hat (ultrasonic + IMU on ESP32) with a <strong className="text-slate-300">caregiver web platform</strong>,{" "}
            <strong className="text-slate-300">MQTT + Docker</strong> ingestion, and an <strong className="text-slate-300">Android safety app</strong> for phone GPS and motion checks — so families can see distance, location, and “possible accident” hints in one place.
          </p>

          <div className="flex flex-wrap gap-4 mb-8">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #1D9E75, #0f7a5a)",
                boxShadow: "0 0 30px rgba(29,158,117,0.4)",
              }}
            >
              Sign In to Dashboard
              <IconArrowRight />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-300 transition-all duration-200 hover:text-white hover:border-[#1D9E75]/50"
              style={{ border: "1px solid rgba(51,65,85,0.8)" }}
            >
              Explore Features
              <IconArrowDown />
            </a>
          </div>

          {/* Tech badges */}
          <div className="flex flex-wrap gap-2">
            {["ESP32-C6", "HC-SR04", "MPU6050", "MQTT", "Docker", "Next.js", "Expo Android"].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 rounded-md text-xs font-mono text-slate-500"
                style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(15,23,42,0.6)" }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Radar */}
        <div className="flex items-center justify-center" style={{ animation: "fade-in-up 0.8s ease 0.2s both" }}>
          <div className="relative">
            {/* Outer glow */}
            <div
              className="absolute -inset-10 rounded-full opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, #1D9E75 0%, transparent 70%)", animation: "glow-pulse 3s ease-in-out infinite" }}
            />
            <RadarViz size={380} />

            {/* Floating alert card */}
            <div
              className="absolute -bottom-4 -left-10 rounded-xl px-4 py-3 text-xs"
              style={{
                background: "rgba(15,23,42,0.92)",
                border: "1px solid rgba(51,65,85,0.6)",
                backdropFilter: "blur(12px)",
                animation: "float-gentle 5s ease-in-out infinite",
              }}
            >
              <div className="text-[#1D9E75] font-semibold mb-0.5">Obstacle Detected</div>
              <div className="text-slate-300">Distance: <span className="text-white font-mono font-bold">38 cm</span></div>
              <div className="text-slate-400">Severity: <span className="text-red-400 font-bold">CRITICAL</span></div>
            </div>

            {/* Floating status card */}
            <div
              className="absolute -top-2 -right-8 rounded-xl px-4 py-3 text-xs"
              style={{
                background: "rgba(15,23,42,0.92)",
                border: "1px solid rgba(51,65,85,0.6)",
                backdropFilter: "blur(12px)",
                animation: "float-gentle 6s ease-in-out 1.5s infinite",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#1D9E75]" style={{ animation: "glow-pulse 1.5s infinite" }} />
                <span className="text-[#1D9E75] font-semibold">Device Online</span>
              </div>
              <div className="text-slate-400">Battery: <span className="text-white font-mono">87%</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        style={{ animation: "fade-in 1s ease 1s both" }}
      >
        <span className="text-slate-600 text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-[#1D9E75] to-transparent" style={{ animation: "float-gentle 2s ease-in-out infinite" }} />
      </div>
    </section>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: "50 cm", label: "Critical Alert Zone" },
    { value: "MQTT", label: "Hat → Mosquitto → API" },
    { value: "MAC", label: "Device id = ESP Wi‑Fi MAC" },
    { value: "GPS + IMU", label: "Phone Track app" },
  ];
  return (
    <section
      className="py-12 border-y"
      style={{ background: "rgba(13,20,36,0.85)", borderColor: "rgba(51,65,85,0.4)" }}
    >
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="animate-on-scroll text-center"
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="text-3xl font-extrabold text-white mb-1">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "On-hat sensing",
    desc: "HC-SR04 distance and MPU6050 motion on the ESP32 drive local buzzer feedback and publish readings over MQTT (e.g. senzor/distanta) to your Mosquitto broker — same LAN or server as the rest of the stack.",
    color: "#1D9E75",
    iconBg: "rgba(29,158,117,0.12)",
    iconBorder: "rgba(29,158,117,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M8 9l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 4v16M17 7v10M13 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "MAC = device identity",
    desc: "In My users, caregivers register each hat with the ESP32 Wi‑Fi MAC as the device serial. The platform stores distance, last seen, and battery under that device — tied to the right blind user automatically.",
    color: "#0ea5e9",
    iconBg: "rgba(14,165,233,0.12)",
    iconBorder: "rgba(14,165,233,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "MQTT → REST bridge",
    desc: "The mqtt-worker service subscribes to Mosquitto, then POSTs telemetry to /api/devices/<serial>/telemetry using a shared DEVICE_API_KEY. Set DEVICE_SERIAL on the worker to the same MAC you registered — that’s how hat traffic maps to the correct patient row.",
    color: "#a855f7",
    iconBg: "rgba(168,85,247,0.12)",
    iconBorder: "rgba(168,85,247,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M4 12h4l2-6 4 12 2-6h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Caregiver web app",
    desc: "Dashboard shows ESP last distance, last seen, and phone ping times. Map tracking plots each patient’s latest GPS with auto-refresh and minutes since last update. Motion alerts list phone accelerometer “possible accident” events (heuristic, not medical).",
    color: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    iconBorder: "rgba(245,158,11,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Android Track app",
    desc: "Expo app (Track tab) sends foreground GPS to the same API as MQTT phone/location. While tracking, it runs accelerometer heuristics for sudden impacts / possible falls, posts to /api/phone/motion, and offers an “I’m OK” snooze. My users shows each patient’s ID and server URL/key hints for setup.",
    color: "#22c55e",
    iconBg: "rgba(34,197,94,0.12)",
    iconBorder: "rgba(34,197,94,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Docker deployment",
    desc: "docker-compose runs PostgreSQL, Prisma migrations + seed, Next.js web, Eclipse Mosquitto, and the mqtt-worker — ready for a home server, Pi, or Portainer stack on the same network as your ESP32 and phones.",
    color: "#94a3b8",
    iconBg: "rgba(148,163,184,0.12)",
    iconBorder: "rgba(148,163,184,0.3)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            Core Capabilities
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">Built for the Real World</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            From the hat on the head to the caregiver browser and the companion phone — one stack for sensing, identity, and peace of mind.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="animate-on-scroll rounded-2xl p-8 group transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(13,20,36,0.9)",
                border: "1px solid rgba(51,65,85,0.5)",
                transitionDelay: `${i * 100}ms`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.border = `1px solid ${f.color}40`)}
              onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid rgba(51,65,85,0.5)")}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{ background: f.iconBg, border: `1px solid ${f.iconBorder}`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Platform (what we shipped) ─────────────────────────────────────────────

function PlatformSection() {
  const bullets = [
    {
      title: "Patients & hats",
      body: "Caregivers add blind users under My users and register each ESP32 hat using its Wi‑Fi MAC. That MAC is the device serial in PostgreSQL — so every distance sample and “last seen” belongs to the correct person.",
    },
    {
      title: "Same network, simple routing",
      body: "ESP32, Raspberry Pi / Mosquitto, laptop (Next.js), and phones can share one LAN. The mqtt-worker points at your web API (APP_BASE_URL) and uses DEVICE_SERIAL equal to the registered MAC so MQTT topics map cleanly to REST.",
    },
    {
      title: "Phone side",
      body: "The Android Track app sends GPS to /api/phone/location and optional motion events to /api/phone/motion. The Pi can also publish JSON on MQTT topics phone/location and phone/motion — the worker forwards both to the same APIs.",
    },
    {
      title: "Caregiver visibility",
      body: "Dashboard summarizes ESP telemetry and phone pings. Map tracking shows live markers with time-since-update. A motion table lists accelerometer-based alerts for follow-up (not a certified medical device).",
    },
  ];
  return (
    <section
      id="platform"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)", background: "rgba(13,20,36,0.45)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            What we built
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">Caregiver platform & connectivity</h2>
          <p className="text-slate-400 max-w-3xl mx-auto text-sm leading-relaxed">
            BlindHat is not only the hat firmware — it is a full loop: MQTT ingestion, secure device APIs, caregiver UI,
            optional Docker deployment, and an Android companion for location plus motion heuristics. Sign in to try
            My users, the map, and the dashboards against your own stack.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {bullets.map((b, i) => (
            <div
              key={i}
              className="animate-on-scroll rounded-2xl p-6"
              style={{
                background: "rgba(13,20,36,0.92)",
                border: "1px solid rgba(51,65,85,0.55)",
                transitionDelay: `${i * 70}ms`,
              }}
            >
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold text-[#060a0f]"
                  style={{ background: "linear-gradient(135deg, #1D9E75, #0f7a5a)" }}
                >
                  {i + 1}
                </span>
                {b.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-10 animate-on-scroll rounded-2xl p-6 text-center"
          style={{ border: "1px dashed rgba(29,158,117,0.35)", background: "rgba(29,158,117,0.06)" }}
        >
          <p className="text-slate-300 text-sm">
            <span className="font-semibold text-[#1D9E75]">Tip:</span> after signing in, open{" "}
            <span className="font-mono text-slate-200">/caregiver/my-users</span> for MAC registration & patient IDs,{" "}
            <span className="font-mono text-slate-200">/caregiver/map</span> for live GPS, and{" "}
            <span className="font-mono text-slate-200">/caregiver/dashboard</span> for ESP + phone + motion summaries.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Pros / Cons / Best Scenario ─────────────────────────────────────────────

function TradeoffsSection() {
  const pros = [
    "Caregiver does not need to stay physically next to the blind person all day.",
    "Live map + distance telemetry improve awareness and faster check-ins.",
    "Phone fallback path can keep reporting even when hat-to-server connectivity is unstable.",
    "One dashboard combines hat telemetry, location history, and impact alerts.",
  ];

  const cons = [
    "High data traffic when location is sent frequently (battery + mobile data cost).",
    "Reliability depends on network quality (Wi-Fi / hotspot / internet path).",
    "GPS and accelerometer heuristics can produce noisy or false-positive events.",
    "More moving parts (ESP, phone app, MQTT, API) means more deployment complexity.",
  ];

  return (
    <section
      id="tradeoffs"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)", background: "rgba(10,15,26,0.55)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            System Reality Check
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">Pros, Cons, and Best Scenario</h2>
          <p className="text-slate-400 max-w-3xl mx-auto text-sm leading-relaxed">
            BlindHat brings strong caregiver visibility, but network design matters. The architecture below is the
            most robust option for real-life movement outside a single home LAN.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div
            className="animate-on-scroll rounded-2xl p-7"
            style={{ background: "rgba(13,20,36,0.92)", border: "1px solid rgba(29,158,117,0.35)" }}
          >
            <h3 className="text-xl font-bold text-white mb-4">Pros</h3>
            <ul className="space-y-3">
              {pros.map((item, i) => (
                <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D9E75]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="animate-on-scroll rounded-2xl p-7"
            style={{ background: "rgba(13,20,36,0.92)", border: "1px solid rgba(245,158,11,0.35)" }}
          >
            <h3 className="text-xl font-bold text-white mb-4">Cons</h3>
            <ul className="space-y-3">
              {cons.map((item, i) => (
                <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-8 animate-on-scroll rounded-2xl p-7"
          style={{ border: "1px dashed rgba(14,165,233,0.45)", background: "rgba(14,165,233,0.07)" }}
        >
          <h3 className="text-xl font-bold text-white mb-3">Best scenario (recommended)</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Use the phone as the connectivity bridge: <span className="font-semibold text-slate-100">ESP sends data to
            the phone</span>, then the <span className="font-semibold text-slate-100">phone sends to the main server API</span>.
            This avoids dependence on the hat reaching the Pi directly over hotspot routing. Expose the Pi/API through
            a secure public entry point (for example a Cloudflare Tunnel) so the phone can always push telemetry when
            mobile internet is available.
          </p>
          <div className="mt-3 text-xs text-slate-400 font-mono">
            ESP sensor {"->"} Phone app relay {"->"} Cloudflare Tunnel / public API {"->"} Main server (Pi/PostgreSQL)
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

const GALLERY_SLOTS = [
  { label: "Hardware Build", sub: "Prototype Photo", src: "/images/poza1.jpeg" },
  { label: "Hardware Build", sub: "Prototype Photo", src: "/images/poza2.jpeg" },
  { label: "MPU6050 Module", sub: "6-Axis IMU", src: null },
  { label: "Hat Assembly", sub: "Complete Hardware", src: null },
  { label: "Live Dashboard", sub: "Caregiver Interface", src: null },
  { label: "Full System", sub: "IoT Architecture", src: null },
];

function GallerySection() {
  return (
    <section
      id="gallery"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            Hardware & Software
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">See It In Action</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            A look at the physical components and the monitoring platform that powers the Digital Twin Hat.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {GALLERY_SLOTS.map((slot, i) => (
            <div
              key={i}
              className="animate-on-scroll group relative rounded-2xl overflow-hidden aspect-video flex flex-col items-center justify-center transition-all duration-300 cursor-default"
              style={{
                background: "rgba(13,20,36,0.9)",
                border: "1px solid rgba(51,65,85,0.5)",
                transitionDelay: `${i * 70}ms`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid rgba(29,158,117,0.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid rgba(51,65,85,0.5)")}
            >
              {slot.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.src} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8))" }}
                  />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-slate-700 mb-2 relative z-10 group-hover:text-[#1D9E75]/50 transition-colors duration-300">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="relative z-10 text-center px-4">
                    <div className="text-sm font-semibold text-slate-400 group-hover:text-white transition-colors duration-300">{slot.label}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{slot.sub}</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Sensors Read",
    desc: "The ESP32-C6 reads HC-SR04 distance and MPU6050 acceleration data every 500 ms and activates the buzzer if under 50 cm.",
    color: "#1D9E75",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "MQTT Publish",
    desc: "Values are published to senzor/distanta and senzor/acceleratie over Wi-Fi 6 to a Mosquitto broker.",
    color: "#0ea5e9",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Ingest & evaluate",
    desc: "The mqtt-worker forwards payloads to the Next.js REST API (/api/devices/<MAC>/telemetry) using DEVICE_API_KEY. PostgreSQL + Prisma store readings, thresholds (CRITICAL / NEAR / MEDIUM), and caregiver notifications for in-app follow-up.",
    color: "#a855f7",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 21h8M12 17v4M7 8h10M7 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Caregiver visibility",
    desc: "Caregivers sign in to see assigned patients, ESP last distance, phone GPS on the map (with minutes since last ping), and motion-alert rows from the Android app or MQTT phone/motion.",
    color: "#f59e0b",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)", background: "rgba(10,15,26,0.6)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            System Architecture
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">How It Works</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            From raw sensor data to caregiver notification in under 500 milliseconds.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 relative">
          {/* Connecting line */}
          <div
            className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px"
            style={{ background: "linear-gradient(to right, #1D9E75, #0ea5e9, #a855f7, #f59e0b)", opacity: 0.25 }}
          />
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="animate-on-scroll flex flex-col items-center text-center"
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-5 z-10"
                style={{
                  background: `${s.color}14`,
                  border: `2px solid ${s.color}38`,
                  color: s.color,
                  boxShadow: `0 0 24px ${s.color}18`,
                }}
              >
                {s.icon}
                <div
                  className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                  style={{ background: s.color, boxShadow: `0 0 10px ${s.color}80` }}
                >
                  {i + 1}
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Tech Stack ───────────────────────────────────────────────────────────────

function TechStackSection() {
  const hardware = [
    { name: "ESP32-C6", role: "Main MCU — Wi-Fi 6, MQTT publisher" },
    { name: "HC-SR04", role: "Ultrasonic distance sensor, up to 4 m" },
    { name: "MPU6050", role: "6-axis gyroscope + accelerometer (I²C)" },
    { name: "Raspberry Pi 5", role: "Future AI + sensor fusion hub" },
    { name: "Passive Buzzer", role: "Auditory proximity feedback" },
  ];
  const software = [
    { name: "Next.js 14", role: "React framework, App Router, caregiver + admin routes" },
    { name: "PostgreSQL 16", role: "Devices, patients, location pings, motion alerts" },
    { name: "Prisma ORM", role: "Type-safe database client & migrations" },
    { name: "Docker Compose", role: "Web, db, migrate, Mosquitto, mqtt-worker" },
    { name: "MQTT / Mosquitto", role: "Hat topics + phone/location + phone/motion" },
    { name: "NextAuth.js", role: "Caregiver & admin sign-in" },
    { name: "Leaflet Maps", role: "Caregiver map with live refresh" },
    { name: "Expo (Android)", role: "Track app — GPS + accelerometer safety" },
  ];

  return (
    <section
      id="hardware"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-on-scroll">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-slate-400 text-xs font-semibold tracking-wide mb-4"
            style={{ border: "1px solid rgba(51,65,85,0.7)", background: "rgba(30,41,59,0.5)" }}
          >
            Technology Stack
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">Hardware & Software</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Production-grade components on both the physical and digital layers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            {
              label: "Hardware",
              items: hardware,
              accentColor: "#1D9E75",
              iconBg: "rgba(29,158,117,0.15)",
              iconBorder: "rgba(29,158,117,0.3)",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                  <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
                  <path d="M4 9H2M4 15H2M20 9h2M20 15h2M9 4V2M15 4V2M9 20v2M15 20v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              label: "Software",
              items: software,
              accentColor: "#0ea5e9",
              iconBg: "rgba(14,165,233,0.15)",
              iconBorder: "rgba(14,165,233,0.3)",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
          ].map((col, ci) => (
            <div
              key={ci}
              className="animate-on-scroll rounded-2xl p-8"
              style={{
                background: "rgba(13,20,36,0.9)",
                border: "1px solid rgba(51,65,85,0.5)",
                transitionDelay: `${ci * 150}ms`,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: col.iconBg, border: `1px solid ${col.iconBorder}`, color: col.accentColor }}
                >
                  {col.icon}
                </div>
                <h3 className="text-xl font-bold text-white">{col.label}</h3>
              </div>
              <div className="space-y-0">
                {col.items.map((item, ii) => (
                  <div
                    key={ii}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: ii < col.items.length - 1 ? "1px solid rgba(51,65,85,0.4)" : "none" }}
                  >
                    <span className="text-sm font-semibold font-mono" style={{ color: col.accentColor }}>{item.name}</span>
                    <span className="text-xs text-slate-400 text-right max-w-[58%]">{item.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ─────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)" }}
    >
      <div className="max-w-4xl mx-auto text-center animate-on-scroll">
        <div
          className="rounded-3xl p-14 relative overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(29,158,117,0.18) 0%, rgba(13,20,36,0.95) 65%)",
            border: "1px solid rgba(29,158,117,0.25)",
          }}
        >
          {/* Decorative rings */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none" style={{ border: "1px solid rgba(29,158,117,0.1)" }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none" style={{ border: "1px solid rgba(29,158,117,0.06)" }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[#1D9E75] text-xs font-semibold tracking-wide mb-6"
              style={{ border: "1px solid rgba(29,158,117,0.35)", background: "rgba(29,158,117,0.1)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }} />
              Dashboard Access
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">Ready to Monitor?</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
              Sign in to assign patients, register hat MACs, watch MQTT-fed distance on the dashboard, open the live map
              for phone GPS, and review motion hints from the Android Track app — all in one BlindHat deployment.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-xl text-base font-extrabold text-white transition-all duration-200 hover:scale-105 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #1D9E75, #0f7a5a)",
                boxShadow: "0 0 50px rgba(29,158,117,0.5), 0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              Sign In to Dashboard
              <IconArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-8 px-6"
      style={{ borderTop: "1px solid rgba(51,65,85,0.4)" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1D9E75]"
            style={{ background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm">BlindHat</span>
          <span className="text-slate-700 text-xs hidden sm:inline">— Digital Twin Navigation System</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Features</a>
          <a href="#platform" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Platform</a>
          <a href="#how-it-works" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">How It Works</a>
          <a href="#hardware" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Hardware</a>
          <Link href="/login" className="text-slate-600 hover:text-[#1D9E75] text-xs transition-colors">Sign In</Link>
        </div>
        <div className="text-slate-700 text-xs">
          Next.js · PostgreSQL · MQTT · ESP32-C6
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#060a0f] text-white overflow-x-hidden">
      <Navbar scrolled={scrolled} />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <PlatformSection />
      <TradeoffsSection />
      <GallerySection />
      <HowItWorksSection />
      <TechStackSection />
      <CTASection />
      <Footer />
    </div>
  );
}
