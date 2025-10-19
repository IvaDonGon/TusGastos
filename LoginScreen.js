import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SocialAuthButtons from './SocialAuthButtons';

// Valida formato de correo básico
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToHome = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        Alert.alert('Atención', 'No se pudo obtener el usuario autenticado.');
        return;
      }

      const nombreMeta = user.user_metadata?.name ?? '';
      const { error: upsertError } = await supabase
        .from('usuarios')
        .upsert({ id: user.id, nombre: nombreMeta, email: user.email }, { onConflict: 'id' });
      if (upsertError) console.log('Upsert perfil falló:', upsertError.message);

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('nombre, email')
        .eq('id', user.id)
        .single();

      navigation.replace('MainTabs', {
        userId: user.id,
        nombre: perfil?.nombre ?? nombreMeta ?? user.email,
        email: perfil?.email ?? user.email,
      });
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Error inesperado.');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validación', 'Debes ingresar correo y contraseña.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Validación', 'El correo no tiene un formato válido.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validación', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Error al iniciar sesión', error.message);
        return;
      }
      if (!data?.user) {
        Alert.alert('Atención', 'No se pudo obtener el usuario autenticado.');
        return;
      }
      await goToHome();
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Contenedor principal */}
        <View style={styles.main}>
          {/* Formulario centrado */}
          <View style={styles.centerContent}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Iniciar sesión</Text>

            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor={theme.isDark ? '#888' : '#777'}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[
                styles.input,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6', color: theme.colors.text },
              ]}
              value={email}
              onChangeText={setEmail}
            />

            <View
              style={[
                styles.passwordContainer,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
              ]}
            >
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
                secureTextEntry={!showPassword}
                style={[styles.passwordInput, { color: theme.colors.text }]}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color={theme.colors.text} style={{ marginTop: 8 }} />
            ) : (
              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
                onPress={handleLogin}
              >
                <Text
                  style={[styles.btnPrimaryText, { color: theme.isDark ? '#000' : '#fff' }]}
                >
                  Entrar
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('RegisterScreen')}
              style={{ marginTop: 16 }}
            >
              <Text style={[styles.link, { color: theme.colors.text }]}>
                ¿No tienes cuenta?{' '}
                <Text style={{ textDecorationLine: 'underline' }}>Regístrate aquí</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Botones sociales al fondo */}
          <View style={styles.footer}>
            <SocialAuthButtons isDark={theme.isDark} onLoggedIn={goToHome} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardContainer: { flex: 1 },
  main: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center', // 👈 centra verticalmente el formulario
  },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  input: {
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  passwordContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  passwordInput: { flex: 1, marginRight: 10 },
  btnPrimary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 6,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800' },
  link: { textAlign: 'center', fontWeight: '600' },
  footer: {
    marginBottom: 30, // 👈 fija los botones sociales abajo
  },
});
