import { View, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

/**
 * Lightweight markdown renderer for module content.
 * Supports: **bold**, headers (lines wrapped in **), bullet lists (- or •),
 * numbered lists (1., 2.), and blank-line paragraph breaks.
 * No external dependencies.
 */
export function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line → spacer
    if (!trimmed) {
      blocks.push(<View key={`sp-${i}`} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // Header: whole line wrapped in **...**
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*:?$/);
    if (headerMatch) {
      blocks.push(
        <Text key={`h-${i}`} style={s.header}>
          {headerMatch[1]}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet
    if (/^[-•]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-•]\s+/, "");
      blocks.push(
        <View key={`b-${i}`} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{renderInline(content)}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      blocks.push(
        <View key={`n-${i}`} style={s.bulletRow}>
          <Text style={s.numDot}>{numMatch[1]}.</Text>
          <Text style={s.bulletText}>{renderInline(numMatch[2])}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Regular paragraph
    blocks.push(
      <Text key={`p-${i}`} style={s.paragraph}>
        {renderInline(trimmed)}
      </Text>
    );
    i++;
  }

  return <View>{blocks}</View>;
}

/** Inline: **bold** segments */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <Text key={idx} style={{ fontWeight: "700" }}>
          {m[1]}
        </Text>
      );
    }
    return <Text key={idx}>{part}</Text>;
  });
}

const s = StyleSheet.create({
  header: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.gold,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.fg,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 15,
    color: colors.gold,
    marginRight: 8,
    lineHeight: 23,
  },
  numDot: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.gold,
    marginRight: 8,
    lineHeight: 23,
    minWidth: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: colors.fg,
  },
});
