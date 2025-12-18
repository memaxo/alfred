/**
 * Person titles for entity recognition.
 * Used as fallback when compromise's .people() doesn't detect a title.
 */

export const PERSON_TITLES = [
  // Basic titles
  "mr",
  "mrs",
  "ms",
  "dr",
  "professor",
  "president",
  "sir",
  "madam",
  "prof",
  "rev",
  "hon",
  "esq",
  "jr",
  "sr",

  // Military ranks
  "admiral",
  "brigadier",
  "capt",
  "captain",
  "col",
  "colonel",
  "commander",
  "corporal",
  "general",
  "gen",
  "lieutenant",
  "lt",
  "major",
  "maj",
  "marshal",
  "private",
  "sgt",
  "sergeant",

  // Academic titles
  "associate",
  "dean",
  "emeritus",
  "fellow",
  "instructor",
  "lecturer",
  "provost",
  "rector",

  // Religious titles
  "archbishop",
  "bishop",
  "brother",
  "cardinal",
  "deacon",
  "elder",
  "father",
  "imam",
  "minister",
  "pastor",
  "pope",
  "rabbi",
  "reverend",
  "sister",
  "vicar",

  // Legal titles
  "attorney",
  "barrister",
  "chancellor",
  "counselor",
  "judge",
  "justice",
  "magistrate",
  "solicitor",

  // Medical titles
  "nurse",
  "physician",
  "surgeon",
] as const;
