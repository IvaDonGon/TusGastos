import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';

export default function WelcomeScreen({ navigation }) {
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (user) {
          navigation.replace('MainTabs', { email: user.email });
          return;
        }
      } finally {
        setChecking(false);
      }
    };
    checkSession();
  }, [navigation]);

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Contenido superior */}
      <View style={styles.centerContent}>
        <View
          style={[
            styles.logo,
            { backgroundColor: theme.isDark ? '#fff' : '#000' },
          ]}
        >
          <Text
            style={[
              styles.logoText,
              { color: theme.isDark ? '#000' : '#fff' },
            ]}
          >
            APP
          </Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>¡Bienvenido!</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
        
        </Text>
      </View>

      {/* Botones fijos abajo */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            styles.btnPrimary,
            { backgroundColor: theme.isDark ? '#fff' : '#000' },
          ]}
          onPress={() => navigation.navigate('LoginScreen')}
        >
          <Text
            style={[
              styles.btnPrimaryText,
              { color: theme.isDark ? '#000' : '#fff' },
            ]}
          >
            Iniciar sesión
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btnGhost,
            { borderColor: theme.colors.text },
          ]}
          onPress={() => navigation.navigate('RegisterScreen')}
        >
          <Text style={[styles.btnGhostText, { color: theme.colors.text }]}>
            Crear cuenta
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginTop: Platform.OS === 'ios' ? 60 : 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, opacity: 0.8, textAlign: 'center', paddingHorizontal: 10 },
  footer: {
    width: '100%',
  },
  btnPrimary: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800' },
  btnGhost: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
   
  },
  btnGhostText: { fontSize: 16, fontWeight: '700' },
});
