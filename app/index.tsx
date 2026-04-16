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
// Đảm bảo đường dẫn này chính xác với cấu trúc src của bạn
import { supabase } from '../src/utils/supabase'; 
// SỬA LỖI: Import AsyncStorage chuẩn từ gốc thư viện
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Màn hình Đăng nhập (app/index.tsx)
 * Đây là route gốc của ứng dụng (/).
 */
export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      // 1. Thực hiện đăng nhập qua Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password 
      });

      if (error) {
        Alert.alert('Đăng nhập thất bại', error.message);
      } else {
        // 2. Lấy thông tin Role của người dùng từ bảng tb_users
        const { data: userData, error: userError } = await supabase
          .from('tb_users')
          .select('role')
          .eq('id', data.user.id)
          .single(); 

        if (userData) {
          // Lưu role vào bộ nhớ để Layout của Tab có thể kiểm tra quyền (orders tab)
          await AsyncStorage.setItem('userRole', userData.role);
        }

        Alert.alert('Thành công', 'Chào mừng bạn quay lại hệ thống OMS!');
        
        // 3. ĐIỀU CHỈNH ĐIỀU HƯỚNG: 
        // Đưa người dùng vào trang Home bên trong nhóm (tabs)
        // Lưu ý: Bạn cần đổi tên app/(tabs)/index.tsx thành app/(tabs)/home.tsx trước.
        router.replace('/(tabs)/home'); 
      }
    } catch (err: any) {
      Alert.alert('Lỗi hệ thống', 'Đã xảy ra lỗi ngoài ý muốn: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>OMS</Text>
          <Text style={styles.subtitle}>Quản Lý Đơn Hàng Thông Minh</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng Nhập</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Vào hệ thống</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <Text style={styles.footerText}>Bạn mới sử dụng OMS? </Text>          
            <TouchableOpacity onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.version}>Phiên bản 1.1.2</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 50,
    fontWeight: '900',
    color: '#1E40AF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 28,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center'
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  loginButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 15,
  },
  registerLink: {
    color: '#1E40AF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 30,
  }
});