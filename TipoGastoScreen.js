// TipoGastoScreen.js — Iconos redondos en selección + cards con icono circular
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Lucide from 'lucide-react-native';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

Ionicons.loadFont();

export default function TipoGastoScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipos, setTipos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [iconName, setIconName] = useState('Tag');
  const [query, setQuery] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  // 10 opciones de íconos (círculos)
  const ICON_OPTIONS = [
    { name: 'ShoppingCart', label: 'Supermercado' },
    { name: 'Utensils',      label: 'Comida' },
    { name: 'Fuel',          label: 'Bencina' },
    { name: 'Wifi',          label: 'Internet' },
    { name: 'CreditCard',    label: 'Tarjeta' },
    { name: 'Wallet',        label: 'Pagos' },
    { name: 'Home',          label: 'Casa' },
    { name: 'Car',           label: 'Auto' },
    { name: 'Tv',            label: 'TV' },
    { name: 'Tag',           label: 'Otro' },
  ];

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Auth
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        Alert.alert('Auth', error.message);
        setLoading(false);
        return;
      }
      setUserId(data?.user?.id ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadTipos();
  }, [userId]);

  const loadTipos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tipos_gastos')
        .select('id, nombre, descripcion, activo, icon_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTipos(data || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTipos();
    setRefreshing(false);
  };

  // Modal crear/editar
  const openCreate = () => {
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setIconName('Tag');
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setNombre(item.nombre || '');
    setDescripcion(item.descripcion || '');
    setIconName(item.icon_name || 'Tag');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setIconName('Tag');
  };

  const handleSave = async () => {
    if (!nombre?.trim()) {
      Alert.alert('Validación', 'Ingresa un nombre para el tipo de gasto.');
      return;
    }
    try {
      setSaving(true);

      if (editId == null) {
        const payload = {
          user_id: userId,
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || null,
          icon_name: iconName || 'Tag',
          activo: true,
        };
        const { error } = await supabase.from('tipos_gastos').insert(payload);
        if (error) throw error;
        Alert.alert('Listo', 'Tipo de gasto creado.');
      } else {
        const { error } = await supabase
          .from('tipos_gastos')
          .update({
            nombre: nombre.trim(),
            descripcion: descripcion?.trim() || null,
            icon_name: iconName || 'Tag',
          })
          .eq('id', editId)
          .eq('user_id', userId);
        if (error) throw error;
        Alert.alert('Actualizado', 'Tipo de gasto actualizado.');
      }

      await loadTipos();
      closeModal();
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  // Acciones
  const toggleActivo = async (item) => {
    if (togglingId) return;
    setTogglingId(item.id);

    // Optimista
    setTipos((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, activo: !item.activo } : t))
    );

    try {
      const { error } = await supabase
        .from('tipos_gastos')
        .update({ activo: !item.activo })
        .eq('id', item.id)
        .eq('user_id', userId);

      if (error) {
        // revertir
        setTipos((prev) =>
          prev.map((t) => (t.id === item.id ? { ...t, activo: item.activo } : t))
        );
        throw error;
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo cambiar el estado.');
    } finally {
      setTogglingId(null);
    }
  };

  const deleteTipo = (item) => {
    Alert.alert(
      'Eliminar',
      `¿Eliminar el tipo de gasto "${item.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('tipos_gastos')
                .delete()
                .eq('id', item.id)
                .eq('user_id', userId);

              if (error) {
                if (error.code === '23503' || /foreign key/i.test(error.message)) {
                  Alert.alert(
                    'No se puede eliminar',
                    'Este tipo de gasto está siendo usado por uno o más gastos.\n' +
                      'Puedes desactivarlo para ocultarlo sin perder el historial.'
                  );
                  return;
                }
                throw error;
              }
              await loadTipos();
            } catch (err) {
              Alert.alert('Error', err.message || 'No se pudo eliminar.');
            }
          },
        },
      ]
    );
  };

  // Filtro
  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return tipos;
    return tipos.filter(
      (t) =>
        norm(t.nombre).includes(q) ||
        norm(t.descripcion).includes(q) ||
        norm(t.icon_name).includes(q)
    );
  }, [tipos, query]);

  // Resolver ícono Lucide por nombre
  const resolveLucideIcon = (name) => {
    if (!name || typeof name !== 'string') return Lucide.Tag;
    const raw = name.trim();
    if (Lucide[raw]) return Lucide[raw];
    const pascal = raw
      .replace(/[-_ ]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
      .replace(/^[a-z]/, (c) => c.toUpperCase());
    if (Lucide[pascal]) return Lucide[pascal];
    return Lucide.Tag;
  };

  const renderItem = ({ item }) => {
    const IconCmp = resolveLucideIcon(item.icon_name);
    return (
      <View style={[styles.card, !item.activo && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            {/* círculo con icono */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
              ]}
            >
              <IconCmp size={18} color={theme.colors.text} strokeWidth={2.2} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.nombre}
            </Text>
          </View>
          <View style={styles.stateChip}>
            <View style={[styles.dot, { opacity: item.activo ? 1 : 0.4 }]} />
            <Text style={styles.stateTxt}>{item.activo ? 'Activo' : 'Inactivo'}</Text>
          </View>
        </View>

        {!!item.descripcion && <Text style={styles.cardDesc}>{item.descripcion}</Text>}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
            <Ionicons name="pencil-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => toggleActivo(item)}
            disabled={togglingId === item.id}
          >
            <Ionicons
              name={item.activo ? 'pause-outline' : 'play-outline'}
              size={18}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnDanger]}
            onPress={() => deleteTipo(item)}
          >
            <Ionicons name="trash-outline" size={18} color={theme.isDark ? '#000' : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Loading inicial
  if (loading && !tipos.length) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.muted}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} style={{ opacity: 0.85 }} />
          <Text style={styles.backTxt}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tipos de Gasto</Text>
        <View style={styles.backBtn} pointerEvents="none">
          <Ionicons name="chevron-back" size={20} color="transparent" />
          <Text style={[styles.backTxt, { color: 'transparent' }]}>Volver</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={[styles.inputRow, { marginHorizontal: 22 }]}>
        <Ionicons name="search" size={18} color={theme.colors.text} style={{ marginRight: 8, opacity: 0.9 }} />
        <TextInput
          placeholder="Buscar por nombre, descripción o icono..."
          placeholderTextColor={theme.isDark ? '#888' : '#777'}
          value={query}
          onChangeText={setQuery}
          style={[styles.inputFlex, { color: theme.colors.text }]}
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.text} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        style={{ paddingHorizontal: 22 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.text} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={36} color={theme.colors.text} style={{ opacity: 0.7 }} />
            <Text style={styles.muted}>No tienes tipos de gasto aún. Crea el primero con “+”.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={openCreate}
        activeOpacity={0.9}
        style={[styles.fab, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
      >
        <Ionicons name="add" size={28} color={theme.isDark ? '#000' : '#fff'} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.background }]}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>
              {editId == null ? 'Nuevo tipo de gasto' : 'Editar tipo de gasto'}
            </Text>

            <Text style={styles.label}>Nombre *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.inputFlex, { color: theme.colors.text }]}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej: Supermercado, Bencina..."
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
              />
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.textarea, { color: theme.colors.text }]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Opcional"
              placeholderTextColor={theme.isDark ? '#888' : '#777'}
              multiline
            />

            <Text style={styles.label}>Selecciona un icono</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((opt) => {
                const SelectedIcon = resolveLucideIcon(opt.name);
                const selected = iconName === opt.name;
                return (
                  <TouchableOpacity
                    key={opt.name}
                    style={[
                      styles.iconCircleOption,
                      selected && {
                        borderColor: theme.isDark ? '#fff' : '#000',
                        backgroundColor: theme.isDark ? '#fff' : '#000',
                      },
                    ]}
                    onPress={() => setIconName(opt.name)}
                    activeOpacity={0.85}
                  >
                    <SelectedIcon
                      size={24}
                      color={selected ? (theme.isDark ? '#000' : '#fff') : theme.colors.text}
                      strokeWidth={2.2}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footerInline}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.isDark ? '#fff' : '#000' }]}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={[styles.modalBtnTxt, { color: theme.colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                  saving && { opacity: 0.7 },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
                ) : (
                  <Text style={[styles.modalBtnTxt, { color: theme.isDark ? '#000' : '#fff' }]}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* =======================
   Estilos
   ======================= */
function getStyles(theme) {
  const mutedBg = theme.isDark ? '#1b1b1b' : '#f6f6f6';

  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    muted: { opacity: 0.7, color: theme.colors.text, textAlign: 'center', marginTop: 8 },

    headerBar: {
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backTxt: { color: theme.colors.text, opacity: 0.85, fontSize: 14, fontWeight: '600' },
    headerTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: mutedBg,
      marginBottom: 15,
      marginTop: 15,
    },
    inputFlex: { flex: 1, fontSize: 16 },

    // Tarjetas de lista
    card: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      backgroundColor: theme.isDark ? '#151515' : '#fff',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 3 },
        },
        android: { elevation: 2 },
      }),
    },
    cardInactive: { opacity: 0.6 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    cardDesc: { color: theme.colors.text, opacity: 0.85, marginTop: 6 },

    // Chip estado
    stateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: mutedBg,
    },
    dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: theme.colors.text },
    stateTxt: { color: theme.colors.text, fontSize: 12, fontWeight: '700', opacity: 0.8 },

    actionsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    iconBtnDanger: { backgroundColor: theme.isDark ? '#fff' : '#000' },

    // Ícono circular en card
    iconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
    modalCard: { padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.isDark ? '#3a3a3a' : '#ddd',
      marginBottom: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: theme.colors.text },
    label: { marginTop: 12, marginBottom: 6, fontWeight: '700', color: theme.colors.text },
    textarea: {
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      minHeight: 90,
      textAlignVertical: 'top',
      backgroundColor: mutedBg,
    },

    // Grid de iconos (círculos)
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
      marginBottom: 12,
    },
    iconCircleOption: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },

    footerInline: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
      gap: 10,
    },
    modalBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 30,
      borderWidth: 1,
    },
    modalBtnTxt: { fontSize: 15, fontWeight: '700' },

    // FAB
    fab: {
      position: 'absolute',
      right: 22,
      bottom: 26,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 6 },
      }),
    },

    // Vacío
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 10,
    },
  });
}
