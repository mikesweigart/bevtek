import { useState, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import * as Speech from "expo-speech";
import { colors } from "../lib/theme";

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

    // Clean up markdown-ish formatting for better speech
    const clean = text
      .replace(/\*\*([^*]+)\*\*/g, "$1") // remove bold markers
      .replace(/\*([^*]+)\*/g, "$1") // remove italic markers
      .replace(/^[-•]\s/gm, "") // remove bullet markers
      .replace(/\n{2,}/g, ". ") // double newlines → pause
      .replace(/\n/g, " ") // single newlines → space
      .replace(/\$[\d,.]+/g, (match) => match.replace("$", " dollars ")) // read prices
      .trim();

    const fullText = `${title}. ${clean}`;

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
