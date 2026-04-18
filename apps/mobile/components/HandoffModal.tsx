import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../lib/theme";
import { supabase } from "../lib/supabase";

type ChatMessage = { role: "user" | "assistant"; content: string };

const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://bevtek-web.vercel.app";

/**
 * Employee-initiated QR hand-off.
 *
 * When the employee taps "Hand to customer", we POST the current
 * conversation to /api/assist/create. The server returns a session id
 * and the store slug. We assemble the public continuation URL and
 * render a QR that the customer scans on their own phone. They land on
 * /s/{slug}/assist/{id} with the conversation already loaded.
 *
 * Short-lived (2h TTL enforced server-side) — no need for explicit
 * revocation in the MVP.
 */
export function HandoffModal({
  visible,
  onClose,
  messages,
}: {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (!token) {
          if (!cancelled) setError("Sign in required to hand off.");
          return;
        }
        const res = await fetch(`${WEB_BASE}/api/assist/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages }),
        });
        const text = await res.text();
        let data: {
          sessionId?: string;
          slug?: string | null;
          error?: string;
        };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Server returned ${res.status}`);
        }
        if (!res.ok || !data.sessionId) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const slug = data.slug ?? "";
        const publicUrl = slug
          ? `${WEB_BASE}/s/${slug}/assist/${data.sessionId}`
          : `${WEB_BASE}/assist/${data.sessionId}`;
        if (!cancelled) setUrl(publicUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? "Couldn't start hand-off.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, messages]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Hand to customer</Text>
          <Text style={styles.subtitle}>
            Ask the customer to scan this with their phone camera. The
            conversation continues on their device.
          </Text>

          <View style={styles.qrBox}>
            {loading && (
              <ActivityIndicator color={colors.gold} size="large" />
            )}
            {!loading && url && (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(url)}`,
                }}
                style={{ width: 240, height: 240 }}
              />
            )}
            {!loading && error && (
              <Text style={styles.error}>{error}</Text>
            )}
          </View>

          {url && (
            <Text style={styles.urlText} numberOfLines={2}>
              {url.replace(/^https?:\/\//, "")}
            </Text>
          )}

          <Text style={styles.hint}>
            Expires in two hours.
          </Text>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.fg,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  qrBox: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF7F0",
    borderRadius: 16,
    marginVertical: 6,
    padding: 10,
  },
  urlText: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: "Menlo",
    textAlign: "center",
    maxWidth: 320,
  },
  hint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  error: {
    fontSize: 13,
    color: "#B42318",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
