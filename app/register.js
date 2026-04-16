import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/utils/supabase'; 

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    // 1. Kiểm tra dữ liệu đầu vào
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      // 2. Tạo tài khoản trên hệ thống Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      // 3. Nếu tạo Auth thành công, lưu thông tin vào bảng tb_users
      if (authData?.user) {
        const { error: dbError } = await supabase
          .from('tb_users')
          .insert([
            {
              id: authData.user.id, // Lấy ID chuẩn của hệ thống Auth
              email: email,
              full_name: fullName,
              role: 'customer', // Mặc định ai đăng ký cũng là khách hàng
            }
          ]);

        if (dbError) throw dbError;
      }

      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      // Đăng ký xong thì đẩy về trang Đăng nhập
      router.back(); 

    } catch (error) {
      Alert.alert('Đăng ký thất bại', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Tạo Tài Khoản</Text>
        <Text style={styles.subtitle}>Bắt đầu gửi hàng cùng OMS</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Họ và tên của bạn"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu (Ít nhất 6 ký tự)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Xác nhận lại Mật khẩu"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={styles.registerButton} 
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>Đăng Ký</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
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
  registerButton: {
    backgroundColor: '#28a745', // Màu xanh lá cho nút đăng ký
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#6c757d',
    fontSize: 15,
  },
  loginLink: {
    color: '#0056b3',
    fontSize: 15,
    fontWeight: 'bold',
  },
});