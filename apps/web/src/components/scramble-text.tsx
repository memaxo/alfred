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
    const interval = setInterval(() => {
      const revealedCount = Math.floor(iteration);

      setDisplay(
        text
          .split("")
          .map((_, index) => {
            if (index < revealedCount) {
              return text[index];
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );

      iteration += 1 / 3;

      // Use Math.ceil to handle floating-point precision issues
      if (Math.ceil(iteration) > text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span aria-label={text} className={className}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
