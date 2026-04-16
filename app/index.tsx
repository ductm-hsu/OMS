import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
// Import file cấu hình supabase
import { supabase } from '../src/utils/supabase'; 

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Hàm xử lý khi bấm nút Đăng nhập
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setLoading(true);
    
    // Gọi API của Supabase để xác thực
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Đăng nhập thất bại', error.message);
    } else {
      // Nếu thành công, in ra log để kiểm tra và sau này sẽ chuyển hướng
      console.log('User ID:', data.user.id);
      Alert.alert('Thành công', 'Chào mừng bạn quay lại OMS!');
      router.replace('/(tabs)');
    }
    
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>OMS</Text>
          <Text style={styles.subtitle}>Hệ thống Quản lý Đơn hàng</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email của bạn"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>          
            <TouchableOpacity onPress={() => router.push('/register' as never)}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Phần CSS (StyleSheet)
const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Đổi từ flex: 1 thành flexGrow: 1 để ScrollView hoạt động chuẩn
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loginButton: {
    backgroundColor: '#0056b3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#6c757d',
    fontSize: 15,
  },
  registerLink: {
    color: '#0056b3',
    fontSize: 15,
    fontWeight: 'bold',
  },
});