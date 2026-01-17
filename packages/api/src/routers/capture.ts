import { createNote, createReminder } from "@alfred/db/repo/assistant";
import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import {
  createBundle,
  createCapture,
  getInboxItem,
  getWorkingSet,
  updateCaptureStatus,
  upsertReceipt,
} from "@alfred/db/repo/sense";
import { logger } from "@alfred/logger";
import { scoreRoute } from "@alfred/sense";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { publishInboxEvent } from "./inbox";

const evidenceInput = z
  .object({
    capturedAt: z.string().datetime().optional(),
    tags: z.array(z.string().min(1)).max(32).optional(),
    device: z.string().min(1).max(128).optional(),
    surface: z.enum(["native", "web", "unknown"]).optional(),
  })
  .partial()
  .optional();

const payloadInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1).max(10_000),
  }),
  z.object({
    kind: z.literal("voice"),
    audioBase64: z.string().min(1),
    mimeType: z.string().min(1).default("audio/m4a"),
    language: z.string().min(2).max(10).optional(),
  }),
  z.object({
    kind: z.literal("photo"),
    imageBase64: z.string().min(1),
    mimeType: z.string().min(1).default("image/jpeg"),
  }),
]);

const captureCreateInput = z.object({
  payload: payloadInput,
  evidence: evidenceInput,
});

const captureTriageInput = z.object({
  captureId: z.string().uuid(),
  destination: z.enum(["note", "reminder"]),
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(256).optional(),
  due: z.string().datetime().optional(),
});

async function transcribeVoiceClip({
  userId,
  audioBase64,
  mimeType,
  language,
}: {
  userId: string;
  audioBase64: string;
  mimeType: string;
  language?: string;
}): Promise<string> {
  const [{ transcribeLocal }, { getVoicePools }] = await Promise.all([
    import("@alfred/voice/services/stt"),
    import("../voice/pools"),
  ]);

  const { resolveSttLanguagePreference, DEFAULT_STT_MODEL } = await import(
    "@alfred/voice/services/config"
  );

  const sttLanguage = await resolveSttLanguagePreference(userId, language);
  const { sttPool } = getVoicePools();
  const result = await transcribeLocal(sttPool, {
    audioBase64,
    mimeType,
    model: DEFAULT_STT_MODEL,
    language: sttLanguage,
  });
  return (result.text ?? "").trim();
}

/**
 * Process a photo capture by embedding the image using Qwen multimodal provider
 * Returns a description placeholder and the image embedding
 */
async function processPhotoCapture({
  imageBase64,
  mimeType,
}: {
  imageBase64: string;
  mimeType: string;
}): Promise<{ text: string; embedding: number[]; modelId: string }> {
  const { getRegistry, MODEL_IDS, isEmbeddingInitialized, initEmbedding } =
    await import("@alfred/embed");

  // Ensure embedding system is initialized
  if (!isEmbeddingInitialized()) {
    await initEmbedding({ defaultModel: "qwen" });
  }

  const registry = getRegistry();
  const provider = registry.get(MODEL_IDS.QWEN3_VL_2B);

  if (!provider) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "embed_multimodal_provider_unavailable",
    });
  }

  // Initialize provider if not already
  if (!provider.isHealthy()) {
    await provider.initialize();
  }

  // Create data URL for the image
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  // Embed the image using Qwen multimodal provider
  const embedding = await provider.embed({
    type: "image",
    url: dataUrl,
    mimeType,
  });

  // For now, use a placeholder description
  // Future enhancement: Use vision LLM to generate description for text search
  const text = "[Photo capture]";

  logger.info("photo_capture_embedded", {
    mimeType,
    embeddingLength: embedding.length,
    modelId: MODEL_IDS.QWEN3_VL_2B,
  });

  return {
    text,
    embedding,
    modelId: MODEL_IDS.QWEN3_VL_2B,
  };
}

