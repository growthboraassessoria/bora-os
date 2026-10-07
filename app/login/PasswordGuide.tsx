"use client";
// Guia da senha: cadeado e cartão com as regras, riscadas a marca-texto conforme a senha cumpre cada uma.
// Desenho a partir de https://dribbble.com/shots/4755212-Password-Guide (Saptarshi Prakash).
import { Special_Elite } from "next/font/google";
import { cx } from "@/components/ui";

const hand = Special_Elite({ weight: "400", subsets: ["latin"], display: "swap" });

// Mesma regra de app/login/actions.ts e app/(os)/conta/actions.ts.
export const RULES: [string, (v: string) => boolean][] = [
  ["12 caracteres", (v) => v.length >= 12],
  ["1 minúscula", (v) => /[a-z]/.test(v)],
  ["1 MAIÚSCULA", (v) => /[A-Z]/.test(v)],
  ["1 número", (v) => /\d/.test(v)],
  ["1 símbolo", (v) => /[^A-Za-z0-9]/.test(v)],
];

export function PasswordGuide({ value, className }: { value: string; className?: string }) {
  const ok = RULES.map(([, test]) => test(value));
  const all = ok.every(Boolean);
  return (
    <div className={cx("relative mx-auto h-[160px] w-[250px] select-none", className)}>
      <svg width="225" height="160" viewBox="0 0 225 160" fill="none" aria-hidden>
        <path className="fill-surface-3" d="M74.3499 1.61518C116.925 -6.45707 134.575 17.6849 138.078 30.765C143.295 42.3501 136.065 80.2503 137.631 113.057C139.867 159.921 117.282 159.024 107.444 159.921C97.605 160.818 41.4799 154.091 22.6969 139.292C7.67061 127.453 -8.81015 78.4076 5.47931 45.3399C14.1999 25.1592 31.7753 9.68743 74.3499 1.61518Z" />
        <path className="stroke-fg-3" strokeWidth={5.39972} d="M21.6109 83.1567L20.9714 79.1187C20.2749 74.7216 23.275 70.5924 27.6722 69.8959V69.8959C32.0119 69.2086 36.1027 72.1232 36.8703 76.4495L37.6107 80.6226" />
        <rect className="fill-line-strong" x="14.4999" y="84.283" width="30.5984" height="28.3486" rx="3.59982" transform="rotate(-9 14.4999 84.283)" />
        <rect className="fill-fg-3" x="14.4999" y="84.283" width="30.5984" height="20.249" rx="3.59982" transform="rotate(-9 14.4999 84.283)" />
        <path className="fill-surface-3" fillRule="evenodd" clipRule="evenodd" d="M34.3401 100.243C35.3055 99.4602 35.8385 98.1979 35.63 96.8819C35.319 94.9182 33.475 93.5785 31.5114 93.8895C29.5478 94.2005 28.208 96.0445 28.519 98.0081C28.7275 99.3242 29.6245 100.36 30.7846 100.806L31.2823 103.949C31.4378 104.93 32.3598 105.6 33.3416 105.445C34.3234 105.289 34.9933 104.367 34.8378 103.386L34.3401 100.243Z" />
        <path className="fill-signal" fillRule="evenodd" clipRule="evenodd" d="M45.4836 25.9488C42.0049 25.8881 39.1357 28.6589 39.075 32.1376L37.4494 125.269C37.3886 128.747 40.1594 131.617 43.6381 131.677L48.6056 131.764C48.596 131.615 48.5923 131.465 48.595 131.314C48.647 128.332 51.1064 125.957 54.0881 126.009C57.0698 126.061 59.4448 128.521 59.3928 131.502C59.3901 131.654 59.3813 131.804 59.3664 131.952L216.403 134.693C219.882 134.754 222.751 131.983 222.812 128.504L224.437 35.3731C224.498 31.8944 221.727 29.0252 218.248 28.9645L45.4836 25.9488ZM54.9048 79.2187C57.8866 79.2707 60.3459 76.8957 60.398 73.914C60.45 70.9323 58.0751 68.4729 55.0933 68.4209C52.1116 68.3688 49.6522 70.7438 49.6002 73.7255C49.5481 76.7073 51.9231 79.1666 54.9048 79.2187ZM59.8954 102.708C59.8433 105.69 57.384 108.065 54.4022 108.013C51.4205 107.961 49.0455 105.501 49.0976 102.52C49.1496 99.538 51.609 97.163 54.5907 97.215C57.5724 97.2671 59.9474 99.7264 59.8954 102.708Z" />
      </svg>

      <div
        className={cx(
          hand.className,
          "absolute left-[52px] top-[20px] h-[116px] w-[194px] -rotate-5 rounded-[6px] bg-white text-[11.5px] leading-[14px] text-[#1f1f23]",
          "shadow-[inset_3px_0_0_#d4d4d8] before:absolute before:left-[22px] before:h-full before:w-0.5 before:bg-[#e5484d]/70",
        )}
      >
        <ul className="pt-2">
          {RULES.map(([label], i) => (
            <li key={label} className="mb-1 border-b border-[#e4e4e7] pb-0.5 pl-[34px]">
              <span
                className={cx(
                  "relative z-0 before:absolute before:inset-y-0 before:-inset-x-0.5 before:-z-10 before:origin-left before:bg-signal before:transition-transform before:duration-400 before:ease-out",
                  ok[i] ? "before:scale-x-100" : "before:scale-x-0",
                )}
              >
                {label}
                <span className="sr-only">{ok[i] ? ", cumprido" : ", falta"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <svg
        width="32"
        height="33"
        viewBox="0 0 32 33"
        fill="none"
        aria-hidden
        className={cx(
          "absolute right-[10px] top-[84px] transition-transform duration-300 ease-[cubic-bezier(.86,.45,.72,1.2)]",
          all ? "scale-100" : "scale-0",
        )}
      >
        <circle cx="16.1886" cy="16.6948" r="15.7492" className="fill-signal" />
        <path d="M10.5639 16.4698L14.3887 20.7446L22.7133 12.645" stroke="#000" strokeWidth={2.69986} />
      </svg>
    </div>
  );
}
