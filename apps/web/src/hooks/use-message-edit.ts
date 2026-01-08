import type { AssistantUIMessage } from "@alfred/agent";
import { useCallback, useState } from "react";
import { getMessageText } from "@/utils/message";

type UseMessageEditProps = {
  handleEdit: (id: string, text: string) => void;
};

type MessageEditState = {
  cancelEditing: () => void;
  editingMessageId: string | null;
  editText: string;
  isEditing: (messageId: string) => boolean;
  saveEdit: () => void;
  setEditText: (text: string) => void;
  startEditing: (message: AssistantUIMessage) => void;
};

export function useMessageEdit({
  handleEdit,
}: UseMessageEditProps): MessageEditState {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEditing = useCallback((message: AssistantUIMessage) => {
    setEditingMessageId(message.id);
    setEditText(getMessageText(message));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditText("");
  }, []);

  const saveEdit = useCallback(() => {
    if (editingMessageId && editText.trim()) {
      handleEdit(editingMessageId, editText.trim());
      setEditingMessageId(null);
      setEditText("");
    }
  }, [editingMessageId, editText, handleEdit]);

  const isEditing = useCallback(
    (messageId: string) => editingMessageId === messageId,
    [editingMessageId]
  );

  return {
    cancelEditing,
    editingMessageId,
    editText,
    isEditing,
    saveEdit,
    setEditText,
    startEditing,
  };
}
