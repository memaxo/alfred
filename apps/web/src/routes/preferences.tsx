import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

type PreferenceList = inferRouterOutputs<TRPCAppRouter>["preference"]["list"];
type PreferenceSetInput = inferRouterInputs<TRPCAppRouter>["preference"]["set"];
type PreferenceDeleteInput =
  inferRouterInputs<TRPCAppRouter>["preference"]["delete"];

type PreferenceFormState = {
  key: string;
  value: string;
  confidence: string;
};

const DEFAULT_FORM: PreferenceFormState = {
  key: "",
  value: "",
  confidence: "1",
};

export const Route = createFileRoute("/preferences")({
  component: PreferencesRoute,
});

function PreferencesRoute() {
  const utils = trpc.useUtils();
  const listInput = useMemo(() => ({ limit: 100, offset: 0 }), []);
  const preferenceQuery = trpc.preference.list.useQuery(listInput);
  const [form, setForm] = useState<PreferenceFormState>(DEFAULT_FORM);

  const preferences = preferenceQuery.data ?? [];
  const isLoading = preferenceQuery.isLoading;

  const updateForm = useCallback(
    (field: keyof PreferenceFormState, value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleKeyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("key", event.target.value);
    },
    [updateForm]
  );

  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      updateForm("value", event.target.value);
    },
    [updateForm]
  );

  const handleConfidenceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("confidence", event.target.value);
    },
    [updateForm]
  );

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
  }, []);

  const setPreference = trpc.preference.set.useMutation({
    onMutate: async (input) => {
      await utils.preference.list.cancel(listInput);
      const previous = utils.preference.list.getData(listInput);
      utils.preference.list.setData(listInput, (current) => {
        const base = Array.isArray(current) ? [...current] : [];
        const timestamp = new Date().toISOString();
        const existingIndex = base.findIndex((item) => item?.key === input.key);
        const optimisticEntry =
          existingIndex >= 0
            ? {
                ...base[existingIndex],
                value: input.value,
                confidence:
                  input.confidence ?? base[existingIndex]?.confidence ?? 1,
                source: input.source ?? base[existingIndex]?.source ?? "user",
                updated: timestamp,
              }
            : {
                id: `optimistic-${timestamp}`,
                userId:
                  (existingIndex >= 0
                    ? base[existingIndex]?.userId
                    : base[0]?.userId) ?? "self",
                key: input.key,
                value: input.value,
                confidence: input.confidence ?? 1,
                source: input.source ?? "user",
                created: timestamp,
                updated: timestamp,
              };
        if (existingIndex >= 0) {
          base[existingIndex] = optimisticEntry;
        } else {
          base.unshift(optimisticEntry as PreferenceList[number]);
        }
        return base;
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.preference.list.setData(
        listInput,
        context?.previous as PreferenceList
      );
      toast.error(error.message ?? "preference_update_failed");
    },
    onSuccess: (data) => {
      utils.preference.list.setData(listInput, (current) => {
        const base = Array.isArray(current) ? [...current] : [];
        const index = base.findIndex(
          (item) => item?.id === data.id || item?.key === data.key
        );
        if (index >= 0) {
          base[index] = data;
          return base as PreferenceList;
        }
        base.unshift(data);
        return base as PreferenceList;
      });
      toast.success("Preference saved");
    },
    onSettled: async () => {
      await utils.preference.list.invalidate(listInput);
    },
  });

  const deletePreference = trpc.preference.delete.useMutation({
    onMutate: async (input) => {
      await utils.preference.list.cancel(listInput);
      const previous = utils.preference.list.getData(listInput);
      utils.preference.list.setData(listInput, (current) => {
        const base = Array.isArray(current) ? current : [];
        return base.filter((item) => item?.key !== input.key) as PreferenceList;
      });
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.preference.list.setData(
        listInput,
        context?.previous as PreferenceList
      );
      toast.error(error.message ?? "preference_delete_failed");
    },
    onSuccess: () => {
      toast.success("Preference removed");
    },
    onSettled: async () => {
      await utils.preference.list.invalidate(listInput);
    },
  });

  const isSaving = setPreference.isPending;
  const isDeleting = deletePreference.isPending;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSaving) {
        return;
      }
      const keyValue = form.key.trim();
      if (!keyValue) {
        toast.error("Preference key required");
        return;
      }
      const rawConfidence = Number.parseFloat(form.confidence);
      const boundedConfidence = Number.isFinite(rawConfidence)
        ? Math.min(Math.max(rawConfidence, 0), 1)
        : 1;
      let parsedValue: unknown = form.value.trim();
      if (parsedValue.length === 0) {
        toast.error("Preference value required");
        return;
      }
      try {
        parsedValue = JSON.parse(form.value);
      } catch {
        parsedValue = form.value;
      }
      const input: PreferenceSetInput = {
        key: keyValue,
        value: parsedValue,
        confidence: boundedConfidence,
      };
      setPreference.mutate(input, {
        onSuccess: () => {
          resetForm();
        },
      });
    },
    [form, isSaving, resetForm, setPreference]
  );

  const handleDelete = useCallback(
    (key: string) => {
      if (isDeleting) {
        return;
      }
      const input: PreferenceDeleteInput = { key };
      deletePreference.mutate(input);
    },
    [deletePreference, isDeleting]
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Set or update personal preferences. Values accept JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              disabled={isSaving}
              onChange={handleKeyChange}
              placeholder="Preference key"
              value={form.key}
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isSaving}
              onChange={handleValueChange}
              placeholder='JSON value, e.g. {"mode":"dark"}'
              value={form.value}
            />
            <Input
              disabled={isSaving}
              max="1"
              min="0"
              onChange={handleConfidenceChange}
              placeholder="Confidence (0-1)"
              step="0.05"
              type="number"
              value={form.confidence}
            />
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save preference"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current preferences</CardTitle>
          <CardDescription>Latest entries appear first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">
              Loading preferences…
            </p>
          ) : preferences.length === 0 ? (
            <p className="text-muted-foreground text-sm">No preferences yet.</p>
          ) : (
            <ul className="space-y-4">
              {preferences.map((preference) => (
                <li
                  className="rounded-md border p-4 shadow-sm"
                  key={preference.id ?? preference.key}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base">
                        {preference.key}
                      </h3>
                      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(preference.value, null, 2)}
                      </pre>
                      <p className="text-muted-foreground text-xs">
                        Confidence: {(preference.confidence ?? 1).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      disabled={isDeleting}
                      onClick={() => handleDelete(preference.key)}
                      size="sm"
                      variant="outline"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
