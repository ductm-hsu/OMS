import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avyksozmziecohetwtff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eWtzb3ptemllY29oZXR3dGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTgxNjcsImV4cCI6MjA5MTgzNDE2N30.CN1n4yqvtCEzKh2TDAmMAfvJRIMVMEkUrHcdHWgOqg4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Lắng nghe trạng thái App (Bật/Tắt) để làm mới token bảo mật tự động
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});