// RecurringConfirmScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

export default function RecurringConfirmScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]); // [{id, nombre, monto, fecha_venc, estado}]

  // Helpers
  const formatCLP = (n) => {
    const num = Number(n || 0);
    const s = Math.round(num).toString();
    return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const formatUIDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  // Rango mes actual
  const monthRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const toISO = (d) => d.toISOString().slice(0, 10);
    return { startISO: toISO(start), endISO: toISO(end) };
  }, []);

  const fetchPendientes = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setItems([]);
        return;
      }

      // 1) Traemos ocurrencias pendientes del mes
      const { data: ocurrs, error: errOcc } = await supabase
        .from('gastos_recurrentes_ocurrencias')
        .select('id, user_id, recurrente_id, fecha_venc, monto, estado')
        .eq('user_id', user.id)
        .eq('estado', 'pendiente')
        .gte('fecha_venc', monthRange.startISO)
        .lte('fecha_venc', monthRange.endISO)
        .order('fecha_venc', { ascending: true })
        .limit(200);

      if (errOcc) throw errOcc;

      if (!ocurrs || ocurrs.length === 0) {
        setItems([]);
        return;
      }

      // 2) Obtenemos nombres de recurrentes para mostrar (join manual por si no hay FK configurada)
      const recurrenteIds = [...new Set(ocurrs.map(o => o.recurrente_id).filter(Boolean))];
      let nombresById = {};
      if (recurrenteIds.length) {
        const { data: recs, error: errRecs } = await supabase
          .from('gastos_recurrentes')
          .select('id, nombre')
          .eq('user_id', user.id)
          .in('id', recurrenteIds);
        if (errRecs) throw errRecs;
        (recs || []).forEach(r => { nombresById[r.id] = r.nombre || 'Recurrente'; });
      }

      const list = ocurrs.map(o => ({
        id: String(o.id),
        nombre: nombresById[o.recurrente_id] || 'Recurrente',
        monto: Number(o.monto || 0),
        fecha_venc: o.fecha_venc,
        estado: o.estado,
      }));

      setItems(list);
    } catch (e) {
      console.log('Error listando ocurrencias pendientes:', e?.message);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthRange.startISO, monthRange.endISO, refreshing]);

  useEffect(() => {
    fetchPendientes();
  }, [fetchPendientes]);

  useFocusEffect(
    useCallback(() => {
      fetchPendientes();
    }, [fetchPendientes])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendientes();
  }, [fetchPendientes]);

  // Acciones
  const confirmarUna = async (id) => {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('gastos_recurrentes_ocurrencias')
        .update({ estado: 'confirmado', confirmado_en: nowIso })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      setItems(prev => prev.filter(x => x.id !== String(id)));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'No se pudo confirmar.');
    }
  };

  const omitirUna = async (id) => {
    try {
      const { error } = await supabase
        .from('gastos_recurrentes_ocurrencias')
        .update({ estado: 'omitido' })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      setItems(prev => prev.filter(x => x.id !== String(id)));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'No se pudo omitir.');
    }
  };

  const confirmarTodas = async () => {
    try {
      if (!items.length) return;
      const ids = items.map(i => i.id);
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('gastos_recurrentes_ocurrencias')
        .update({ estado: 'confirmado', confirmado_en: nowIso })
        .in('id', ids);

      if (error) throw error;
      setItems([]);
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'No se pudo confirmar todo.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
        <Icon name="calendar-clear-outline" size={18} color={theme.isDark ? '#000' : '#fff'} />
      </View>

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {item.nombre}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.text, opacity: 0.7 }]}>
          Vence: {formatUIDate(item.fecha_venc)}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.amount, { color: theme.colors.text }]}>{formatCLP(item.monto)}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => confirmarUna(item.id)}
            style={[styles.chipBtnFilled, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
          >
            <Text style={[styles.chipTxtFilled, { color: theme.isDark ? '#000' : '#fff' }]}>
              Confirmar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => omitirUna(item.id)}
            style={[styles.chipBtn, { borderColor: theme.isDark ? '#fff' : '#000' }]}
          >
            <Text style={[styles.chipTxt, { color: theme.colors.text }]}>Omitir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header simple */}
      <View style={styles.topHeader}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Por confirmar (mes)
        </Text>

        {items.length > 1 && (
          <TouchableOpacity
            onPress={confirmarTodas}
            style={[styles.chipBtnFilled, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
          >
            <Text style={[styles.chipTxtFilled, { color: theme.isDark ? '#000' : '#fff' }]}>
              Confirmar todo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, marginTop: 8 }}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.text}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: theme.colors.text, opacity: 0.7, marginTop: 16, textAlign: 'center' }}>
              No tienes ocurrencias pendientes este mes.
            </Text>
          }
        />
      )}

      {/* Footer con botón Volver (misma línea visual que usamos) */}
      <View style={[styles.footer, { borderTopColor: theme.isDark ? '#333' : '#ddd' }]}>
        <TouchableOpacity
          style={[
            styles.btnSecondary,
            { backgroundColor: theme.isDark ? '#1b1b1b' : '#f0f0f0' },
          ]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.btnText, { color: theme.colors.text }]}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ====== Estilos ======
const styles = StyleSheet.create({
  container: { flex: 1 },

  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tarjeta de ocurrencia
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800' },

  // Chips / botones compactos
  chipBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  chipBtnFilled: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chipTxtFilled: { fontSize: 12, fontWeight: '800' },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 50,
    padding: 16,
    
    backgroundColor: 'transparent',
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '800' },
});
