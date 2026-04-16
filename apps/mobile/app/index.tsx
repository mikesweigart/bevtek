import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../lib/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/(auth)/login" />;
}
