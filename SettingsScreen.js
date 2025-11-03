import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

Ionicons.loadFont();

function NavItem({ icon, title, subtitle, onPress, theme }) {
  return (
    <TouchableOpacity style={[styles.navItem, { backgroundColor: theme.colors.card }]} onPress={onPress}>
      <View style={[styles.navIconBox, { backgroundColor: theme.isDark ? '#ffffff14' : '#00000012' }]}>
        <Ionicons name={icon} size={20} color={theme.isDark ? '#fff' : '#000'} />
      </View>
      <View style={styles.navTextBox}>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.navSubtitle, { color: theme.colors.text }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.isDark ? '#fff' : '#000'} />
    </TouchableOpacity>
  );
}

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

          {/* Tarjeta: Envío de notificaciones */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.cardIconBox, { backgroundColor: theme.isDark ? '#ffffff14' : '#00000012' }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.isDark ? '#fff' : '#000'} />
            </View>
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

          {/* Tarjeta: Modo oscuro */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.cardIconBox, { backgroundColor: theme.isDark ? '#ffffff14' : '#00000012' }]}>
              <Ionicons name="moon-outline" size={20} color={theme.isDark ? '#fff' : '#000'} />
            </View>
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

          {/* Nueva sección: Mantenedores */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 18 }]}>
            Mantenedores
          </Text>

          <View style={styles.navGroup}>
            <NavItem
              icon="pricetags-outline"
              title="Tipos de gasto"
              subtitle="Administra tus categorías personalizadas"
              onPress={() => navigation.navigate('TipoGasto')} // nombre de la ruta en App.js
              theme={theme}
            />
            {/* Más mantenedores a futuro...
            <NavItem
              icon="business-outline"
              title="Cuentas / Bancos"
              subtitle="Gestiona tus medios de pago"
              onPress={() => navigation.navigate('Bancos')}
              theme={theme}
            />
            */}
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
    marginTop: 60,
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
    alignItems: 'center',
    gap: 12,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, opacity: 0.6 },

  // Navegación tipo lista
  navGroup: {
    borderRadius: 12,
    overflow: 'hidden',

  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
    
    borderBottomColor: '#eaeaea',
  },
  navIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextBox: { flex: 1 },
  navTitle: { fontSize: 16, fontWeight: '600' },
  navSubtitle: { fontSize: 12, opacity: 0.6 },

  item: { fontSize: 16, marginBottom: 8 },
});
