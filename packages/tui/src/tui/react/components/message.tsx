/** @jsxImportSource @opentui/react */

import { SyntaxStyle, parseColor } from "@opentui/core";

import { dim } from "../../typography";

// Basic syntax style similar to GitHub Dark
const syntaxStyle = SyntaxStyle.fromStyles({
  comment: { fg: parseColor("#8B949E"), italic: true },
  default: { fg: parseColor("#E6EDF3") },
  function: { fg: parseColor("#D2A8FF") },
  keyword: { fg: parseColor("#FF7B72"), bold: true },
  number: { fg: parseColor("#79C0FF") },
  punctuation: { fg: parseColor("#F0F6FC") },
  string: { fg: parseColor("#A5D6FF") },
  variable: { fg: parseColor("#E6EDF3") },
});

interface MessageContentProps {
  content: string;
  width: number;
}

export function MessageContent({ content, width }: MessageContentProps) {
  // Simple regex to find code blocks: ```[lang]\n<code>\n```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const lang = match?.[1] || "text";
          const code = (match?.[2] || "").trim();

          return (
            <box
              key={index}
              style={{
                border: true,
                borderColor: "#444444",
                marginBottom: 1,
                marginTop: 1,
                padding: 1,
              }}
            >
              <text content={dim(` [${lang}]`)} />
              <code
                content={code}
                filetype={lang}
                style={{
                  width: "100%",
                }}
                syntaxStyle={syntaxStyle}
              />
            </box>
          );
        } else if (part.trim()) {
          return (
            <box key={index} style={{ paddingLeft: 1 }}>
              {part.split("\n").map((line, i) => (
                <text
                  content={line}
                  key={i}
                  style={{ fg: "#E6E6E6" }}
                  width={width - 2}
                />
              ))}
            </box>
          );
        }
        return null;
      })}
    </>
  );
}
