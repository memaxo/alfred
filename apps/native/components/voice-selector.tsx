import { Audio } from "expo-av";
import { useState, useEffect } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { trpc } from "@/utils/trpc";
import { Ionicons } from "@expo/vector-icons";

interface VoiceSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function VoiceSelector({ value, onValueChange }: VoiceSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const voicesQuery = trpc.voice.listVoices.useQuery();
  const previewMutation = trpc.voice.previewVoice.useMutation();

  const voices = voicesQuery.data ?? [];
  const selectedVoice = voices.find((v) => v.id === value) ?? 
    (value ? { id: value, name: value } : null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlayPreview = async (voiceId: string) => {
    try {
      if (playingVoice === voiceId && sound) {
        await sound.stopAsync();
        setPlayingVoice(null);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setPlayingVoice(voiceId);

      const result = await previewMutation.mutateAsync({
        voice: voiceId,
        text: "Hello, this is a preview of my voice.",
      });

      const uri = `data:${result.mimeType};base64,${result.audioBase64}`;
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      setSound(newSound);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoice(null);
        }
      });
    } catch (error) {
      console.error("Failed to play preview", error);
      setPlayingVoice(null);
    }
  };

  const isLoading = voicesQuery.isLoading;

  return (
    <View>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        disabled={isLoading}
        className="flex-row items-center justify-between rounded-md border border-border bg-background px-4 py-3"
      >
        <Text className={selectedVoice ? "text-foreground" : "text-muted-foreground"}>
          {isLoading ? "Loading voices..." : (selectedVoice?.name ?? "Select a voice...")}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#aaa" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="h-2/3 rounded-t-xl bg-background p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-bold text-xl text-foreground">Select Voice</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#aaa" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {voices.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  className="flex-row items-center justify-between border-b border-border py-4"
                  onPress={() => {
                    onValueChange?.(voice.id);
                    setModalVisible(false);
                  }}
                >
                  <View className="flex-row items-center flex-1">
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent selection when clicking play
                        handlePlayPreview(voice.id);
                      }}
                      disabled={previewMutation.isPending && playingVoice === voice.id && !sound}
                      className="mr-3 rounded-full bg-muted p-2"
                    >
                        {playingVoice === voice.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="play" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>
                    <Text className="font-medium text-foreground">{voice.name}</Text>
                  </View>
                  {value === voice.id && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
