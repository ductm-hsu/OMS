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
// Đảm bảo file supabase.js nằm đúng cấu trúc thư mục src/utils/
import { supabase } from '../src/utils/supabase'; 
// SỬA LỖI: Import AsyncStorage chuẩn từ gốc thư viện
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Màn hình Đăng nhập (app/index.tsx)
 * Thực hiện xác thực và điều hướng dựa trên vai trò (customer, shipper, manager)
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
      // 1. Đăng nhập qua Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password 
      });

      if (error) {
        Alert.alert('Đăng nhập thất bại', error.message);
      } else {
        // 2. Lấy thông tin Role của người dùng từ bảng tb_users
        const { data: userData, error: roleError } = await supabase
          .from('tb_users')
          .select('role')
          .eq('id', data.user.id)
          .single(); 

        if (roleError) throw roleError;

        if (userData) {
          // Lưu role vào bộ nhớ đệm để các màn hình khác sử dụng
          await AsyncStorage.setItem('userRole', userData.role);
          
          Alert.alert('Thành công', `Chào mừng ${email} quay lại với vai trò ${userData.role.toUpperCase()}!`);
          
          // 3. ĐỊNH TUYẾN THEO ROLE
          // Nếu là shipper -> Vào màn hình Nhận đơn
          // Nếu là customer -> Vào Dashboard Trang chủ
          if (userData.role === 'shipper') {
            router.replace('/(tabs)/shipper-home');
          } else {
            router.replace('/(tabs)/home');
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Lỗi hệ thống', 'Không thể xác định quyền hạn: ' + err.message);
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
          <Text style={styles.subtitle}>Hệ thống Điều phối Vận chuyển</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email tài khoản</Text>
            <TextInput
              style={styles.input}
              placeholder="shipper@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#94A3B8"
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
              placeholderTextColor="#94A3B8"
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
              <Text style={styles.loginButtonText}>Đăng nhập ngay</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>          
            <TouchableOpacity onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 24 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, fontWeight: '900', color: '#1E40AF', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  
  card: { 
    backgroundColor: '#ffffff', 
    padding: 28, 
    borderRadius: 24, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 }
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 24, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 4 },
  input: { 
    backgroundColor: '#F1F5F9', 
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    color: '#0F172A'
  },
  loginButton: { 
    backgroundColor: '#1E40AF', 
    paddingVertical: 18, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  loginButtonText: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  registerText: { color: '#64748B', fontSize: 15 },
  registerLink: { color: '#1E40AF', fontWeight: 'bold', fontSize: 15 },
});