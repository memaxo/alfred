import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Drawer } from "expo-router/drawer";

import { HeaderButton } from "@/components/header-button";

const DrawerLayout = () => (
  <Drawer>
    <Drawer.Screen
      name="index"
      options={{
        headerTitle: "Home",
        drawerLabel: "Home",
        drawerIcon: ({ size, color }) => (
          <Ionicons color={color} name="home-outline" size={size} />
        ),
      }}
    />
    <Drawer.Screen
      name="(tabs)"
      options={{
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
      }}
    />
    <Drawer.Screen
      name="todos"
      options={{
        headerTitle: "Todos",
        drawerLabel: "Todos",
        drawerIcon: ({ size, color }) => (
          <Ionicons color={color} name="checkbox-outline" size={size} />
        ),
      }}
    />
    <Drawer.Screen
      name="ai"
      options={{
        headerTitle: "AI",
        drawerLabel: "AI",
        drawerIcon: ({ size, color }) => (
          <Ionicons
            color={color}
            name="chatbubble-ellipses-outline"
            size={size}
          />
        ),
      }}
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

export default DrawerLayout;
