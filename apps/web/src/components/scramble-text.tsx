import { useEffect, useState } from "react";

type ScrambleTextProps = {
  text: string;
  className?: string;
  speed?: number;
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

export function ScrambleText({
  text,
  className,
  speed = 30,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let iteration = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    interval = setInterval(() => {
      setDisplay((_prev) =>
        text
          .split("")
          .map((_letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );

      if (iteration >= text.length && interval) {
        clearInterval(interval);
      }

      iteration += 1 / 3;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span aria-label={text} className={className}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
