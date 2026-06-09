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
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { http } from "../api/http";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Advanced Dev States
  const [showDevMode, setShowDevMode] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // Google Sign-In Chooser State
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);

  // Pre-configured Demo Google Accounts for easy Thesis Defense presentation
  const demoAccounts = [
    {
      name: "Nguyễn Văn A (Sinh viên)",
      email: "sinhvien.a@gmail.com",
      role: "Guest",
      avatarBg: "#ef4444",
    },
    {
      name: "Trần Thị B (Giảng viên)",
      email: "giangvien.b@gmail.com",
      role: "Host/Teacher",
      avatarBg: "#3b82f6",
    },
    {
      name: "Phạm Minh C (Quản trị viên)",
      email: "admin.c@gmail.com",
      role: "System Admin",
      avatarBg: "#10b981",
    },
  ];

  // standard login handler (calling dev-login in the backend)
  const handleEmailLogin = async () => {
    if (!email) {
      Alert.alert("Lỗi", "Vui lòng nhập địa chỉ Email");
      return;
    }
    setLoading(true);
    try {
      const response = await http.post("/auth/dev-login", {
        email: email.trim().toLowerCase(),
      });

      const { accessToken } = response.data;
      await AsyncStorage.setItem("token", accessToken);
      navigation.replace("Dashboard");
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra kết nối mạng và IP Server.";
      Alert.alert("Lỗi đăng nhập", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // standard register handler (calling dev-login in backend)
  const handleEmailRegister = async () => {
    if (!email || !fullName) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ Họ tên và Email");
      return;
    }
    setLoading(true);
    try {
      const response = await http.post("/auth/dev-login", {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
      });

      const { accessToken } = response.data;
      await AsyncStorage.setItem("token", accessToken);
      navigation.replace("Dashboard");
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        "Đăng ký thất bại. Vui lòng kiểm tra cấu hình IP Server.";
      Alert.alert("Lỗi đăng ký", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // google chooser option select handler
  const handleGoogleAccountSelect = async (account: typeof demoAccounts[0]) => {
    setShowGoogleChooser(false);
    setLoading(true);
    try {
      const response = await http.post("/auth/dev-login", {
        email: account.email,
        fullName: account.name.split(" (")[0], // Lấy họ tên thật trước phần chú thích
      });

      const { accessToken } = response.data;
      await AsyncStorage.setItem("token", accessToken);
      navigation.replace("Dashboard");
    } catch (err: any) {
      Alert.alert(
        "Lỗi kết nối",
        "Không thể xác thực tài khoản Google Mock. Hãy kiểm tra kết nối tới Server."
      );
    } finally {
      setLoading(false);
    }
  };

  // advanced raw JWT token login
  const handleTokenLogin = async () => {
    if (!tokenInput.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã Token JWT");
      return;
    }
    setLoading(true);
    try {
      await AsyncStorage.setItem("token", tokenInput.trim());
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
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
          {/* Logo & Slogan Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GG</Text>
            </View>
            <Text style={styles.title}>GG Meet</Text>
            <Text style={styles.subtitle}>Họp thông minh, kết nối không giới hạn</Text>
          </View>

          {/* Tab Selection */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "login" && styles.activeTab]}
              onPress={() => setActiveTab("login")}
            >
              <Text style={[styles.tabText, activeTab === "login" && styles.activeTabText]}>
                Đăng nhập
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "register" && styles.activeTab]}
              onPress={() => setActiveTab("register")}
            >
              <Text style={[styles.tabText, activeTab === "register" && styles.activeTabText]}>
                Đăng ký
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            {activeTab === "login" ? (
              // LOGIN FORM
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

                <Text style={styles.label}>Mật khẩu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleEmailLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Đăng nhập</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // REGISTER FORM
              <View>
                <Text style={styles.label}>Họ và Tên</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor="#475569"
                  value={fullName}
                  onChangeText={setFullName}
                />

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

                <Text style={styles.label}>Mật khẩu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleEmailRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Đạo tài khoản & Đăng nhập</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* OAUTH SECTION */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => setShowGoogleChooser(true)}
              disabled={loading}
            >
              <View style={styles.googleIconContainer}>
                {/* Custom drew multi-colored Google logo styling */}
                <Text style={styles.googleLetter}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Đăng nhập bằng Google</Text>
            </TouchableOpacity>
          </View>

          {/* Toggle Advanced Dev Options */}
          <TouchableOpacity
            style={styles.devLink}
            onPress={() => setShowDevMode(!showDevMode)}
          >
            <Text style={styles.devLinkText}>
              {showDevMode ? "Ẩn cấu hình nâng cao ▲" : "Cấu hình nâng cao (Token JWT) ▼"}
            </Text>
          </TouchableOpacity>

          {/* Collapsible Advanced Form */}
          {showDevMode && (
            <View style={styles.devCard}>
              <Text style={styles.devTitle}>CẤU HÌNH TOKEN TRỰC TIẾP</Text>
              <Text style={styles.devDescription}>
                Dành cho nhà phát triển: Copy mã Token JWT từ LocalStorage trên Web và dán vào đây để bypass đăng nhập nhanh.
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Dán token JWT ở đây..."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={3}
                value={tokenInput}
                onChangeText={setTokenInput}
              />
              <TouchableOpacity
                style={styles.devButton}
                onPress={handleTokenLogin}
                disabled={loading}
              >
                <Text style={styles.devButtonText}>Xác thực & Vào hệ thống</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* GOOGLE NATIVE-LOOK ACCOUNT CHOOSER DIALOG */}
          <Modal
            visible={showGoogleChooser}
            transparent
            animationType="fade"
            onRequestClose={() => setShowGoogleChooser(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.googleModalHeader}>
                  <View style={styles.miniGoogleIcon}>
                    <Text style={styles.googleLetterMini}>G</Text>
                  </View>
                  <Text style={styles.modalTitle}>Chọn tài khoản</Text>
                  <Text style={styles.modalSubtitle}>để tiếp tục đến GG Meet</Text>
                </View>

                <View style={styles.accountList}>
                  {demoAccounts.map((account, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.accountRow}
                      onPress={() => handleGoogleAccountSelect(account)}
                    >
                      <View style={[styles.avatarCircle, { backgroundColor: account.avatarBg }]}>
                        <Text style={styles.avatarLetter}>
                          {account.name[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountEmail}>{account.email}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={styles.accountRow}
                    onPress={() => {
                      setShowGoogleChooser(false);
                      setActiveTab("login");
                      setEmail("");
                      Alert.alert(
                        "Hướng dẫn",
                        "Vui lòng điền trực tiếp email của bạn vào ô đăng nhập chính."
                      );
                    }}
                  >
                    <View style={[styles.avatarCircle, styles.addAccountCircle]}>
                      <Text style={styles.addAccountIcon}>+</Text>
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountName, { color: "#6366f1" }]}>
                        Sử dụng một tài khoản khác
                      </Text>
                      <Text style={styles.accountEmail}>Đăng nhập bằng email bất kỳ</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalFooter}>
                  <Text style={styles.footerText}>
                    Để tiếp tục, Google sẽ chia sẻ tên, địa chỉ email, tùy chọn ngôn ngữ và ảnh hồ sơ của bạn với GG Meet.
                  </Text>
                  <TouchableOpacity
                    style={styles.closeModalButton}
                    onPress={() => setShowGoogleChooser(false)}
                  >
                    <Text style={styles.closeModalButtonText}>HỦY BỎ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1117",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
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
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1e2230",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: "#6366f1",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  activeTabText: {
    color: "#ffffff",
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
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    color: "#f1f5f9",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  primaryButton: {
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
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dividerText: {
    color: "#64748b",
    fontSize: 12,
    paddingHorizontal: 10,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  googleLetter: {
    color: "#4285F4",
    fontWeight: "900",
    fontSize: 15,
  },
  googleButtonText: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "600",
  },
  devLink: {
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 8,
  },
  devLinkText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  devCard: {
    backgroundColor: "#11131a",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  devTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  devDescription: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
    marginBottom: 12,
  },
  devButton: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  devButtonText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    fontSize: 13,
  },
  // MODAL GOOGLE ACCOUNT CHOOSER STYLING
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 8, // Google-style block layout
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  googleModalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  miniGoogleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  googleLetterMini: {
    fontSize: 20,
    fontWeight: "900",
    color: "#4285F4",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "400",
    color: "#202124",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#5f6368",
    marginTop: 4,
  },
  accountList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    marginBottom: 16,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3c4043",
  },
  accountEmail: {
    fontSize: 12,
    color: "#5f6368",
    marginTop: 1,
  },
  addAccountCircle: {
    backgroundColor: "#f1f3f4",
    borderWidth: 1,
    borderColor: "#dadce0",
  },
  addAccountIcon: {
    color: "#1a73e8",
    fontSize: 20,
    fontWeight: "500",
  },
  modalFooter: {
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: "#5f6368",
    lineHeight: 16,
    marginBottom: 20,
  },
  closeModalButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeModalButtonText: {
    color: "#1a73e8",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
