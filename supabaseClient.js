// supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Tus credenciales Supabase
const SUPABASE_URL = 'https://bwebmqciujvxlhqtiidu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZWJtcWNpdWp2eGxocXRpaWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjg3NDgsImV4cCI6MjA3NTk0NDc0OH0.2dXBTMks0ng5mLbZ1gcd1gcygfkXXRJyhEIdnCAwKs0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
