import { Ionicons } from "@expo/vector-icons";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export default function TodosScreen() {
  const { data: session } = authClient.useSession();
  const [newTodoText, setNewTodoText] = useState("");

  const utils = trpc.useUtils();
  const todosQuery = trpc.todo.getAll.useQuery();
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type TodoItem = RouterOutputs["todo"]["getAll"][number];
  type CreateTodoInput = RouterInputs["todo"]["create"];
  type ToggleTodoInput = RouterInputs["todo"]["toggle"];
  type DeleteTodoInput = RouterInputs["todo"]["delete"];
  const todos: TodoItem[] = todosQuery.data ?? [];

  const createMutation = trpc.todo.create.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
      setNewTodoText("");
    },
  });
  const toggleMutation = trpc.todo.toggle.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
    },
  });
  const deleteMutation = trpc.todo.delete.useMutation({
    onSuccess: async () => {
      await utils.todo.getAll.invalidate();
    },
  });

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      const input: CreateTodoInput = { text: newTodoText };
      createMutation.mutate(input);
    }
  };

  if (!session?.user) {
    return <Redirect href="/(drawer)/" />;
  }

  const handleToggleTodo = (id: number, completed: boolean) => {
    const input: ToggleTodoInput = { id, completed: !completed };
    toggleMutation.mutate(input);
  };

  const handleDeleteTodo = (id: number) => {
    Alert.alert("Delete Todo", "Are you sure you want to delete this todo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const input: DeleteTodoInput = { id };
          deleteMutation.mutate(input);
        },
      },
    ]);
  };

  const renderTodosContent = () => {
    if (todosQuery.isLoading) {
      return (
        <View className="flex justify-center py-8">
          <ActivityIndicator color="#3b82f6" size="large" />
        </View>
      );
    }

    if (todos.length === 0) {
      return (
        <Text className="py-8 text-center text-muted-foreground">
          No todos yet. Add one above!
        </Text>
      );
    }

    return (
      <View className="space-y-2">
        {todos.map((todo) => (
          <View
            className="flex-row items-center justify-between rounded-md border border-border bg-background p-3"
            key={todo.id}
          >
            <View className="flex-1 flex-row items-center">
              <TouchableOpacity
                className="mr-3"
                onPress={() => handleToggleTodo(todo.id, todo.completed)}
              >
                <Ionicons
                  color={todo.completed ? "#22c55e" : "#6b7280"}
                  name={todo.completed ? "checkbox" : "square-outline"}
                  size={24}
                />
              </TouchableOpacity>
              <Text
                className={`flex-1 ${
                  todo.completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {todo.text}
              </Text>
            </View>
            <TouchableOpacity
              className="ml-2 p-1"
              onPress={() => handleDeleteTodo(todo.id)}
            >
              <Ionicons color="#ef4444" name="trash-outline" size={20} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Container>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <View className="mb-6 rounded-lg border border-border bg-card p-4">
            <Text className="mb-2 font-bold text-2xl text-foreground">
              Todo List
            </Text>
            <Text className="mb-4 text-muted-foreground">
              Manage your tasks efficiently
            </Text>

            <View className="mb-6">
              <View className="mb-2 flex-row items-center space-x-2">
                <TextInput
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  editable={!createMutation.isPending}
                  onChangeText={setNewTodoText}
                  onSubmitEditing={handleAddTodo}
                  placeholder="Add a new task..."
                  placeholderTextColor="#6b7280"
                  returnKeyType="done"
                  value={newTodoText}
                />
                <TouchableOpacity
                  className={`rounded-md px-4 py-2 ${
                    createMutation.isPending || !newTodoText.trim()
                      ? "bg-muted"
                      : "bg-primary"
                  }`}
                  disabled={createMutation.isPending || !newTodoText.trim()}
                  onPress={handleAddTodo}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="font-medium text-white">Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {renderTodosContent()}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
