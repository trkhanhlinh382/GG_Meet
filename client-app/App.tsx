import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { MeetingDetailScreen } from "./src/screens/MeetingDetailScreen";
import { MeetingRoomScreen } from "./src/screens/MeetingRoomScreen";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  MeetingDetail: { meetingId: string; invitationId?: string };
  MeetingRoom: { meetingId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

// Định nghĩa Dark Theme đặc trưng cao cấp đồng bộ với Web
const PremiumDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0f1117",
    card: "#1a1d27",
    text: "#f1f5f9",
    border: "rgba(255, 255, 255, 0.08)",
    primary: "#6366f1", // Màu Indigo chủ đạo
  },
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        setToken(storedToken);
      } catch (e) {
        console.error("Lỗi kiểm tra token:", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkToken();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={PremiumDarkTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={token ? "Dashboard" : "Login"}
        screenOptions={{
          headerStyle: {
            backgroundColor: "#1a1d27",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.08)",
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: "#f1f5f9",
          headerTitleStyle: {
            fontWeight: "600",
            fontSize: 16,
          },
          cardStyle: { backgroundColor: "#0f1117" },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "GG Meet" }}
        />
        <Stack.Screen
          name="MeetingDetail"
          component={MeetingDetailScreen}
          options={{ title: "Chi tiết cuộc họp" }}
        />
        <Stack.Screen
          name="MeetingRoom"
          component={MeetingRoomScreen}
          options={{ headerShown: false }} // Ẩn header để tối ưu diện tích cuộc gọi video
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
    alignItems: "center",
    justifyContent: "center",
  },
});
