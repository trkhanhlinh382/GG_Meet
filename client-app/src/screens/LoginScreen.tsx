import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { http } from "../api/http";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [loginMode, setLoginMode] = useState<"email" | "token">("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    if (!email) {
      Alert.alert("Lỗi", "Vui lòng nhập địa chỉ Email");
      return;
    }
    setLoading(true);
    try {
      const response = await http.post("/auth/dev-login", {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim() || undefined,
      });

      const { accessToken } = response.data;
      await AsyncStorage.setItem("token", accessToken);
      navigation.replace("Dashboard");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại cấu hình IP Server.";
      Alert.alert("Lỗi đăng nhập", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!tokenInput.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã Token JWT");
      return;
    }
    setLoading(true);
    try {
      await AsyncStorage.setItem("token", tokenInput.trim());
      // Thử gọi API profile hoặc dashboard để xác thực token
      await http.get("/dashboard");
      navigation.replace("Dashboard");
    } catch (err) {
      await AsyncStorage.removeItem("token");
      Alert.alert("Lỗi xác thực", "Mã Token không hợp lệ hoặc đã hết hạn.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          {/* Logo & Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GG</Text>
            </View>
            <Text style={styles.title}>GG Meet</Text>
            <Text style={styles.subtitle}>Họp thông minh, kết nối không giới hạn</Text>
          </View>

          {/* Login Form Card */}
          <View style={styles.card}>
            {/* Mode Switcher */}
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[styles.modeButton, loginMode === "email" && styles.activeMode]}
                onPress={() => setLoginMode("email")}
              >
                <Text style={[styles.modeText, loginMode === "email" && styles.activeModeText]}>
                  Email Dev
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, loginMode === "token" && styles.activeMode]}
                onPress={() => setLoginMode("token")}
              >
                <Text style={[styles.modeText, loginMode === "token" && styles.activeModeText]}>
                  Dán Token JWT
                </Text>
              </TouchableOpacity>
            </View>

            {loginMode === "email" ? (
              <View>
                <Text style={styles.label}>Địa chỉ Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="nhap.email@example.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Text style={styles.label}>Họ và Tên (Không bắt buộc)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor="#475569"
                  value={fullName}
                  onChangeText={setFullName}
                />

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleDevLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Đăng Nhập Thử Nghiệm</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>Mã Token JWT (Lấy từ LocalStorage Web)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Dán token JWT ở đây..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={4}
                  value={tokenInput}
                  onChangeText={setTokenInput}
                />

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleTokenLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Xác Thực & Đăng Nhập</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1117",
  },
  innerContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#1a1d27",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  modeContainer: {
    flexDirection: "row",
    backgroundColor: "#22263a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  activeMode: {
    backgroundColor: "#6366f1",
  },
  modeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  activeModeText: {
    color: "#ffffff",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#22263a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    color: "#f1f5f9",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
