import { generateText } from "ai";

export type GenerateTextInput = Parameters<typeof generateText>[0];

export const callGenerateText = generateText;
