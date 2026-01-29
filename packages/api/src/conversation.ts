import * as conversationRepo from "@alfred/db/repo/conversation";

export async function getConversationHistory(args: {
  conversationId: string;
  userId: string;
}) {
  return conversationRepo.getConversationHistory(
    args.conversationId,
    args.userId
  );
}
