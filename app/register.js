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
import { supabase } from '../src/utils/supabase'; 

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    // 1. Kiểm tra dữ liệu đầu vào cơ bản
    if (!fullName || !phoneNumber || !email || !password || !confirmPassword) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ các trường có dấu (*)');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return;
    }

    // Kiểm tra định dạng số điện thoại (đơn giản)
    if (phoneNumber.length < 10) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ.');
      return;
    }

    setLoading(true);

    try {
      // 2. Check xem tài khoản đã được đăng ký hay chưa dựa vào email trong bảng tb_users
      const { data: existingUser, error: checkError } = await supabase
        .from('tb_users')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        Alert.alert('Thông báo', 'Email này đã được sử dụng trên hệ thống. Vui lòng sử dụng email khác.');
        setLoading(false);
        return;
      }

      // 3. Tạo tài khoản trên hệ thống Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (authError) throw authError;

      // 4. Nếu tạo Auth thành công, lưu thông tin bổ sung vào bảng tb_users
      if (authData?.user) {
        const { error: dbError } = await supabase
          .from('tb_users')
          .insert([
            {
              id: authData.user.id, // Lấy ID chuẩn của hệ thống Auth
              email: email.trim().toLowerCase(),
              full_name: fullName.trim(),
              phone_number: phoneNumber.trim(),
              role: 'customer', // Mặc định là khách hàng
            }
          ]);

        if (dbError) throw dbError;
      }

      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.', [
        { text: 'Đăng nhập', onPress: () => router.back() }
      ]);

    } catch (error) {
      console.error('Register Error:', error);
      Alert.alert('Đăng ký thất bại', error.message || 'Đã xảy ra lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Đăng Ký</Text>
          <Text style={styles.subtitle}>Điền thông tin để tạo tài khoản mới</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Họ và tên *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Số điện thoại *</Text>
          <TextInput
            style={styles.input}
            placeholder="09xx xxx xxx"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <Text style={styles.label}>Mật khẩu *</Text>
          <TextInput
            style={styles.input}
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Xác nhận mật khẩu *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.registerButton, loading && { opacity: 0.7 }]} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Tạo tài khoản</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Bạn đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#212529',
  },
  registerButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#6c757d',
    fontSize: 14,
  },
  loginLink: {
    color: '#0056b3',
    fontSize: 14,
    fontWeight: 'bold',
  },
});