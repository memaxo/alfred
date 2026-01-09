/**
 * Shared mock data and setup for settings tests
 */

export const mockVoices = [
  { id: "voice-1", name: "Alfred Classic" },
  { id: "voice-2", name: "Alfred Modern" },
  { id: "voice-3", name: "Alfred Soft" },
  { id: "voice-4", name: "Alfred Deep" },
  { id: "voice-5", name: "Alfred Light" },
];

export const mockUserPrefs = [{ key: "voice.tts", value: "voice-1" }];

export const mockPreferences = [
  { key: "autonomy", value: "medium" },
  { key: "theme", value: "dark" },
  { key: "notifications", value: true },
  { key: "customKey", value: "customValue" },
];

// Shared mock state object
export const mockState = {
  toastErrorMessage: "",
  toastSuccessMessage: "",
};

export function resetMockState() {
  mockState.toastErrorMessage = "";
  mockState.toastSuccessMessage = "";
}

// Mock implementations
export const createTrpcMock = () => ({
  trpc: {
    voice: {
      listVoices: {
        useQuery: () => ({ data: mockVoices, isLoading: false }),
      },
      previewVoice: {
        useMutation: () => ({ mutate: () => {}, isPending: false }),
      },
    },
    user: {
      getPreferences: {
        useQuery: () => ({ data: mockUserPrefs, isLoading: false }),
      },
      setPreference: {
        useMutation: () => ({ mutate: () => {}, isPending: false }),
      },
    },
    preference: {
      list: {
        useQuery: () => ({ data: mockPreferences, isLoading: false }),
      },
      set: {
        useMutation: () => ({ mutate: () => {}, isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: () => {}, isPending: false }),
      },
    },
    useUtils: () => ({
      preference: { list: { invalidate: () => {} } },
      user: { getPreferences: { invalidate: () => {} } },
    }),
  },
});

export const createToastMock = () => ({
  toast: {
    success: (msg: string) => {
      mockState.toastSuccessMessage = msg;
    },
    error: (msg: string) => {
      mockState.toastErrorMessage = msg;
    },
  },
});
