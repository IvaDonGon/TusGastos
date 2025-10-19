import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { theme, toggleTheme } = useTheme();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState(false);

  // Cargar perfil de usuario
  const cargarPerfil = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      console.log(user)
      if (!user) return setPerfil(null);

      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, email')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setPerfil(data);
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, []);

  // Cerrar sesión
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    navigation.replace('LoginScreen');
  };

  // Iniciales
  const getIniciales = (nombre = '') => {
    const partes = nombre.trim().split(' ');
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (
      partes[0].charAt(0).toUpperCase() +
      partes[partes.length - 1].charAt(0).toUpperCase()
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : perfil ? (
        <>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
              <Text style={[styles.avatarText, { color: theme.isDark ? '#000' : '#fff' }]}>
                {getIniciales(perfil.nombre)}
              </Text>
            </View>
            <Text style={[styles.name, { color: theme.colors.text }]}>{perfil.nombre}</Text>
            <Text style={[styles.email, { color: theme.colors.text }]}>{perfil.email}</Text>

             {/* Botón para ir a la pantalla de edición */}
            <View style={{ marginTop: 12 }}>
              <Button
                title="Editar perfil"
                color={theme.isDark ? '#fff' : '#000'}
                onPress={() => navigation.navigate('EditProfileScreen')}
              />
            </View>
          </View>

          {/* Preferencias */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferencias</Text>

          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Envío de notificaciones
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                Recibe alertas importantes y recordatorios
              </Text>
            </View>
            <Switch
              value={notificaciones}
              onValueChange={setNotificaciones}
              trackColor={{ false: '#aaa', true: '#000' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Modo oscuro
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                Cambia el tema de toda la aplicación
              </Text>
            </View>
            <Switch
              value={theme.isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#aaa', true: '#000' }}
              thumbColor="#fff"
            />
          </View>
        </>
      ) : (
        <Text style={[styles.item, { color: theme.colors.text }]}>
          No hay sesión activa.
        </Text>
      )}

      <View style={{ marginTop: 30 }}>
        <Button
          title="Cerrar sesión"
          color={theme.isDark ? '#fff' : '#000'}
          onPress={handleLogout}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40 },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 60, // 👈 más espacio superior para bajar el avatar
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '600' },
  email: { fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, opacity: 0.6 },
  item: { fontSize: 16, marginBottom: 8 },
   btn: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 6,
  },
});
