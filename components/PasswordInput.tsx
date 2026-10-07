"use client";
// Campo de senha com olho: pisca, segue o ponteiro e revela embaralhando o texto (GSAP MorphSVG + ScrambleText).
import { useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { cx, inputCls } from "@/components/ui";

gsap.registerPlugin(MorphSVGPlugin, ScrambleTextPlugin);

const UP = "M1 12C1 12 5 4 12 4C19 4 23 12 23 12";
const LOW = "M1 12C1 12 5 20 12 20C19 20 23 12 23 12";
const OPEN = "M1 12C1 12 5 4 12 4C19 4 23 12 23 12V20H12H1V12Z";
const SHUT = "M1 12C1 12 5 20 12 20C19 20 23 12 23 12V20H12H1V12Z";
const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`~,.<>?/;\":][}{+_)(*&^%$#@!±=-§";
const BLINK = 0.075;
const TOGGLE = 0.125;
const SCRAMBLE = 1;

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { onValue?: (v: string) => void };

export function PasswordInput({ onValue, className, ...p }: Props) {
  const mask = `eye${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const input = useRef<HTMLInputElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const blink = useRef<gsap.core.Timeline | null>(null);
  const loop = useRef<() => void>(() => {});
  const busy = useRef(false);
  const [shown, setShown] = useState(false);
  const [type, setType] = useState<"password" | "text">("password");

  function lids(tl: gsap.core.Timeline, lid: string, m: string, duration: number) {
    const s = svg.current!;
    return tl
      .to(s.querySelector(".lid-up"), { morphSVG: lid, duration })
      .to(s.querySelector(".lid-mask"), { morphSVG: m, duration }, 0);
  }

  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    loop.current = () => {
      if (still) return;
      blink.current = gsap.timeline({
        delay: gsap.utils.random(2, 8),
        repeat: Math.random() > 0.5 ? 3 : 1,
        yoyo: true,
        onComplete: () => loop.current(),
      });
      lids(blink.current, LOW, SHUT, BLINK);
    };
    loop.current();

    const eye = svg.current!.querySelector(".eye")!;
    const map = gsap.utils.mapRange(-100, 100, 30, -30);
    const clamp = gsap.utils.clamp(-30, 30);
    let reset: gsap.core.Tween | undefined;
    const move = ({ x, y }: PointerEvent) => {
      reset?.kill();
      reset = gsap.delayedCall(2, () => {
        gsap.to(eye, { xPercent: 0, yPercent: 0, duration: 0.2 });
      });
      const b = eye.getBoundingClientRect();
      gsap.set(eye, { xPercent: clamp(map(b.x - x)), yPercent: clamp(map(b.y - y)) });
    };
    if (!still) addEventListener("pointermove", move);
    return () => {
      blink.current?.kill();
      reset?.kill();
      removeEventListener("pointermove", move);
    };
  }, []);

  function toggle() {
    const el = input.current!;
    if (busy.current) return;
    busy.current = true;
    const val = el.value;
    const reveal = !shown;
    const proxy = document.createElement("div");
    const typed = () => proxy.textContent ?? "";
    setShown(reveal);
    // Durante a animação o valor visível é falso: não deixa digitar nem enviar.
    el.readOnly = true;
    const tl = gsap.timeline({
      onComplete: () => {
        el.readOnly = false;
        busy.current = false;
        if (!reveal) loop.current();
      },
    });

    if (reveal) {
      blink.current?.kill();
      lids(tl, LOW, SHUT, TOGGLE);
      setType("text");
      tl.to(proxy, {
        duration: SCRAMBLE,
        scrambleText: { chars: CHARS, text: val },
        onUpdate: () => { el.value = typed() + "•".repeat(Math.max(0, val.length - typed().length)); },
        onComplete: () => { el.value = val; },
      }, 0);
    } else {
      lids(tl, UP, OPEN, TOGGLE);
      tl.to(proxy, {
        duration: SCRAMBLE,
        scrambleText: { chars: CHARS, text: "•".repeat(val.length) },
        onUpdate: () => { el.value = typed() + val.slice(typed().length); },
        onComplete: () => { setType("password"); el.value = val; },
      }, 0);
    }
  }

  return (
    <div className="group relative">
      <input
        ref={input}
        {...p}
        type={type}
        onInput={(e) => onValue?.(e.currentTarget.value)}
        className={cx(inputCls, "mono pr-9 tracking-[0.12em]", className)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={shown}
        aria-label={shown ? "Esconder senha" : "Mostrar senha"}
        title={shown ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 grid w-8 place-items-center rounded-sm text-fg-3 transition-colors hover:text-fg group-focus-within:text-fg"
      >
        <svg ref={svg} viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
          <defs>
            <mask id={mask}>
              <path className="lid-mask" d={OPEN} fill="#fff" />
            </mask>
          </defs>
          <path className="lid-up" d={UP} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={LOW} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <g mask={`url(#${mask})`}>
            <g className="eye">
              <circle cx={12} cy={12} r={4} fill="currentColor" />
              <circle cx={13} cy={11} r={1} className="fill-bg" />
            </g>
          </g>
        </svg>
      </button>
    </div>
  );
}
