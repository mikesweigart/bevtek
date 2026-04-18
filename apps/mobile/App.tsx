import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { initSentry, setSentryUser } from "./lib/sentry";

// Sentry init runs at module evaluation time — earlier is better so
// we catch errors thrown during the first render pass. DSN-gated so
// this is a no-op when EXPO_PUBLIC_SENTRY_DSN is unset.
initSentry();
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { colors } from "./lib/theme";
import { getAgeState, type AgeGateState } from "./lib/ageGate";
import AgeGateScreen from "./screens/AgeGateScreen";

// Auth
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";

// Shared
import ProfileScreen from "./screens/ProfileScreen";
import AskGabbyScreen from "./screens/AskGabbyScreen";

// Employee
import HomeScreen from "./screens/HomeScreen";
import ExploreScreen from "./screens/ExploreScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import HoldsQueueScreen from "./screens/HoldsQueueScreen";

// Customer
import ShopScreen from "./screens/ShopScreen";
// MyHoldsScreen + SavedScreen kept as standalone routes — the unified
// SummaryScreen ("My List") now owns the primary nav slot, but these
// remain on disk so we can deep-link to a single section if needed.
import SummaryScreen from "./screens/SummaryScreen";

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

type Role = "owner" | "manager" | "staff" | "customer" | null;

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

/**
 * Nested stack inside the Home tab so we can push deeper screens
 * (Leaderboard) without bloating the bottom bar. Keeps 5 tabs — the UX
 * sweet spot — while still giving Leaderboard a prominent call-to-action
 * on the Home dashboard.
 */
function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          headerShown: true,
          title: "Team Leaderboard",
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700", color: colors.fg },
        }}
      />
    </HomeStack.Navigator>
  );
}

function ProfileStackNav() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          headerShown: true,
          title: "Team Leaderboard",
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700", color: colors.fg },
        }}
      />
    </ProfileStack.Navigator>
  );
}

const tabScreenOptions = {
  tabBarActiveTintColor: colors.gold,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    height: 84,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "500" as const },
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTitleStyle: {
    fontWeight: "700" as const,
    fontSize: 18,
    color: colors.fg,
  },
};

/**
 * Employee tabs. Personas shown as nouns ("Megan", "Gabby") — not verbs —
 * because the persona IS the thing, not something you "ask".
 * - Home: Trainer dashboard (stars, streak, featured modules, leaderboard link)
 * - Megan: training modules (the Trainer persona)
 * - Gabby: floor assistant (channel Gabby to help a shopper)
 * - Holds: customer hold queue (fulfillment)
 * - Profile: role + account
 *
 * Route names stay "Explore" and "AskGabby" under the hood so existing
 * nav.navigate("Explore", ...) calls from HomeScreen keep working.
 */
function EmployeeTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeStackNav}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarLabel: "Megan", title: "Megan" }}
      />
      <Tab.Screen
        name="AskGabby"
        component={AskGabbyScreen}
        options={{ tabBarLabel: "Gabby", title: "Gabby", headerShown: false }}
      />
      <Tab.Screen
        name="Holds"
        component={HoldsQueueScreen}
        options={{ title: "Customer Holds" }}
      />
      <Tab.Screen
        name="MyList"
        component={SummaryScreen}
        options={{ tabBarLabel: "My List", headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNav}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

/**
 * Customer tabs — shoppers only meet Gabby. Megan is never surfaced.
 */
function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen
        name="AskGabby"
        component={AskGabbyScreen}
        options={{ tabBarLabel: "Gabby", title: "Gabby", headerShown: false }}
      />
      {/*
       * "My List" is the unified end-of-session summary — cart, saved,
       * active holds, and the things they grabbed themselves, all in one
       * place with text/email/QR export. Replaces the earlier split
       * Saved + My Holds tabs so shoppers don't have to bounce around.
       */}
      <Tab.Screen
        name="MyList"
        component={SummaryScreen}
        options={{ tabBarLabel: "My List", headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState<AgeGateState>("unknown");

  useEffect(() => {
    getAgeState().then(setAge);
  }, []);

  useEffect(() => {
    async function hydrate(s: Session | null) {
      setSession(s);
      // Identify the user in Sentry so crashes cluster by account.
      // No-op when Sentry isn't configured.
      setSentryUser(s?.user ? { id: s.user.id, email: s.user.email } : null);
      if (!s) {
        setRole(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", s.user.id)
        .maybeSingle();
      const r = (data?.role as Role) ?? "customer";
      setRole(r);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => hydrate(s));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => hydrate(s));

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const isEmployee = role === "owner" || role === "manager" || role === "staff";

  // Age gate: employees bypass once logged in (they're on-shift staff).
  // Everyone else — unauthed visitors and customer accounts — must pass
  // the 21+ check before seeing any product content. Mirrors web cookie
  // semantics (30-day TTL) via expo-secure-store.
  const mustGate = !isEmployee && age !== "confirmed";
  if (mustGate) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AgeGateScreen state={age} onChange={setAge} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!session ? (
          <AuthNavigator />
        ) : isEmployee ? (
          <EmployeeTabs />
        ) : (
          <CustomerTabs />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
