import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 1. Trạm kiểm soát: Màn hình Đăng nhập (Mặc định chạy đầu tiên) */}
      <Stack.Screen name="index" />
      
      {/* 2. Trạm kiểm soát: Màn hình Đăng ký */}
      <Stack.Screen name="register" />
      
      {/* 3. Khu vực bên trong App (Có chứa các thanh Tab) */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}