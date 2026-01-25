import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { trpc } from "@/utils/trpc";

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
  const selectedVoice =
    voices.find((v) => v.id === value) ??
    (value ? { id: value, name: value } : null);

  useEffect(
    () => () => {
      if (sound) {
        sound.unloadAsync();
      }
    },
    [sound]
  );

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
    } catch {
      setPlayingVoice(null);
    }
  };

  const { isLoading } = voicesQuery;

  return (
    <View>
      <TouchableOpacity
        className="flex-row items-center justify-between rounded-md border border-border bg-background px-4 py-3"
        disabled={isLoading}
        onPress={() => setModalVisible(true)}
      >
        <Text
          className={
            selectedVoice ? "text-foreground" : "text-muted-foreground"
          }
        >
          {isLoading
            ? "Loading voices..."
            : (selectedVoice?.name ?? "Select a voice...")}
        </Text>
        <Ionicons color="#aaa" name="chevron-down" size={20} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        transparent={true}
        visible={modalVisible}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="h-2/3 rounded-t-xl bg-background p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-bold text-foreground text-xl">
                Select Voice
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons color="#aaa" name="close" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {voices.map((voice) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between border-border border-b py-4"
                  key={voice.id}
                  onPress={() => {
                    onValueChange?.(voice.id);
                    setModalVisible(false);
                  }}
                >
                  <View className="flex-1 flex-row items-center">
                    <TouchableOpacity
                      className="mr-3 rounded-full bg-muted p-2"
                      disabled={
                        previewMutation.isPending &&
                        playingVoice === voice.id &&
                        !sound
                      }
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent selection when clicking play
                        handlePlayPreview(voice.id);
                      }}
                    >
                      {playingVoice === voice.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons color="#fff" name="play" size={16} />
                      )}
                    </TouchableOpacity>
                    <Text className="font-medium text-foreground">
                      {voice.name}
                    </Text>
                  </View>
                  {value === voice.id && (
                    <Ionicons color="#fff" name="checkmark" size={20} />
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
