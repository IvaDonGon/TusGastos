import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

export default function DashboardScreen({ route, navigation }) {
  const { theme } = useTheme();
  const params = route?.params ?? {};
  const [perfil, setPerfil] = useState({ nombre: params?.nombre, email: params?.email });
  const [loading, setLoading] = useState(false);

  // Datos de prueba para "Montos recientes"
  const [montosRecientes, setMontosRecientes] = useState([
    { id: '1', producto: 'Fertilizante A', sub: 'Lote 12 • 15/10', monto: 1254000 },
    { id: '2', producto: 'Herbicida B', sub: 'Lote 8 • 12/10', monto: 534000 },
    { id: '3', producto: 'Fungicida C', sub: 'Lote 5 • 10/10', monto: 298500 },
  ]);

  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from('usuarios')
          .select('nombre, email')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setPerfil({ nombre: data.nombre, email: data.email });
        }
      } catch (e) {
        console.log('Error al cargar perfil:', e?.message);
      } finally {
        setLoading(false);
      }
    };

    if (!params?.nombre || !params?.email) {
      fetchPerfil();
    }
  }, [params?.nombre, params?.email]);

  const getIniciales = (nombre = '') => {
    const partes = (nombre || '').trim().split(' ').filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return partes[0].charAt(0).toUpperCase();
  };

  const getPrimerNombre = (nombre = '') => {
    const partes = (nombre || '').trim().split(' ').filter(Boolean);
    return partes.length > 0 ? partes[0] : 'Usuario';
  };

  const nombre = perfil?.nombre || 'Usuario';
  const primerNombre = getPrimerNombre(nombre);

  // Formatear CLP simple (con separador de miles)
  const formatCLP = (n) => {
    try {
      // Si tienes Intl disponible en tu runtime, puedes usar:
      // return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
      const s = Math.round(n).toString();
      return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    } catch {
      const s = Math.round(n).toString();
      return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  };

  const onVerDetalle = (item) => {
    Alert.alert('Detalle', `${item.producto}\n${item.sub}\nMonto: ${formatCLP(item.monto)}`);
    // Si quieres navegar:
    // navigation.navigate('DetalleMontoScreen', { item });
  };

  const renderMontoItem = ({ item }) => (
    <View style={[styles.listItem, { backgroundColor: theme.colors.card }]}>
      {/* Avatar / icono izquierda */}
      <View
        style={[
          styles.itemAvatar,
          { backgroundColor: theme.isDark ? '#fff' : '#000' },
        ]}
      >
        <Icon name="cube-outline" size={18} color={theme.isDark ? '#000' : '#fff'} />
      </View>

      {/* Texto centro */}
      <View style={styles.itemTextWrap}>
        <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {item.producto}
        </Text>
        <Text style={[styles.itemSub, { color: theme.colors.text }]} numberOfLines={1}>
          {item.sub}
        </Text>
      </View>

      {/* Monto + acción */}
      <View style={styles.itemRight}>
        <Text style={[styles.itemAmount, { color: theme.colors.text }]}>
          {formatCLP(item.monto)}
        </Text>
        <TouchableOpacity onPress={() => onVerDetalle(item)} style={styles.detailBtn}>
          <Text style={styles.detailText}>Ver detalle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <>
          {/* --- Header con avatar y saludo --- */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.hello, { color: theme.colors.text }]}>Hola,</Text>
              <Text style={[styles.userName, { color: theme.colors.text }]}>
                {primerNombre}
              </Text>
            </View>

            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.isDark ? '#fff' : '#000' },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: theme.isDark ? '#000' : '#fff' },
                ]}
              >
                {getIniciales(nombre)}
              </Text>
            </View>
          </View>

          {/* --- Tarjetas pequeñas lado a lado --- */}
          <View style={styles.row}>
            {/* Card 1 - Progreso */}
            <View style={[styles.smallCard, { backgroundColor: theme.colors.card }]}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Icon name="trending-up" size={20} color={theme.isDark ? '#000' : '#fff'} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Progreso</Text>
                <Text style={[styles.cardValue, { color: theme.colors.text }]}>72%</Text>
              </View>
            </View>

            {/* Card 2 - Productividad */}
            <View style={[styles.smallCard, { backgroundColor: theme.colors.card }]}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Icon name="settings-outline" size={20} color={theme.isDark ? '#000' : '#fff'} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Productividad</Text>
                <Text style={[styles.cardValue, { color: theme.colors.text }]}>88%</Text>
              </View>
            </View>
          </View>

          {/* --- Tarjeta grande (Balance total) --- */}
          <View style={[styles.bigCard, { backgroundColor: theme.colors.card }]}>
            <View
              style={[
                styles.iconCircleBig,
                { backgroundColor: theme.isDark ? '#fff' : '#000' },
              ]}
            >
              <Icon name="wallet-outline" size={26} color={theme.isDark ? '#000' : '#fff'} />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={[styles.bigCardTitle, { color: theme.colors.text }]}>Balance total</Text>
              <Text style={[styles.bigCardNumber, { color: theme.colors.text }]}>
                {formatCLP(12540000)}
              </Text>
            </View>
          </View>

          {/* --- Montos recientes --- */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Montos recientes</Text>
          </View>

          <FlatList
            data={montosRecientes}
            keyExtractor={(item) => item.id}
            renderItem={renderMontoItem}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 50 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40,marginTop: 40
  },
  hello: { fontSize: 20, opacity: 0.8 },
  userName: { fontSize: 26, fontWeight: 'bold' },
  avatar: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold' },

  // Cards pequeñas
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  smallCard: {
    flex: 0.48, padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 14, opacity: 0.7 },
  cardValue: { fontSize: 20, fontWeight: 'bold' },

  // Card grande
  bigCard: {
    marginTop: 24, padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 3 }, shadowRadius: 5, elevation: 3,
  },
  iconCircleBig: {
    width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center',
  },
  bigCardTitle: { fontSize: 16, opacity: 0.8 },
  bigCardNumber: { fontSize: 30, fontWeight: 'bold', marginTop: 4 },

  // Montos recientes
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  listItem: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 1,
  },
  itemAvatar: {
    width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center',
  },
  itemTextWrap: { flex: 1, marginLeft: 10 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '700' },
  detailBtn: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 6 },
  detailText: { fontSize: 12, textDecorationLine: 'underline', color: '#000' },
});
