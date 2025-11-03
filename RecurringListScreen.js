import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// 👉 Cambia aquí si tu columna tiene otro nombre (p. ej. 'dia_cargo')
const DIA_FIELD = 'dia_pago';

export default function RecurringListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  // 'activos' | 'todos'
  const [viewMode, setViewMode] = useState('activos');

  // === Estado para Editar ===
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [editDia, setEditDia] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);

  // Formatear CLP
  const formatCLP = (n) => {
    const num = Number(n || 0);
    const s = Math.round(num).toString();
    return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parseMonto = (s) => {
    // admite "10.000", "10000", "10000.49" (se redondea)
    const clean = String(s || '').replace(/\./g, '').replace(/,/g, '.');
    const val = Number(clean);
    return isNaN(val) ? 0 : Math.round(val);
  };

  // Helpers día
  const clampDia = (d) => {
    const n = Number(d);
    if (isNaN(n)) return 1;
    return Math.min(31, Math.max(1, Math.floor(n)));
  };

  // === Cargar recurrentes (con fallback si no existe la columna del día) ===
  const fetchRecurrentes = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (sErr) console.log('Error sesión supabase:', sErr.message);

      const user = sessionData?.session?.user;
      setCurrentUser(user || null);
      if (!user) {
        setItems([]);
        return;
      }

      // 1) intenta traer con el campo de día
      let base = supabase
        .from('gastos_recurrentes')
        .select(`id, nombre, monto, activo, ${DIA_FIELD}`)
        .eq('user_id', user.id)
        .order('nombre', { ascending: true });

      if (viewMode === 'activos') base = base.eq('activo', true);

      let { data, error } = await base;

      // 2) si falla por columna inexistente, reintenta sin ese campo
      if (error) {
        console.log('Select con día falló:', error.message);
        let fb = supabase
          .from('gastos_recurrentes')
          .select('id, nombre, monto, activo')
          .eq('user_id', user.id)
          .order('nombre', { ascending: true });
        if (viewMode === 'activos') fb = fb.eq('activo', true);
        const res2 = await fb;
        data = res2.data;
        if (res2.error) {
          console.log('Select fallback falló:', res2.error.message);
          setItems([]);
          return;
        }
      }

      setItems(
        (data || []).map((r) => ({
          id: String(r.id),
          nombre: r.nombre || 'Recurrente',
          monto: Number(r.monto || 0),
          activo: !!r.activo,
          dia: Number(r[DIA_FIELD] ?? 1),
        }))
      );
    } catch (e) {
      console.log('Excepción listando recurrentes:', e?.message);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, viewMode]);

  // Carga inicial y cuando cambia el modo de vista
  useEffect(() => {
    fetchRecurrentes();
  }, [fetchRecurrentes]);

  useFocusEffect(
    useCallback(() => {
      fetchRecurrentes();
    }, [fetchRecurrentes])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecurrentes();
  }, [fetchRecurrentes]);

  // === Abrir modal de edición ===
  const openEdit = (item) => {
    setEditId(item.id);
    setEditNombre(item.nombre);
    setEditMonto(String(item.monto));
    setEditActivo(item.activo ?? true);
    setEditDia(item.dia ?? 1);
    setEditVisible(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditVisible(false);
    setEditId(null);
    setEditNombre('');
    setEditMonto('');
    setEditActivo(true);
    setEditDia(1);
  };

  // === Guardar cambios (incluye día) ===
  const handleSave = async () => {
    try {
      if (!currentUser) {
        Alert.alert('Sesión', 'No hay usuario autenticado.');
        return;
      }
      const nombre = (editNombre || '').trim();
      const monto = parseMonto(editMonto);
      const dia = clampDia(editDia);

      if (!nombre) {
        Alert.alert('Validación', 'El nombre es obligatorio.');
        return;
      }
      if (monto <= 0) {
        Alert.alert('Validación', 'El monto debe ser mayor a cero.');
        return;
      }
      if (dia < 1 || dia > 31) {
        Alert.alert('Validación', 'El día de cobro debe estar entre 1 y 31.');
        return;
      }

      setSaving(true);

      // Payload con nombre de columna dinámico
      const payload = { nombre, monto, activo: editActivo, [DIA_FIELD]: dia };

      const { error } = await supabase
        .from('gastos_recurrentes')
        .update(payload)
        .eq('id', editId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.log('Error actualizando recurrente:', error.message);
        Alert.alert('Error', 'No se pudo guardar el cambio. Intenta nuevamente.');
      } else {
        closeEdit();
        await fetchRecurrentes();
      }
    } catch (e) {
      console.log('Excepción guardando recurrente:', e?.message);
      Alert.alert('Error', 'Ocurrió un problema al guardar.');
    } finally {
      setSaving(false);
    }
  };

  // === Eliminar ===
  const confirmDelete = (item) => {
    Alert.alert(
      'Eliminar recurrente',
      `¿Seguro que deseas eliminar “${item.nombre}”? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => handleDelete(item) },
      ]
    );
  };

  const handleDelete = async (item) => {
    try {
      if (!currentUser) {
        Alert.alert('Sesión', 'No hay usuario autenticado.');
        return;
      }
      setDeleting(true);
      const { error } = await supabase
        .from('gastos_recurrentes')
        .delete()
        .eq('id', item.id)
        .eq('user_id', currentUser.id);

      if (error) {
        console.log('Error eliminando recurrente:', error.message);
        Alert.alert('Error', 'No se pudo eliminar. Intenta nuevamente.');
      } else {
        await fetchRecurrentes();
      }
    } catch (e) {
      console.log('Excepción eliminando recurrente:', e?.message);
      Alert.alert('Error', 'Ocurrió un problema al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
        <Icon name="repeat-outline" size={18} color={theme.isDark ? '#000' : '#fff'} />
      </View>

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {item.nombre}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.text, opacity: 0.7 }]}>
          {item.activo ? 'Activo' : 'Inactivo'} · Día {item.dia}
        </Text>
      </View>

      <Text style={[styles.amount, { color: theme.colors.text, marginRight: 10 }]}>
        {formatCLP(item.monto)}
      </Text>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={[styles.iconBtn]} onPress={() => openEdit(item)} activeOpacity={0.8}>
          <Icon name="create-outline" size={20} color={theme.isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn]} onPress={() => confirmDelete(item)} activeOpacity={0.8}>
          <Icon name="trash-outline" size={20} color={theme.isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const emptyText = viewMode === 'activos'
    ? 'No tienes gastos recurrentes activos.'
    : 'No tienes gastos recurrentes registrados.';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Gastos recurrentes</Text>

        {/* Segmented control */}
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            onPress={() => setViewMode('activos')}
            activeOpacity={0.85}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: viewMode === 'activos' ? (theme.isDark ? '#fff' : '#000') : 'transparent',
                borderColor: theme.isDark ? '#555' : '#ccc',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: viewMode === 'activos' ? (theme.isDark ? '#000' : '#fff') : theme.colors.text },
              ]}
            >
              Activos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('todos')}
            activeOpacity={0.85}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: viewMode === 'todos' ? (theme.isDark ? '#fff' : '#000') : 'transparent',
                borderColor: theme.isDark ? '#555' : '#ccc',
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: viewMode === 'todos' ? (theme.isDark ? '#000' : '#fff') : theme.colors.text },
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido */}
      {loading && !refreshing ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, marginTop: 8 }}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.text} />}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.text, opacity: 0.7, marginTop: 20, textAlign: 'center' }}>
              {emptyText}
            </Text>
          }
        />
      )}

      {/* Botón volver */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={[styles.btnSecondary, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
        >
          <Text style={[styles.btnText, { color: theme.isDark ? '#000' : '#fff' }]}>Volver</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Editar */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Editar recurrente</Text>

            {/* Nombre */}
            <View style={styles.formRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Nombre</Text>
              <TextInput
                value={editNombre}
                onChangeText={setEditNombre}
                placeholder="Ej: Netflix"
                placeholderTextColor={theme.isDark ? '#888' : '#999'}
                style={[styles.input, { color: theme.colors.text, borderColor: theme.isDark ? '#444' : '#ddd' }]}
              />
            </View>

            {/* Monto */}
            <View style={styles.formRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Monto</Text>
              <TextInput
                value={editMonto}
                onChangeText={setEditMonto}
                placeholder="Ej: 9.990"
                keyboardType="numeric"
                placeholderTextColor={theme.isDark ? '#888' : '#999'}
                style={[styles.input, { color: theme.colors.text, borderColor: theme.isDark ? '#444' : '#ddd' }]}
              />
            </View>

            {/* Día de cobro: solo input */}
            <View style={styles.formRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Día de cobro (1–31)</Text>
              <TextInput
                value={String(editDia)}
                onChangeText={(t) => {
                  // Solo dígitos, tope 2 caracteres, clamp 1–31
                  const onlyDigits = (t || '').replace(/\D/g, '').slice(0, 2);
                  if (onlyDigits === '') {
                    setEditDia(1);
                  } else {
                    setEditDia(clampDia(onlyDigits));
                  }
                }}
                keyboardType="number-pad"
                placeholder="1-31"
                placeholderTextColor={theme.isDark ? '#888' : '#999'}
                style={[
                  styles.input,
                  { color: theme.colors.text, borderColor: theme.isDark ? '#444' : '#ddd', textAlign: 'center' },
                ]}
                maxLength={2}
              />
            </View>

            {/* Activo */}
            <View style={[styles.formRow, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.label, { color: theme.colors.text, marginBottom: 0 }]}>Activo</Text>
              <Switch
                value={editActivo}
                onValueChange={setEditActivo}
                thumbColor={Platform.OS === 'android' ? (editActivo ? '#fff' : '#f4f3f4') : undefined}
                trackColor={{ false: '#767577', true: theme.isDark ? '#0d6efd' : '#000' }}
              />
            </View>

            <View style={{ height: 8 }} />

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: theme.isDark ? '#fff' : '#000', flex: 1, opacity: saving ? 0.6 : 1 }]}
                activeOpacity={0.85}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
                ) : (
                  <Text style={[styles.btnText, { color: theme.isDark ? '#000' : '#fff' }]}>Guardar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSecondary, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.isDark ? '#555' : '#ccc', flex: 1 }]}
                activeOpacity={0.85}
                onPress={closeEdit}
                disabled={saving}
              >
                <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            {deleting && (
              <View style={{ marginTop: 10, alignItems: 'center' }}>
                <ActivityIndicator color={theme.colors.text} />
                <Text style={{ color: theme.colors.text, marginTop: 6 }}>Eliminando…</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },

  segmentWrap: { flexDirection: 'row', gap: 8, marginTop: 12 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  segmentText: { fontSize: 14, fontWeight: '800' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800' },

  center: { alignItems: 'center', justifyContent: 'center' },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    borderTopColor: '#ccc',
    backgroundColor: 'transparent',
  },
  btnPrimary: { paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  btnSecondary: { width: '100%', paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '800' },

  // Modal
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  formRow: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
});
