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
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

type ChatMessage = { role: "user" | "assistant"; content: string };

const PROMPTS = [
  "What wine pairs with steak?",
  "Recommend a smooth bourbon",
  "I need a gift under $50",
  "Something fun for a summer BBQ",
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
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
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .limit(1)
        .maybeSingle();
      if (data) {
        setStoreId(data.id);
        setStoreName(data.name);
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
          body: JSON.stringify({ storeId, messages, userMessage: msg }),
        });
        const data = await res.json();
        if (data.error) {
          setMessages([...optimistic, { role: "assistant", content: `Sorry — ${data.error}` }]);
        } else {
          setMessages(data.messages as ChatMessage[]);
        }
      } catch (e: any) {
        setMessages([
          ...optimistic,
          { role: "assistant", content: `Couldn't reach Gabby (${e?.message ?? "network"}).` },
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>G</Text>
        </View>
        <View>
          <Text style={styles.name}>Gabby</Text>
          <Text style={styles.sub}>
            {storeName ? `${storeName} · online now` : "connecting..."}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {isEmpty && (
          <View style={{ gap: 10, marginTop: 20 }}>
            <Text style={styles.intro}>
              Hi! I&apos;m Gabby — your personal beverage expert
              {storeName ? ` at ${storeName}` : ""}. What can I help you find?
            </Text>
            {PROMPTS.map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.prompt}
                onPress={() => send(p)}
                disabled={!storeId}
              >
                <Text style={styles.promptText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
            ]}
          >
            <Text style={m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot}>
              {m.content}
            </Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  name: { fontSize: 15, fontWeight: "700", color: colors.fg },
  sub: { fontSize: 10, color: colors.muted },
  intro: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 19,
  },
  prompt: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  promptText: { fontSize: 13, color: colors.fg },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
