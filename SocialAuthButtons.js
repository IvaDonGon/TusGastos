// SocialAuthButtons.js
import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, Alert, StyleSheet, Platform } from 'react-native';
import { supabase } from './supabaseClient';
import appleAuth, {
  AppleAuthRequestOperation,
  AppleAuthRequestScope,
} from '@invertase/react-native-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Ionicons from 'react-native-vector-icons/Ionicons';
import sha256 from 'js-sha256'; // para hashear el nonce

// IDs reales (los tuyos)
const GOOGLE_WEB_CLIENT_ID =
  '910077944736-kh7r74fa3b3c9c84g4t6kduo78vbs8d5.apps.googleusercontent.com';
const IOS_CLIENT_ID =
  '910077944736-a61cjhjmf9cn93aso8oips5m8o14bi3a.apps.googleusercontent.com';

const randomNonce = () => Math.random().toString(36).slice(2) + Date.now();

export default function SocialAuthButtons({ onLoggedIn, isDark }) {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,      // tipo Web
      iosClientId: IOS_CLIENT_ID,             // tipo iOS
      scopes: ['openid', 'email', 'profile'], // necesario para id_token
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
  }, []);

  // ---------------- GOOGLE (NO TOCAR) ----------------
  const loginWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices?.({ showPlayServicesUpdateDialog: true });

      const userInfo = await GoogleSignin.signIn();

      // 🔍 Forzamos a limpiar cualquier dato de nonce accidental
      let { idToken } = userInfo || {};
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }

      if (!idToken) {
        Alert.alert('Google', 'No se pudo obtener el idToken de Google.');
        return;
      }

      // 👇 Evita pasar cualquier campo extra: solo provider y token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.log('Supabase error:', error);
        Alert.alert('Google', `Supabase: ${error.message}`);
        return;
      }

      console.log('Supabase session data:', data);
      onLoggedIn?.();
    } catch (e) {
      console.log('Google login error:', e);
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert('Google', e?.message || 'Error desconocido');
    }
  };

  // ---------------- APPLE (con polyfill defensivo) ----------------
  const loginWithApple = async () => {
    try {
      if (!appleAuth.isSupported) {
        Alert.alert('Apple', 'Sign in with Apple no está soportado en este dispositivo.');
        return;
      }

      // Polyfill de constantes (por si llegan undefined desde el bridge/bundle)
      const AO =
        appleAuth?.AppleAuthRequestOperation ??
        AppleAuthRequestOperation ??
        // fallback seguro: enum mínimo
        { LOGIN: 1 }; // 1 = LOGIN
      const AS =
        appleAuth?.AppleAuthRequestScope ??
        AppleAuthRequestScope ??
        { EMAIL: 0, FULL_NAME: 1 }; // 0=email, 1=full name

      // nonce: Apple recibe el SHA-256, Supabase recibe el raw
      const rawNonce = randomNonce();
      const hashedNonce = sha256(rawNonce);

      // Logs de diagnóstico (puedes quitarlos luego)
      console.log('appleAuth.isSupported:', appleAuth?.isSupported);
      console.log('AO:', AO);
      console.log('AS:', AS);

      const resp = await appleAuth.performRequest({
        requestedOperation: AO.LOGIN, // ✅ ya no se rompe si AO es polyfill
        requestedScopes: [AS.EMAIL, AS.FULL_NAME],
        nonce: hashedNonce, // anti-replay
      });

      const { identityToken } = resp || {};

      if (!identityToken) {
        Alert.alert(
          'Apple',
          'No se pudo obtener el identityToken de Apple (revisa que el dispositivo/simulador tenga Apple ID iniciado).'
        );
        return;
      }

      // Intercambio en Supabase (con el NONCE *en crudo*)
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });

      if (error) {
        Alert.alert('Apple', `Supabase: ${error.message}`);
        return;
      }

      onLoggedIn?.();
    } catch (e) {
      // Cancelación del usuario: distintos códigos/mensajes según versión/plataforma
      const msg = (e?.message || '').toLowerCase();
      if (e?.code === '1001' || msg.includes('canceled') || msg.includes('cancelled')) return;

      console.log('Apple login error:', e);
      Alert.alert('Apple', e?.message || 'Error desconocido');
    }
  };

  return (
    <View style={styles.wrapper}>
      <View className="separatorRow" style={styles.separatorRow}>
        <View style={[styles.sepLine, { backgroundColor: isDark ? '#2b2b2b' : '#e5e5e5' }]} />
        <Text style={[styles.sepText, { color: isDark ? '#aaa' : '#666' }]}>o continúa con</Text>
        <View style={[styles.sepLine, { backgroundColor: isDark ? '#2b2b2b' : '#e5e5e5' }]} />
      </View>

      {Platform.OS === 'ios' && (
        <TouchableOpacity style={[styles.btn, styles.apple]} onPress={loginWithApple}>
          <View style={styles.btnContent}>
            <Ionicons name="logo-apple" size={22} color="#fff" style={styles.icon} />
            <Text style={styles.btnText}>Continuar con Apple</Text>
          </View>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.btn, styles.google]} onPress={loginWithGoogle}>
        <View style={styles.btnContent}>
          <Ionicons name="logo-google" size={22} color="#fff" style={styles.icon} />
          <Text style={styles.btnText}>Continuar con Google</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginTop: 14 },
  separatorRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  sepLine: { height: 1, flex: 1, borderRadius: 1 },
  sepText: { fontSize: 12, fontWeight: '600' },

  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  apple: { backgroundColor: '#000' },
  google: { backgroundColor: '#4285F4' },

  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
