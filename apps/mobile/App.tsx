import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { colors } from "./lib/theme";

// Screens — shared
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import ProfileScreen from "./screens/ProfileScreen";

// Screens — employee (staff/manager/owner)
import HomeScreen from "./screens/HomeScreen";
import ExploreScreen from "./screens/ExploreScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import HoldsQueueScreen from "./screens/HoldsQueueScreen";

// Screens — shared (employee + customer)
import AskGabbyScreen from "./screens/AskGabbyScreen";

// Screens — customer
import ShopScreen from "./screens/ShopScreen";
import MyHoldsScreen from "./screens/MyHoldsScreen";

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

type Role = "owner" | "manager" | "staff" | "customer" | null;

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
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
 * Employee tab stack — staff, managers, owners. They see BOTH personas:
 * Megan as their Trainer (Home + Ask Megan), Gabby as the floor assistant
 * they channel to help customers (Ask Gabby). Holds queue = incoming
 * customer requests to fulfill.
 */
function EmployeeTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ask Megan" component={ExploreScreen} />
      <Tab.Screen name="Ask Gabby" component={AskGabbyScreen} />
      <Tab.Screen name="Holds" component={HoldsQueueScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * Customer tab stack — shoppers only. Customers never meet Megan; they
 * only interact with Gabby. Shop = browse + hold. Ask Gabby = chat.
 * My Holds = reservations placed.
 */
function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="Ask Gabby" component={AskGabbyScreen} />
      <Tab.Screen name="My Holds" component={MyHoldsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate(s: Session | null) {
      setSession(s);
      if (!s) {
        setRole(null);
        setLoading(false);
        return;
      }
      // Fetch role from public.users. Default to 'customer' when row is
      // missing — new signups from the customer app won't have a users row
      // until they call claim_customer_profile, and we'd rather show them
      // the shopper experience than the staff one.
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

  return (
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
  );
}
