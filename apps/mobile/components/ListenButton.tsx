import { useState, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import * as Speech from "expo-speech";
import { colors } from "../lib/theme";
import { prepareForSpeech } from "../lib/voiceSafety";

type Props = {
  text: string;
  title: string;
};

export function ListenButton({ text, title }: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  async function toggle() {
    if (playing) {
      Speech.stop();
      setPlaying(false);
      return;
    }

    setPlaying(true);

    // Single source of truth for TTS prep lives in lib/voiceSafety so the
    // responsibility cue + sponsored-scrub logic is consistent across
    // every voice surface (Megan training modules, Gabby chat, etc.).
    const fullText = prepareForSpeech(`${title}. ${text}`);

    Speech.speak(fullText, {
      language: "en-US",
      rate: 0.95,
      pitch: 1.0,
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  }

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={[s.button, playing && s.buttonActive]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={s.icon}>{playing ? "⏸" : "🔊"}</Text>
        <Text style={[s.label, playing && s.labelActive]}>
          {playing ? "Listening... tap to stop" : "Listen to this module"}
        </Text>
      </TouchableOpacity>
      {!playing && (
        <Text style={s.hint}>
          Learn while stocking — Megan reads it to you
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FBF7F0",
  },
  buttonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  icon: { fontSize: 20 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gold,
  },
  labelActive: {
    color: "#fff",
  },
  hint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    marginLeft: 4,
  },
});
