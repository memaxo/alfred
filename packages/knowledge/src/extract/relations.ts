import nlp from "compromise";

import type {
  BaseView,
  Entity,
  MentionRecord,
  RelationTriple,
  SentenceJson,
  TermJson,
  VerbJson,
} from "./types.js";

import { clampConfidence, extractEntities } from "./entities.js";
import { asTextView } from "./types.js";

/**
 * Extract relation triples (subject-verb-object) from text.
 */

const buildMentionIndex = (
  entities: Entity[]
): Map<number, MentionRecord[]> => {
  const index = new Map<number, MentionRecord[]>();
  for (const entity of entities) {
    for (const mention of entity.mentions) {
      const list = index.get(mention.sentence) ?? [];
      list.push({ ...mention, entity });
      index.set(mention.sentence, list);
    }
  }
  for (const mentions of index.values()) {
    mentions.sort((a, b) => a.start - b.start);
  }
  return index;
};

const nearestMentions = (
  mentions: MentionRecord[],
  pivot: number,
  direction: "left" | "right",
  limit: number
): Array<{ record: MentionRecord; distance: number }> => {
  const filtered = mentions
    .map((record) => {
      const distance =
        direction === "left" ? pivot - record.end : record.start - pivot;
      return { record, distance };
    })
    .filter(({ distance }) =>
      direction === "left" ? distance >= 0 : distance > 0
    )
    .filter(({ distance }) => distance <= 6)
    .sort((a, b) => a.distance - b.distance);
  return filtered.slice(0, limit);
};

export const extractRelations = (
  text: string,
  existingEntities?: Entity[]
): RelationTriple[] => {
  const entities = existingEntities ?? extractEntities(text);
  if (entities.length === 0) {
    return [];
  }

  const doc = asTextView(nlp(text));
  const sentencesView = asTextView(doc.sentences() as unknown as BaseView);
  const sentencesJson = (doc.sentences().json() as SentenceJson[]) ?? [];
  const mentionIndex = buildMentionIndex(entities);
  const relations: RelationTriple[] = [];

  let sentenceIndex = -1;
  sentencesView.forEach((sentenceBase) => {
    const sentence = asTextView(sentenceBase as unknown as BaseView);
    sentenceIndex += 1;
    const mentionList = mentionIndex.get(sentenceIndex) ?? [];
    let carrySubject: MentionRecord | null = null;
    const sentenceTerms = (sentencesJson[sentenceIndex]?.terms ??
      []) as TermJson[];

    const intermediateTerms = (start: number, end: number) =>
      sentenceTerms.filter((term: TermJson) => {
        const idx = term.index?.[1];
        return typeof idx === "number" && idx > start && idx < end;
      });

    const adjoinsPreposition = (record: MentionRecord) => {
      const previous = sentenceTerms.find(
        (term: TermJson) => term.index?.[1] === record.start - 1
      );
      return Boolean(previous?.tags?.includes("Preposition"));
    };

    const verbs = sentence.verbs().json() as VerbJson[];
    verbs.forEach((verb) => {
      const verbTerm = verb.terms?.[0];
      if (!verbTerm || typeof verbTerm.index?.[1] !== "number") {
        return;
      }
      const pivot = verbTerm.index[1];
      let subjects =
        nearestMentions(mentionList, pivot, "left", 2) ??
        ([] as Array<{ record: MentionRecord; distance: number }>);
      subjects = subjects.filter(({ record }) => {
        const between = intermediateTerms(record.end, pivot);
        const hasConjunction = between.some((term) =>
          term.tags?.includes("Conjunction")
        );
        if (hasConjunction && carrySubject) {
          return false;
        }
        if (adjoinsPreposition(record) && carrySubject) {
          return false;
        }
        return true;
      });
      if (subjects.length === 0 && carrySubject) {
        subjects.push({ record: carrySubject, distance: 0 });
      }
      const objects = nearestMentions(mentionList, pivot, "right", 3);

      if (subjects.length === 0 || objects.length === 0) {
        return;
      }

      const relationLabel =
        verb.verb?.infinitive ?? verb.verb?.root ?? verb.text ?? "related";

      subjects.forEach(({ record: subjectRecord }) => {
        const subjectName = subjectRecord.entity.label;
        carrySubject = subjectRecord;

        objects.forEach(({ record: objectRecord, distance }) => {
          const targetName = objectRecord.entity.label;
          if (!targetName || targetName === subjectName) {
            return;
          }
          const confidenceAdjustment = distance > 3 ? 0.05 : 0;
          relations.push({
            source: subjectName,
            relation: relationLabel,
            target: targetName,
            sentence: sentenceIndex,
            evidence: sentence.text(),
            confidence: clampConfidence(0.75 - confidenceAdjustment),
          });
        });
      });
    });
  });

  const deduped = new Map<string, RelationTriple>();
  for (const rel of relations) {
    const key = `${rel.source}|${rel.relation}|${rel.target}|${rel.sentence}`;
    if (!deduped.has(key)) {
      deduped.set(key, rel);
    }
  }

  return Array.from(deduped.values());
};
