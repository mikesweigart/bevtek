import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import GuidedFlow from "../components/GuidedFlow";

type ChatMessage = { role: "user" | "assistant"; content: string };

const PROMPTS = [
  { icon: "🍷", text: "What wine pairs with steak tonight?" },
  { icon: "🥃", text: "Recommend a smooth bourbon under $60" },
  { icon: "🎁", text: "I need a gift under $50" },
  { icon: "☀️", text: "Something fun for a summer BBQ" },
  { icon: "🍸", text: "A cocktail I've never tried before" },
];

const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://bevtek-web.vercel.app";

/**
 * Customer-facing Gabby chat. Posts to /api/gabby/chat on the web app,
 * which runs chatWithGabby() grounded in the store's real inventory.
 *
 * For employees, this same screen works as the "Ask Gabby" floor-help
 * tab — staff use Gabby to channel recommendations to the shopper
 * they're helping.
 */
export default function AskGabbyScreen() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<"chat" | "guided">("chat");
  // Stable per-mount session id so the owner's Conversations dashboard
  // groups this whole chat thread under one session, not one row per turn.
  const sessionIdRef = useRef<string>(
    `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const scrollRef = useRef<ScrollView>(null);

  function toggleSpeak(idx: number, text: string) {
    if (speakingIdx === idx) {
      Speech.stop();
      setSpeakingIdx(null);
      return;
    }
    Speech.stop();
    setSpeakingIdx(idx);
    // Pick a warm English voice when available. On iOS, Speech falls back
    // to the system default if no match. Language tag ensures the right
    // locale so numbers / dollar signs get read correctly.
    Speech.speak(text, {
      language: "en-US",
      pitch: 1.08,
      rate: 0.96,
      volume: 1.0,
      onDone: () => setSpeakingIdx((cur) => (cur === idx ? null : cur)),
      onStopped: () => setSpeakingIdx((cur) => (cur === idx ? null : cur)),
      onError: () => setSpeakingIdx(null),
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: urow } = await supabase
            .from("users")
            .select("store_id, stores(id, name)")
            .eq("id", authData.user.id)
            .maybeSingle();
          const s = (urow as any)?.stores;
          if (s) {
            setStoreId(s.id);
            setStoreName(s.name);
            return;
          }
        }
        // Fallback: first store
        const { data, error } = await supabase
          .from("stores")
          .select("id, name")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setStoreId(data.id);
          setStoreName(data.name);
        } else {
          setLoadError("No store connected to this account yet.");
        }
      } catch (e: any) {
        setLoadError(e?.message ?? "Couldn't load store info.");
      }
    })();
  }, []);

  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || sending || !storeId) return;
      setInput("");
      setSending(true);
      const optimistic: ChatMessage[] = [...messages, { role: "user", content: msg }];
      setMessages(optimistic);

      try {
        const res = await fetch(`${WEB_BASE}/api/gabby/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            messages,
            userMessage: msg,
            sessionId: sessionIdRef.current,
          }),
        });
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          // Non-JSON response (HTML 404, auth wall, etc.)
          throw new Error(
            `Server returned ${res.status}. ${text.slice(0, 120)}`,
          );
        }
        if (!res.ok || data.error) {
          setMessages([
            ...optimistic,
            { role: "assistant", content: `Sorry — ${data.error ?? `HTTP ${res.status}`}` },
          ]);
        } else {
          setMessages(data.messages as ChatMessage[]);
        }
      } catch (e: any) {
        setMessages([
          ...optimistic,
          { role: "assistant", content: `Couldn't reach Gabby (${e?.message ?? "network error"}).` },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [input, sending, storeId, messages],
  );

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>G</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Gabby</Text>
          <Text style={styles.tagline}>Find it, Pair it, Love it!</Text>
          <Text style={styles.sub}>
            {loadError
              ? loadError
              : storeName
                ? `${storeName} · online now`
                : "connecting..."}
          </Text>
        </View>
      </View>

      {mode === "guided" ? (
        <GuidedFlow
          storeId={storeId}
          storeName={storeName}
          onExit={() => setMode("chat")}
        />
      ) : (
      <>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {isEmpty && (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyAvatar}>
              <Text style={styles.emptyAvatarText}>G</Text>
            </View>
            <Text style={styles.emptyHello}>Hi, I&apos;m Gabby 👋</Text>
            <Text style={styles.emptyIntro}>
              Your personal beverage concierge
              {storeName ? ` at ${storeName}` : ""}. Ask me anything — pairings,
              gift ideas, what&apos;s new on the shelf, or a cocktail to try tonight.
              I&apos;ll always pick from what&apos;s in stock.
            </Text>
            <TouchableOpacity
              style={styles.guidedCta}
              onPress={() => setMode("guided")}
              disabled={!storeId}
              activeOpacity={0.85}
            >
              <Text style={styles.guidedCtaIcon}>🧭</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.guidedCtaTitle}>Help me find something</Text>
                <Text style={styles.guidedCtaSub}>
                  Tap-through questions — no typing needed.
                </Text>
              </View>
              <Text style={styles.guidedCtaArrow}>›</Text>
            </TouchableOpacity>
            <Text style={styles.emptyLabel}>Or ask me anything</Text>
            {PROMPTS.map((p) => (
              <TouchableOpacity
                key={p.text}
                style={styles.prompt}
                onPress={() => send(p.text)}
                disabled={!storeId}
                activeOpacity={0.7}
              >
                <Text style={styles.promptIcon}>{p.icon}</Text>
                <Text style={styles.promptText}>{p.text}</Text>
                <Text style={styles.promptArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubbleRow,
              m.role === "user" ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" },
            ]}
          >
            <View
              style={[
                styles.bubble,
                m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
              ]}
            >
              <Text style={m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot}>
                {m.content}
              </Text>
              {m.role === "assistant" && (
                <TouchableOpacity
                  onPress={() => toggleSpeak(i, m.content)}
                  style={styles.speakBtn}
                  hitSlop={8}
                >
                  <Text style={styles.speakText}>
                    {speakingIdx === i ? "■ Stop" : "🔊 Listen"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {sending && (
          <View style={[styles.bubble, styles.bubbleBot]}>
            <ActivityIndicator size="small" color={colors.muted} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tell Gabby what you're looking for..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          editable={!sending && !!storeId}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={() => send()}
          disabled={sending || !input.trim() || !storeId}
          style={[
            styles.sendBtn,
            (sending || !input.trim() || !storeId) && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
      </>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF7F0" },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#FBF7F0",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  name: { fontSize: 18, fontWeight: "700", color: colors.fg, letterSpacing: -0.3 },
  tagline: { fontSize: 12, color: colors.gold, fontStyle: "italic", fontWeight: "500", marginTop: 1 },
  sub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  emptyWrap: { alignItems: "stretch", marginTop: 10, gap: 8 },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  emptyAvatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  emptyHello: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.fg,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  emptyIntro: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 18,
  },
  emptyLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "700",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  guidedCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FBF7F0",
    marginBottom: 14,
  },
  guidedCtaIcon: { fontSize: 26 },
  guidedCtaTitle: { fontSize: 15, fontWeight: "700", color: colors.fg },
  guidedCtaSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  guidedCtaArrow: { fontSize: 24, color: colors.gold, fontWeight: "300" },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    gap: 10,
  },
  promptIcon: { fontSize: 18 },
  promptText: { flex: 1, fontSize: 14, color: colors.fg, fontWeight: "500" },
  promptArrow: { fontSize: 22, color: colors.muted, fontWeight: "300" },
  bubbleRow: { flexDirection: "row", width: "100%" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  speakBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  speakText: { fontSize: 11, color: colors.gold, fontWeight: "700" },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderBottomLeftRadius: 4,
  },
  bubbleTextUser: { color: "#fff", fontSize: 14, lineHeight: 20 },
  bubbleTextBot: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.fg,
  },
  sendBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