export const captureRouter = router({
  create: authedProcedure
    .input(captureCreateInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const capturedAt = input.evidence?.capturedAt
        ? new Date(input.evidence.capturedAt)
        : new Date();

      const evidence = {
        capturedAt,
        tags: input.evidence?.tags,
        device: input.evidence?.device,
        surface: input.evidence?.surface,
      };

      let derivedText = "";
      let photoEmbedding: { embedding: number[]; modelId: string } | undefined;

      if (input.payload.kind === "text") {
        derivedText = input.payload.text.trim();
      } else if (input.payload.kind === "voice") {
        derivedText = await transcribeVoiceClip({
          userId: session.user.id,
          audioBase64: input.payload.audioBase64,
          mimeType: input.payload.mimeType,
          language: input.payload.language,
        });
      } else if (input.payload.kind === "photo") {
        // Process photo capture with multimodal embedding
        const result = await processPhotoCapture({
          imageBase64: input.payload.imageBase64,
          mimeType: input.payload.mimeType,
        });
        derivedText = result.text;
        photoEmbedding = {
          embedding: result.embedding,
          modelId: result.modelId,
        };
      }

      if (!derivedText) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "capture_text_empty",
        });
      }

      const capture = await createCapture({
        userId: session.user.id,
        kind: input.payload.kind,
        evidence,
        sourceDevice: input.evidence?.device,
      });

      const bundle = await createBundle({
        captureId: capture.id,
        text: derivedText,
      });

      // If photo capture, store embedding in RAG for visual search
      if (photoEmbedding) {
        void (async () => {
          try {
            const { ragRepo } = await import("@alfred/db");
            const document = await ragRepo.createDocument(
              `capture:photo:${capture.id}`,
              `Photo capture ${capturedAt.toISOString()}`,
              undefined,
              { kind: "photo", captureId: capture.id }
            );
            await ragRepo.addChunks(document.id, [
              {
                content: derivedText,
                order: 0,
                embedding: photoEmbedding.embedding,
                embeddingModelId: photoEmbedding.modelId,
                metadata: {
                  captureId: capture.id,
                  kind: "photo",
                },
              },
            ]);
            logger.info("photo_capture_rag_stored", {
              captureId: capture.id,
              documentId: document.id,
            });
          } catch (error) {
            logger.warn("photo_capture_rag_failed", {
              captureId: capture.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      }

      const workingSet = await getWorkingSet(session.user.id);
      const route = scoreRoute({ text: derivedText, workingSet });

      const receipt = await upsertReceipt({
        captureId: capture.id,
        decision: "route",
        summary: route.summary,
        evidence: route.evidence,
        outcome: route.outcome,
        alternatives: route.alternatives,
        confidence: route.confidence,
        corrections: [],
      });

      const item = { capture, bundle, receipt };
      publishInboxEvent(session.user.id, {
        type: "inbox.updated",
        payload: { item },
      });

      return item;
    }),

  triage: authedProcedure
    .input(captureTriageInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const item = await getInboxItem({
        userId: session.user.id,
        captureId: input.captureId,
      });
      if (!item?.bundle) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "capture_not_found",
        });
      }

      const content = item.bundle.text.trim();
      if (!content) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "capture_text_empty",
        });
      }

      const projectId =
        input.projectId ??
        (item.receipt?.outcome.projectId &&
        item.receipt.outcome.projectId.length > 0
          ? item.receipt.outcome.projectId
          : undefined);

      if (input.destination === "note") {
        const note = await createNote(
          session.user.id,
          content,
          input.title,
          undefined,
          projectId
        );

        const mirrorLabel =
          typeof note.title === "string" && note.title.trim().length > 0
            ? note.title
            : content.slice(0, 80);

        await ensureMirrorNodes(
          "user",
          [
            {
              kind: "note",
              id: note.id,
              label: mirrorLabel,
              properties: {
                entity: { kind: "note", id: note.id },
                title: note.title,
                updatedAt:
                  note.updated instanceof Date
                    ? note.updated.toISOString()
                    : null,
              },
            },
          ],
          { projectId }
        );

        void (async () => {
          try {
            const trimmed = content.trim();
            if (!trimmed) {
              return;
            }
            const { ingest } = await import("@alfred/rag");
            await ingest(`note:${note.id}`, trimmed);
          } catch (error) {
            logger.warn("sense_note_embedding_failed", {
              noteId: note.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();

        await updateCaptureStatus({
          userId: session.user.id,
          id: input.captureId,
          status: "converted",
        });

        if (item.receipt) {
          await upsertReceipt({
            captureId: input.captureId,
            decision: item.receipt.decision,
            summary: item.receipt.summary,
            evidence: item.receipt.evidence,
            outcome: {
              ...item.receipt.outcome,
              kind: "note",
              targetId: note.id,
            },
            alternatives: item.receipt.alternatives,
            confidence: item.receipt.confidence,
            corrections: item.receipt.corrections,
          });
        }

        const refreshed = await getInboxItem({
          userId: session.user.id,
          captureId: input.captureId,
        });
        if (refreshed) {
          publishInboxEvent(session.user.id, {
            type: "inbox.updated",
            payload: { item: refreshed },
          });
        }

        return { kind: "note" as const, id: note.id };
      }

      const due = input.due
        ? new Date(input.due)
        : new Date(Date.now() + 60 * 60_000);
      const reminder = await createReminder(
        session.user.id,
        input.title ?? content.slice(0, 80),
        due,
        content,
        undefined,
        projectId
      );

      await ensureMirrorNodes(
        "user",
        [
          {
            kind: "reminder",
            id: reminder.id,
            label: reminder.title,
            properties: {
              entity: { kind: "reminder", id: reminder.id },
              title: reminder.title,
              due:
                reminder.due instanceof Date
                  ? reminder.due.toISOString()
                  : null,
              status: reminder.fired ? "fired" : "scheduled",
            },
          },
        ],
        { projectId }
      );

      await updateCaptureStatus({
        userId: session.user.id,
        id: input.captureId,
        status: "converted",
      });

      if (item.receipt) {
        await upsertReceipt({
          captureId: input.captureId,
          decision: item.receipt.decision,
          summary: item.receipt.summary,
          evidence: item.receipt.evidence,
          outcome: {
            ...item.receipt.outcome,
            kind: "reminder",
            targetId: reminder.id,
          },
          alternatives: item.receipt.alternatives,
          confidence: item.receipt.confidence,
          corrections: item.receipt.corrections,
        });
      }

      const refreshed = await getInboxItem({
        userId: session.user.id,
        captureId: input.captureId,
      });
      if (refreshed) {
        publishInboxEvent(session.user.id, {
          type: "inbox.updated",
          payload: { item: refreshed },
        });
      }

      return { kind: "reminder" as const, id: reminder.id };
    }),
});
