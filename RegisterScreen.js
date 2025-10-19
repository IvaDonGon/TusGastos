import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { CommonActions } from '@react-navigation/native';
import { supabase } from './supabaseClient';

// util: espera X ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForUsuarioRow(userId, maxTries = 10, delayMs = 300) {
  for (let i = 0; i < maxTries; i++) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.log('waitForUsuarioRow/select error:', error.message);
    if (data?.id) return true;
    await sleep(delayMs);
  }
  return false;
}

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const validate = () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos faltantes', 'Completa todos los campos.');
      return false;
    }
    const okEmail = /^\S+@\S+\.\S+$/.test(email);
    if (!okEmail) {
      Alert.alert('Email inválido', 'Ingresa un correo válido.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña débil', 'Debe tener al menos 6 caracteres.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      setLoading(true);

      // Registrar usuario (sin forzar login inmediato)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;

      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        Alert.alert('Atención', 'No se obtuvo el ID de usuario tras el registro.');
        return;
      }

      // Espera opcional por trigger/función que cree la fila en "usuarios"
      await waitForUsuarioRow(newUserId);

      // Reset total hacia Onboarding (evita que el guard de sesión te mande al Login)
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Onboarding', // Asegúrate que este nombre coincida con tu ruta
              params: {
                userId: newUserId,
                email,
                allowOnboardingWithoutSession: true, // por si tu Root respeta este flag
              },
            },
          ],
        })
      );
    } catch (e) {
      Alert.alert('Error en el registro', e?.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      {/* Email */}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Correo electrónico"
          placeholderTextColor="#777"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {/* Password con ojo adentro */}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Contraseña"
          placeholderTextColor="#777"
          secureTextEntry={!showPass}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPass((s) => !s)}
          style={styles.iconRight}
          accessibilityRole="button"
          accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color="#555" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleRegister}>
          <Text style={styles.btnText}>Registrarse</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 12 }} />
      <TouchableOpacity onPress={() => navigation.replace('LoginScreen')}>
        <Text style={{ textAlign: 'center', color: '#000', fontWeight: '600' }}>
          Ya tengo cuenta
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 22, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 18, color: '#000', textAlign: 'center' },
  inputWrapper: { position: 'relative', marginBottom: 10 },
  input: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#000',
    paddingRight: 44, // espacio para el ojito
  },
  iconRight: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  btn: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 6,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
