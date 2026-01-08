import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Drawer } from "expo-router/drawer";

import { HeaderButton } from "@/components/header-button";
import { authClient } from "@/lib/auth-client";

const DrawerLayout = () => {
  const { data: session } = authClient.useSession();
  const isAuthenticated = !!session?.user;

  return (
    <Drawer
      screenOptions={() => {
        // Hide drawer completely when not authenticated
        if (!isAuthenticated) {
          return {
            // Hide header completely
            headerShown: false,
            // Disable drawer gesture
            swipeEnabled: false,
            // Hide drawer
            drawerType: "permanent",
            drawerStyle: {
              width: 0,
            },
            // Hide drawer button in header
            headerLeft: () => null,
            // Prevent drawer from opening
            drawerPosition: "left",
          };
        }

        // Default drawer options when authenticated
        return {
          swipeEnabled: true,
          drawerType: "front",
        };
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          headerShown: false,
          drawerLabel: "Home",
          drawerIcon: ({ size, color }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="(tabs)"
        options={() => ({
          headerTitle: "Tabs",
          drawerLabel: "Tabs",
          drawerIcon: ({ size, color }) => (
            <MaterialIcons color={color} name="border-bottom" size={size} />
          ),
          headerRight: () => (
            <Link asChild href="/modal">
              <HeaderButton />
            </Link>
          ),
          // Hide from drawer when not authenticated
          drawerItemStyle: isAuthenticated ? undefined : { display: "none" },
        })}
      />
      <Drawer.Screen
        name="todos"
        options={() => ({
          headerTitle: "Todos",
          drawerLabel: "Todos",
          drawerIcon: ({ size, color }) => (
            <Ionicons color={color} name="checkbox-outline" size={size} />
          ),
          // Hide from drawer when not authenticated
          drawerItemStyle: isAuthenticated ? undefined : { display: "none" },
        })}
      />
      <Drawer.Screen
        name="ai"
        options={() => ({
          headerTitle: "AI",
          drawerLabel: "AI",
          drawerIcon: ({ size, color }) => (
            <Ionicons
              color={color}
              name="chatbubble-ellipses-outline"
              size={size}
            />
          ),
          // Hide from drawer when not authenticated
          drawerItemStyle: isAuthenticated ? undefined : { display: "none" },
        })}
      />
      <Drawer.Screen
        name="call"
        options={{
          headerShown: false,
          drawerLabel: "Call Alfred",
          drawerIcon: ({ size, color }) => (
            <Ionicons color={color} name="call-outline" size={size} />
          ),
          // Hide from drawer but still accessible via navigation
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer>
  );
};

export default DrawerLayout;
