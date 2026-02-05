import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { TRPCAppRouter } from "@/utils/trpc";

import {
  BodyText,
  CaptionText,
  TitleText,
} from "@/components/foundation/BiolumText";
import { FluidButton } from "@/components/foundation/FluidButton";
import { HUDSurface } from "@/components/foundation/HUDSurface";
import { VoidContainer } from "@/components/foundation/VoidContainer";
import { useVoidTheme } from "@/hooks/use-void-theme";
import { useAuthClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type RouterInputs = inferRouterInputs<TRPCAppRouter>;
type TaskItem = RouterOutputs["task"]["list"][number];
type CreateTaskInput = RouterInputs["task"]["create"];
type UpdateTaskInput = RouterInputs["task"]["update"];
type DeleteTaskInput = RouterInputs["task"]["delete"];

interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

function AnimatedCheckbox({ checked, onToggle }: AnimatedCheckboxProps) {
  const theme = useVoidTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(checked ? 1 : 0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: checked
      ? theme.colors.semantic.success
      : "rgba(255, 255, 255, 0.2)",
    shadowOpacity: glowOpacity.value * 0.6,
    shadowColor: theme.colors.semantic.success,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  }));

  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 15 }, () => {
      scale.value = withSpring(1);
    });
    glowOpacity.value = withTiming(checked ? 0 : 1, { duration: 200 });
    onToggle();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.checkbox, animatedStyle]}>
        {checked && (
          <Ionicons
            name="checkmark"
            size={16}
            color={theme.colors.semantic.success}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

interface TodoItemProps {
  task: TaskItem;
  onToggle: (id: string, isCompleted: boolean) => void;
  onDelete: (id: string) => void;
}

function TodoItem({ task, onToggle, onDelete }: TodoItemProps) {
  const theme = useVoidTheme();
  const isCompleted = task.status === "completed";
  const priority =
    typeof task.priority === "number" && Number.isFinite(task.priority)
      ? task.priority
      : 0;
  const priorityBand = (() => {
    if (priority >= 8) {
      return "high";
    }
    if (priority >= 4) {
      return "medium";
    }
    return "low";
  })();

  return (
    <HUDSurface elevation={1} style={styles.todoItem}>
      <View style={styles.todoContent}>
        <AnimatedCheckbox
          checked={isCompleted}
          onToggle={() => onToggle(task.id, isCompleted)}
        />
        <View style={styles.todoTextContainer}>
          <BodyText
            color={isCompleted ? "dim" : "bright"}
            style={styles.todoText}
          >
            {task.title}
          </BodyText>
          {priority > 0 && (
            <View style={styles.priorityContainer}>
              <View
                style={[
                  styles.priorityDot,
                  {
                    backgroundColor:
                      priorityBand === "high"
                        ? theme.colors.semantic.error
                        : (priorityBand === "medium"
                          ? theme.colors.semantic.warning
                          : theme.colors.biolum.faint),
                  },
                ]}
              />
              <CaptionText
                size="small"
                color={
                  priorityBand === "high" || priorityBand === "medium"
                    ? "standard"
                    : "faint"
                }
              >
                {`P${priority}`}
              </CaptionText>
            </View>
          )}
        </View>
      </View>
      <Pressable
        onPress={() => onDelete(task.id)}
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && styles.deleteButtonPressed,
        ]}
        hitSlop={8}
      >
        <Ionicons
          name="trash-outline"
          size={18}
          color={theme.colors.semantic.error}
        />
      </Pressable>
    </HUDSurface>
  );
}

export default function TodosScreen() {
  const theme = useVoidTheme();
  const authClient = useAuthClient();
  const { data: session } = authClient.useSession();
  const [newTodoText, setNewTodoText] = useState("");

  const utils = trpc.useUtils();
  const tasksQuery = trpc.task.list.useQuery({ limit: 200 });
  const tasks: TaskItem[] = tasksQuery.data ?? [];

  const createMutation = trpc.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      setNewTodoText("");
    },
  });
  const updateMutation = trpc.task.update.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });

  const handleAddTodo = useCallback(() => {
    if (newTodoText.trim()) {
      const input: CreateTaskInput = { title: newTodoText };
      createMutation.mutate(input);
    }
  }, [newTodoText, createMutation]);

  const handleToggleTodo = useCallback(
    (id: string, isCompleted: boolean) => {
      const input: UpdateTaskInput = {
        id,
        status: isCompleted ? "pending" : "completed",
      };
      updateMutation.mutate(input);
    },
    [updateMutation]
  );

  const handleDeleteTodo = useCallback(
    (id: string) => {
      Alert.alert("Delete Todo", "Are you sure you want to delete this todo?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const input: DeleteTaskInput = { id };
            deleteMutation.mutate(input);
          },
        },
      ]);
    },
    [deleteMutation]
  );

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  const renderTodosContent = () => {
    if (tasksQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            color={theme.colors.biolum.standard}
            size="large"
          />
        </View>
      );
    }

    if (tasks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="checkbox-outline"
            size={48}
            color={theme.colors.biolum.faint}
          />
          <BodyText color="dim" style={styles.emptyText}>
            No todos yet. Add one above!
          </BodyText>
        </View>
      );
    }

    return (
      <View style={styles.todoList}>
        {tasks.map((task) => (
          <TodoItem
            key={task.id}
            task={task}
            onToggle={handleToggleTodo}
            onDelete={handleDeleteTodo}
          />
        ))}
      </View>
    );
  };

  return (
    <VoidContainer gradient="ambient" noise noiseOpacity={0.03}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TitleText size="large" color="full">
            Todo List
          </TitleText>
          <CaptionText size="medium" color="dim">
            Manage your tasks efficiently
          </CaptionText>
        </View>

        {/* Add Todo Input */}
        <HUDSurface elevation={2} style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View
              style={[
                styles.inputWrapper,
                { borderColor: theme.colors.glass.border },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.biolum.standard }]}
                value={newTodoText}
                onChangeText={setNewTodoText}
                onSubmitEditing={handleAddTodo}
                placeholder="Add a new task..."
                placeholderTextColor={theme.colors.biolum.faint}
                editable={!createMutation.isPending}
                returnKeyType="done"
              />
            </View>
            <FluidButton
              variant="primary"
              size="medium"
              icon={
                createMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="add" size={20} color="white" />
                )
              }
              onPress={handleAddTodo}
              disabled={createMutation.isPending || !newTodoText.trim()}
              style={styles.addButton}
            />
          </View>
        </HUDSurface>

        {/* Todo List */}
        {renderTodosContent()}
      </ScrollView>
    </VoidContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  inputCard: {
    marginBottom: 24,
    padding: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
  },
  addButton: {
    borderRadius: 24,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    textAlign: "center",
  },
  todoList: {
    gap: 12,
  },
  todoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  todoContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  todoTextContainer: {
    flex: 1,
  },
  todoText: {
    flexShrink: 1,
  },
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
});
