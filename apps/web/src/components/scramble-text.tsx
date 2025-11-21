import { useEffect, useState } from 'react';

interface ScrambleTextProps {
  text: string;
  className?: string;
  speed?: number;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

export function ScrambleText({ text, className, speed = 30 }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  
  useEffect(() => {
    let iteration = 0;
    let interval: any = null;
    
    interval = setInterval(() => {
        setDisplay(prev => 
            text.split("").map((letter, index) => {
                if (index < iteration) {
                    return text[index];
                }
                return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            }).join("")
        );
        
        if (iteration >= text.length) {
            clearInterval(interval);
        }
        
        iteration += 1 / 3;
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
        <span aria-hidden="true">{display}</span>
    </span>
  );
}
