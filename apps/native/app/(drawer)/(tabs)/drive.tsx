import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "@/lib/use-color-scheme";
import { trpcClient } from "@/utils/trpc";
import { useVoiceSessionNative, registerVoiceTasks, drain } from "@/lib/voice";
import { setupCarPlay } from "@/lib/carplay";
import { ensureForegroundService } from "@/lib/voice/service";

const THREAD_ID = "drive-mode";

type Status = "idle" | "holding" | "thinking" | "responding" | "error";

export default function DriveScreen() {
	const { isDarkColorScheme } = useColorScheme();
	const palette = useMemo(
		() => ({
			background: isDarkColorScheme ? "bg-black" : "bg-white",
			text: isDarkColorScheme ? "text-white" : "text-black",
			subtle: isDarkColorScheme ? "text-gray-400" : "text-gray-500",
			buttonIdle: isDarkColorScheme ? "bg-sky-500" : "bg-blue-500",
			buttonActive: "bg-emerald-500",
			buttonError: "bg-rose-500",
		}),
		[isDarkColorScheme],
	);

	const voice = useVoiceSessionNative(trpcClient);
	const [status, setStatus] = useState<Status>("idle");
	const [reply, setReply] = useState("");

	useEffect(() => {
		if (Platform.OS === "android") {
			void ensureForegroundService();
		}
	}, []);

	useEffect(() => {
		registerVoiceTasks(async () => {
			await drain(async (_item) => undefined);
		});
	}, []);

	useEffect(() => {
		setupCarPlay(voice, (text) => {
			setStatus("thinking");
			setReply(text);
		});
	}, [voice]);

	const handlePressIn = useCallback(async () => {
		setStatus("holding");
		setReply("");
		voice.clear();
		await voice.start();
	}, [voice]);

	const handlePressOut = useCallback(async () => {
		let finalStatus: Status = "idle";
		try {
			setStatus("thinking");
			const result = await voice.stopAndTranscribe();
			if (!result?.text) {
				setStatus("idle");
				return;
			}
			const response = await (trpcClient as any).assistant.generate.mutate({
				thread: THREAD_ID,
				resource: THREAD_ID,
				messages: [{ role: "user", content: result.text }],
			});
			const answer = response?.text ?? "";
			setReply(answer);
			setStatus("responding");
			await voice.speak({
				text: answer || "I heard you.",
				format: "mp3",
				voice: "alloy",
			});
			finalStatus = "idle";
		} catch (error) {
			setStatus("error");
			finalStatus = "error";
		} finally {
			setStatus(finalStatus);
		}
	}, [voice]);

	const label = useMemo(() => {
		switch (status) {
			case "holding":
				return "Listening…";
			case "thinking":
				return "Thinking…";
			case "responding":
				return "Speaking…";
			case "error":
				return "Check connection";
			default:
				return "Hold to talk";
		}
	}, [status]);

	const buttonStyle =
		status === "error"
			? palette.buttonError
			: status === "holding"
				? palette.buttonActive
				: palette.buttonIdle;

	return (
		<View className={`flex-1 ${palette.background} items-center justify-center px-6`}>
			<Text className={`text-2xl font-semibold ${palette.text} mb-8`} accessibilityRole="header">
				Drive Mode
			</Text>
			<Pressable
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				className={`h-48 w-48 rounded-full items-center justify-center ${buttonStyle} shadow-lg`}
				accessibilityRole="button"
				accessibilityHint="Press and hold to talk with Alfred. Release to send."
			>
				<Text className="text-white text-xl font-semibold">{label}</Text>
			</Pressable>
			<View className="mt-10 w-full items-center">
				<Text className={`text-base ${palette.subtle}`}>Transcript</Text>
				<Text className={`mt-2 text-lg ${palette.text} text-center`} numberOfLines={3}>
					{voice.state.transcript || "—"}
				</Text>
			</View>
			<View className="mt-8 w-full items-center">
				<Text className={`text-base ${palette.subtle}`}>Response</Text>
				<Text className={`mt-2 text-lg ${palette.text} text-center`} numberOfLines={3}>
					{reply || "Awaiting reply"}
				</Text>
			</View>
			{voice.state.error ? (
				<Text className="mt-8 text-sm text-rose-500 text-center">
					{voice.state.error}
				</Text>
			) : null}
		</View>
	);
}
