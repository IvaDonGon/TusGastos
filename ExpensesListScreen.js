// ExpensesListScreen.js
// Lista de gastos con:
// - Total del mes
// - Íconos por tipo
// - Edición de gasto
// - Vista previa de foto
// - Cambio / eliminación de foto (Supabase Storage)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Lucide from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker'; // 👉 para elegir nueva foto

const TABLE_TIPOS = 'tipos_gastos';

/* =========================================================
   1) Helpers de dinero y fecha (formato CLP y DD/MM/YYYY)
   ========================================================= */
const formatCLP = (n) => {
  const num = Number(n || 0);
  const s = Math.round(num).toString();
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const isoToUI = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const uiToISO = (ui) => {
  if (!ui) return '';
  const [d, m, y] = String(ui).split('/');
  return `${y}-${m}-${d}`;
};

const maskDDMMYYYY = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isValidUIDate = (v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v);

/* =========================================================
   2) Helpers fecha LOCAL (para total del mes)
   ========================================================= */
const ymdLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const normalizeToYMD = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  return ymdLocal(new Date(val));
};

/* =========================================================
   3) Helpers de íconos (Lucide) según tipo de gasto
   ========================================================= */
const toPascal = (str) =>
  (str || '')
    .replace(/[-_ ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');

const getLucide = (name) => {
  if (!name) return null;
  const direct = Lucide[name];
  if (direct) return direct;
  const pascal = toPascal(name);
  return Lucide[pascal] || null;
};

const resolveIconByNombre = (nombre) => {
  const n = (nombre || '').toLowerCase();
  if (/(super|mercado|market|abarrote|mini\s?market)/.test(n)) return Lucide.ShoppingCart;
  if (/(comida|rest|almuerzo|cena|food|aliment|caf(é|e)|restaurant|bar)/.test(n)) return Lucide.Utensils;
  if (/(transp|bus|metro|taxi|uber|cabify|peaje)/.test(n)) return Lucide.Car;
  if (/(bencin|nafta|combust|gasolin)/.test(n)) return Lucide.Fuel;
  if (/(casa|hogar|arriendo|renta|depart|dept|domicilio|mudanza)/.test(n)) return Lucide.Home;
  if (/(luz|electric|energ(í|i)a|consumo)/.test(n)) return Lucide.Lightbulb;
  if (/(agua|sanitari|potable)/.test(n)) return Lucide.Droplets;
  if (/(gas|cilindro|balón|balon)/.test(n)) return Lucide.Flame;
  if (/(salud|doctor|m(e|é)d(ic|)a|farmacia|isapre|fonasa)/.test(n)) return Lucide.HeartPulse;
  if (/(educ|coleg|escuela|uni|curso|capacit)/.test(n)) return Lucide.GraduationCap;
  if (/(entreten|cine|netflix|spotify|m(ú|u)sica|musica|tv)/.test(n)) return Lucide.Clapperboard;
  if (/(ropa|vest|zapato|polera|pantal)/.test(n)) return Lucide.Shirt;
  if (/(viaje|travel|hotel|vuelo|a(é|e)reo|avion|avión)/.test(n)) return Lucide.Plane;
  if (/(tel(é|e)fono|celu|m(ó|o)vil|internet|wifi|datos)/.test(n)) return Lucide.Smartphone;
  if (/(impuesto|tax|sii|contrib|renta)/.test(n)) return Lucide.Receipt;
  if (/(mascota|perro|gato|vet)/.test(n)) return Lucide.Dog;
  if (/(deporte|gym|gimnas)/.test(n)) return Lucide.Dumbbell;
  if (/(banco|tarjeta|cr(é|e)dito|cuota|financ)/.test(n)) return Lucide.CreditCard;
  return Lucide.Tag;
};

// 1) icon_name guardado en DB → 2) heurística por nombre → 3) ícono por defecto
const resolveIcon = (iconName, nombre) => {
  const fromDB = getLucide(iconName);
  if (fromDB) return fromDB;
  return resolveIconByNombre(nombre) || Lucide.Tag;
};

/* =========================================================
   4) Helper para subir fotos al bucket BktGastos
      - Recibe la URI local de la foto
      - Sube a Supabase Storage
      - Devuelve { publicUrl, path }
   ========================================================= */
const uploadReceiptPhoto = async (localUri, uid) => {
  try {
    let ext = (localUri.split('.').pop() || 'jpg').toLowerCase();
    if (ext.length > 4 || ext.includes('?')) {
      ext = 'jpg';
    }

    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${uid}/${fileName}`; // carpeta por usuario

    const file = {
      uri: localUri,
      name: fileName,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    };

    const { error } = await supabase.storage
      .from('BktGastos')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.log('Error subiendo foto:', error.message);
      throw error;
    }

    const { data: publicData } = supabase.storage
      .from('BktGastos')
      .getPublicUrl(filePath);

    return {
      publicUrl: publicData.publicUrl,
      path: filePath,
    };
  } catch (err) {
    console.log('Excepción en uploadReceiptPhoto:', err.message);
    throw err;
  }
};

/* =========================================================
   4.1) Helper para obtener el path real en Storage desde la URL pública
   ========================================================= */
const getStoragePathFromUrl = (fotoUrl) => {
  if (!fotoUrl) return null;

  try {
    const u = new URL(fotoUrl);
    const prefix = '/storage/v1/object/public/BktGastos/';
    const idx = u.pathname.indexOf(prefix);
    if (idx >= 0) {
      const rawPath = u.pathname.substring(idx + prefix.length);
      return decodeURIComponent(rawPath);
    }
  } catch (e) {
    // Fallback textual
  }

  const token = 'BktGastos/';
  const i2 = fotoUrl.indexOf(token);
  if (i2 >= 0) {
    const rawPath = fotoUrl.substring(i2 + token.length);
    return decodeURIComponent(rawPath);
  }

  return null;
};

export default function ExpensesListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { filterTipoGastoId = null, filterTipoGastoNombre = null } = route.params ?? {};

  /* =====================================================
     5) Estados principales
     ===================================================== */
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  // TIPOS (con ícono)
  const [tipos, setTipos] = useState([]);
  const [tiposLoading, setTiposLoading] = useState(false);

  // TOTAL MES
  const [totalMonth, setTotalMonth] = useState(0);

  // MODAL EDICIÓN
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos del modal de edición
  const [editId, setEditId] = useState(null);
  const [fechaUI, setFechaUI] = useState(isoToUI(new Date().toISOString()));
  const [tipoId, setTipoId] = useState(null);
  const [total, setTotal] = useState('');
  const [nota, setNota] = useState('');

  // Foto en edición
  const [editFotoUrlOriginal, setEditFotoUrlOriginal] = useState(null); // viene de DB
  const [editFotoUrlPreview, setEditFotoUrlPreview] = useState(null);   // lo que mostramos
  const [newLocalPhoto, setNewLocalPhoto] = useState(null);             // { uri, ... }
  const [removePhotoFlag, setRemovePhotoFlag] = useState(false);        // si el usuario decide quitar la foto

  // Zoom de la foto dentro del modal de edición (en vez de abrir otro modal)
  const [editPhotoZoomed, setEditPhotoZoomed] = useState(false);

  // Vista previa a pantalla completa (se usa SOLO desde la lista)
  const [previewUrl, setPreviewUrl] = useState(null);

  // Rango mes actual (para total del mes) + nombre de mes
  const monthRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { startYMD: ymdLocal(start), endYMD: ymdLocal(end) };
  }, []);

  const monthNameEs = useMemo(() => {
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const idx = new Date().getMonth();
    const n = meses[idx] || '';
    return n.charAt(0).toUpperCase() + n.slice(1);
  }, []);

  /* =====================================================
     6) Cargar gastos desde Supabase
     ===================================================== */
  const fetchGastos = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setItems([]);
        setTotalMonth(0);
        return;
      }

      let query = supabase
        .from('gastos')
        .select('id, fecha, id_tipo_gasto, tipo, total, nota, foto_url')
        .eq('user_id', user.id)
        .order('fecha', { ascending: false })
        .limit(500);

      if (filterTipoGastoId) {
        query = query.eq('id_tipo_gasto', String(filterTipoGastoId));
      }

      const { data, error } = await query;

      if (error) {
        console.log('Error listando gastos:', error.message);
        setItems([]);
        setTotalMonth(0);
      } else {
        const mapped = (data || []).map((g) => ({
          id: String(g.id),
          fecha: g.fecha,
          id_tipo_gasto: g.id_tipo_gasto ? String(g.id_tipo_gasto) : null,
          tipo: g.tipo ?? null,
          total: Number(g.total || 0),
          nota: g.nota ? String(g.nota).trim() : '',
          foto_url: g.foto_url || null,
        }));
        setItems(mapped);

        const { startYMD, endYMD } = monthRange;
        let sumMes = 0;
        for (const it of mapped) {
          const ymd = normalizeToYMD(it.fecha);
          if (ymd >= startYMD && ymd <= endYMD) {
            if (!filterTipoGastoId || it.id_tipo_gasto === String(filterTipoGastoId)) {
              sumMes += Number(it.total || 0);
            }
          }
        }
        setTotalMonth(sumMes);
      }
    } catch (e) {
      console.log('Excepción listando gastos:', e?.message);
      setItems([]);
      setTotalMonth(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, filterTipoGastoId, monthRange]);

  /* =====================================================
     7) Cargar tipos de gasto con ícono
     ===================================================== */
  const fetchTipos = useCallback(async () => {
    try {
      setTiposLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setTipos([]);
        return;
      }

      const { data, error } = await supabase
        .from(TABLE_TIPOS)
        .select('id, nombre, icon_name')
        .eq('user_id', user.id)
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.log('Error cargando tipos:', error.message);
        setTipos([]);
      } else {
        const mapped = (data || []).map((t) => ({
          id: String(t.id),
          nombre: String(t.nombre).trim(),
          icon_name: t.icon_name || null,
          IconCmp: resolveIcon(t.icon_name, t.nombre),
        }));
        setTipos(mapped);
      }
    } catch (e) {
      console.log('Excepción cargando tipos:', e?.message);
      setTipos([]);
    } finally {
      setTiposLoading(false);
    }
  }, []);

  /* =====================================================
     8) Efectos de carga inicial + cuando se vuelve a la pantalla
     ===================================================== */
  useEffect(() => {
    fetchGastos();
    fetchTipos();
  }, [fetchGastos, fetchTipos, filterTipoGastoId]);

  useFocusEffect(
    useCallback(() => {
      fetchGastos();
      fetchTipos();
    }, [fetchGastos, fetchTipos, filterTipoGastoId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchGastos(), fetchTipos()]);
  }, [fetchGastos, fetchTipos]);

  /* =====================================================
     9) Helpers de UI: nombre e ícono del tipo
     ===================================================== */
  const getTipoNombre = useCallback(
    (item) => {
      if (item.id_tipo_gasto) {
        const t = tipos.find((x) => x.id === item.id_tipo_gasto);
        if (t) return t.nombre;
      }
      if (item.tipo) return item.tipo;
      return 'Gasto';
    },
    [tipos]
  );

  const getTipoIcon = useCallback(
    (item) => {
      if (item.id_tipo_gasto) {
        const t = tipos.find((x) => x.id === item.id_tipo_gasto);
        if (t && t.IconCmp) return t.IconCmp;
        if (t) return resolveIcon(t.icon_name, t.nombre);
      }
      if (item.tipo) return resolveIcon(null, item.tipo);
      return Lucide.Tag;
    },
    [tipos]
  );

  /* =====================================================
     10) Abrir modal de edición y precargar datos del gasto
     ===================================================== */
  const openEdit = (item) => {
    setEditId(String(item.id));
    setFechaUI(isoToUI(item.fecha));
    setTotal(item.total?.toString() || '');
    setNota(item.nota || '');

    if (item.id_tipo_gasto) {
      setTipoId(String(item.id_tipo_gasto));
    } else if (item.tipo) {
      const byName = tipos.find(
        (t) => t.nombre.toLowerCase() === String(item.tipo).toLowerCase()
      );
      setTipoId(byName ? String(byName.id) : null);
    } else {
      setTipoId(null);
    }

    const original = item.foto_url || null;
    setEditFotoUrlOriginal(original);
    setEditFotoUrlPreview(original);
    setNewLocalPhoto(null);
    setRemovePhotoFlag(false);
    setEditPhotoZoomed(false);

    setEditVisible(true);
  };

  /* =====================================================
     11) Eliminar gasto + borrar foto del bucket (si existe)
     ===================================================== */
  const removeItem = async (id) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        Alert.alert('Eliminar', 'Sesión no encontrada.');
        return;
      }

      const gasto = items.find((x) => x.id === String(id));
      const fotoUrl = gasto?.foto_url ?? null;

      const { error: deleteError } = await supabase
        .from('gastos')
        .delete()
        .eq('id', String(id))
        .eq('user_id', user.id);

      if (deleteError) {
        console.log('Error eliminando gasto:', deleteError.message);
        Alert.alert('Eliminar', 'No se pudo eliminar el gasto.');
        return;
      }

      if (fotoUrl) {
        try {
          const path = getStoragePathFromUrl(fotoUrl);
          console.log('Intentando eliminar path de storage:', path);

          if (path) {
            const { error: storageError } = await supabase.storage
              .from('BktGastos')
              .remove([path]);

            if (storageError) {
              console.log('Error eliminando foto del bucket:', storageError.message);
            } else {
              console.log('Foto eliminada correctamente del bucket');
            }
          } else {
            console.log('No se pudo resolver el path de la foto a eliminar');
          }
        } catch (err) {
          console.log('Excepción eliminando archivo:', err.message);
        }
      }

      setItems((prev) => prev.filter((it) => it.id !== String(id)));

      setTotalMonth((prev) => {
        const removed = gasto;
        if (!removed) return prev;

        const ymd = normalizeToYMD(removed.fecha);
        if (ymd >= monthRange.startYMD && ymd <= monthRange.endYMD) {
          if (!filterTipoGastoId || removed.id_tipo_gasto === String(filterTipoGastoId)) {
            return prev - Number(removed.total || 0);
          }
        }
        return prev;
      });
    } catch (e) {
      console.log('Excepción eliminando gasto:', e.message);
      Alert.alert('Eliminar', 'Error inesperado.');
    }
  };

  const confirmRemove = (id) => {
    Alert.alert('Eliminar gasto', '¿Seguro que quieres eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeItem(id) },
    ]);
  };

  /* =====================================================
     12) Validación de campos del modal
     ===================================================== */
  const validar = () => {
    if (!isValidUIDate(fechaUI)) return 'Formato de fecha inválido (DD/MM/YYYY).';
    if (!tipoId) return 'Debes seleccionar un tipo.';
    const monto = parseFloat(String(total).replace(',', '.'));
    if (isNaN(monto) || monto <= 0) return 'El total debe ser mayor a 0.';
    return null;
  };

  /* =====================================================
     13) Seleccionar nueva foto desde la galería
     ===================================================== */
  const pickNewPhoto = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (result.didCancel) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Foto', 'No se pudo obtener la imagen seleccionada.');
        return;
      }

      setNewLocalPhoto(asset);
      setEditFotoUrlPreview(asset.uri);
      setRemovePhotoFlag(false);
      setEditPhotoZoomed(false);
    } catch (e) {
      console.log('Error seleccionando foto:', e.message);
      Alert.alert('Foto', 'No se pudo abrir la galería.');
    }
  };

  /* =====================================================
     14) Menú contextual para la foto (Ver / Cambiar / Quitar)
          En el modal de edición: "Ver foto" ahora solo agranda
          la miniatura (no abre otro Modal).
     ===================================================== */
  const handlePhotoOptions = () => {
    const hasPhoto = !!editFotoUrlPreview;

    const buttons = [];

    if (hasPhoto) {
      buttons.push({
        text: 'Ver foto',
        onPress: () => {
          // En vez de abrir un segundo Modal (que se estaba poniendo mañoso),
          // simplemente agrandamos la miniatura dentro del mismo modal.
          setEditPhotoZoomed(true);
        },
      });
    }

    buttons.push({
      text: hasPhoto ? 'Cambiar foto' : 'Agregar foto',
      onPress: () => {
        pickNewPhoto();
      },
    });

    if (hasPhoto) {
      buttons.push({
        text: 'Quitar foto',
        style: 'destructive',
        onPress: () => {
          setRemovePhotoFlag(true);
          setNewLocalPhoto(null);
          setEditFotoUrlPreview(null);
          setEditPhotoZoomed(false);
        },
      });
    }

    buttons.push({
      text: 'Cancelar',
      style: 'cancel',
    });

    Alert.alert('Foto del comprobante', '¿Qué quieres hacer?', buttons);
  };

  /* =====================================================
     15) Guardar cambios del modal de edición
     ===================================================== */
  const saveEdit = async () => {
    const msg = validar();
    if (msg) return Alert.alert('Validación', msg);

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        Alert.alert('Error', 'No hay sesión activa.');
        setSaving(false);
        return;
      }

      let fotoUrlToSave = editFotoUrlOriginal;

      // Quitar foto
      if (removePhotoFlag && editFotoUrlOriginal) {
        try {
          const path = getStoragePathFromUrl(editFotoUrlOriginal);
          console.log('Eliminar foto al editar (quitar):', path);

          if (path) {
            const { error: storageError } = await supabase.storage
              .from('BktGastos')
              .remove([path]);
            if (storageError) {
              console.log('Error eliminando foto al editar:', storageError.message);
            } else {
              console.log('Foto antigua eliminada al editar');
            }
          } else {
            console.log('No se pudo resolver path al quitar foto en edición');
          }
        } catch (err) {
          console.log('Excepción eliminando foto al editar:', err.message);
        }
        fotoUrlToSave = null;
      }

      // Nueva foto
      if (newLocalPhoto?.uri) {
        const { publicUrl } = await uploadReceiptPhoto(newLocalPhoto.uri, uid);
        fotoUrlToSave = publicUrl;

        // Borrar la foto antigua SOLO si existía y no la habíamos marcado para quitar ya antes
        if (editFotoUrlOriginal && !removePhotoFlag) {
          try {
            const path = getStoragePathFromUrl(editFotoUrlOriginal);
            console.log('Eliminar foto antigua al reemplazar:', path);

            if (path) {
              const { error: storageError } = await supabase.storage
                .from('BktGastos')
                .remove([path]);
              if (storageError) {
                console.log('Error eliminando foto antigua al reemplazar:', storageError.message);
              } else {
                console.log('Foto antigua eliminada tras subir nueva');
              }
            } else {
              console.log('No se pudo resolver path al reemplazar foto');
            }
          } catch (err) {
            console.log('Excepción eliminando foto antigua tras subir nueva:', err.message);
          }
        }
      }

      const payload = {
        user_id: uid,
        fecha: uiToISO(fechaUI),
        id_tipo_gasto: tipoId ? String(tipoId) : null,
        total: parseFloat(String(total).replace(',', '.')),
        nota: nota?.trim() || null,
        tipo: null,
        foto_url: fotoUrlToSave,
      };

      const { error } = await supabase
        .from('gastos')
        .update(payload)
        .eq('id', String(editId))
        .eq('user_id', uid);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const nuevaFechaISO = uiToISO(fechaUI);
        const totalNum = parseFloat(String(total).replace(',', '.'));

        setItems((prev) =>
          prev.map((it) =>
            it.id === String(editId)
              ? {
                  ...it,
                  fecha: nuevaFechaISO,
                  id_tipo_gasto: tipoId ? String(tipoId) : null,
                  tipo: null,
                  total: totalNum,
                  nota: nota?.trim() || '',
                  foto_url: fotoUrlToSave,
                }
              : it
          )
        );

        setTotalMonth((prev) => {
          let newSum = prev;
          const old = items.find((x) => x.id === String(editId));
          const { startYMD, endYMD } = monthRange;

          if (old) {
            const oldYMD = normalizeToYMD(old.fecha);
            const oldAplicaMes = oldYMD >= startYMD && oldYMD <= endYMD;
            const oldAplicaTipo =
              !filterTipoGastoId || old.id_tipo_gasto === String(filterTipoGastoId);
            if (oldAplicaMes && oldAplicaTipo) newSum -= Number(old.total || 0);
          }

          const newYMD = normalizeToYMD(nuevaFechaISO);
          const newAplicaMes = newYMD >= startYMD && newYMD <= endYMD;
          const newAplicaTipo =
            !filterTipoGastoId || String(tipoId) === String(filterTipoGastoId);
          if (newAplicaMes && newAplicaTipo) newSum += Number(totalNum || 0);

          return newSum;
        });

        setEditVisible(false);
      }
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     16) Render de cada fila de gasto en la lista
     ===================================================== */
  const renderItem = ({ item }) => {
    const titulo = getTipoNombre(item);
    const sub = `${isoToUI(item.fecha)}${item.nota ? ' • ' + item.nota : ''}`;
    const IconCmp = getTipoIcon(item);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => openEdit(item)}
        style={[styles.card, { backgroundColor: theme.colors.card }]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.9)' : '#000' },
          ]}
        >
          <IconCmp size={18} color={theme.isDark ? '#000' : '#fff'} strokeWidth={2.2} />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {titulo}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.text, opacity: 0.7 }]}
            numberOfLines={1}
          >
            {sub}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, { color: theme.colors.text }]}>
            {formatCLP(item.total)}
          </Text>

          <TouchableOpacity
            onPress={() => confirmRemove(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.isDark ? '#ff5c5c' : '#cc0000'}
            />
          </TouchableOpacity>

          {item.foto_url && (
            <TouchableOpacity
              style={styles.photoBadge}
              onPress={() => {
                console.log('Preview URL:', item.foto_url);
                setPreviewUrl(item.foto_url); // 👉 aquí sí usamos el modal de preview
              }}
            >
              <Ionicons
                name="image-outline"
                size={16}
                color={theme.isDark ? '#000' : '#fff'}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /* =====================================================
     17) Render principal (header, total del mes, lista, footer)
     ===================================================== */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {filterTipoGastoNombre ? `Gastos • ${filterTipoGastoNombre}` : 'Todos los gastos'}
        </Text>
      </View>

      {/* Tarjeta Total del mes */}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card }]}>
        <View
          style={[
            styles.iconCircleBig,
            { backgroundColor: theme.isDark ? '#fff' : '#000' },
          ]}
        >
          <Ionicons
            name="wallet-outline"
            size={24}
            color={theme.isDark ? '#000' : '#fff'}
          />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={[styles.bigTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {monthNameEs}
            {filterTipoGastoNombre ? ` • ${filterTipoGastoNombre}` : ''}
          </Text>
          <Text style={[styles.bigNumber, { color: theme.colors.text }]}>
            {formatCLP(totalMonth)}
          </Text>
          <Text style={[styles.bigHint, { color: theme.colors.text }]}>
            Total del mes
          </Text>
        </View>
      </View>

      {/* Chip de filtro + botón limpiar */}
      {filterTipoGastoId && (
        <View style={styles.filterRow}>
          <View
            style={[
              styles.filterChip,
              { borderColor: theme.isDark ? '#fff' : '#000' },
            ]}
          >
            <Lucide.Tag size={14} color={theme.colors.text} />
            <Text
              style={[styles.filterText, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {filterTipoGastoNombre}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              navigation.setParams({
                filterTipoGastoId: null,
                filterTipoGastoNombre: null,
              })
            }
            style={[
              styles.clearBtn,
              { borderColor: theme.isDark ? '#fff' : '#000' },
            ]}
          >
            <Text style={[styles.clearText, { color: theme.colors.text }]}>
              Quitar filtro
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista */}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.text}
            />
          }
          ListEmptyComponent={
            <Text
              style={{
                color: theme.colors.text,
                opacity: 0.7,
                marginTop: 20,
                textAlign: 'center',
              }}
            >
              {filterTipoGastoId
                ? 'No hay gastos para este tipo.'
                : 'No tienes gastos registrados.'}
            </Text>
          }
        />
      )}

      {/* botón volver */}
      <View style={styles.footerList}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={[
            styles.btnSecondary,
            { backgroundColor: theme.isDark ? '#fff' : '#000' },
          ]}
        >
          <Text
            style={[
              styles.btnText,
              { color: theme.isDark ? '#000' : '#fff' },
            ]}
          >
            Volver
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL de edición */}
      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              <Text
                style={[styles.titleModal, { color: theme.colors.text }]}
              >
                Editar gasto
              </Text>

              {/* FECHA */}
              <View style={styles.fieldBlock}>
                <Text
                  style={[styles.label, { color: theme.colors.text }]}
                >
                  Fecha
                </Text>
                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.colors.text}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="19/10/2025"
                    placeholderTextColor={theme.isDark ? '#888' : '#777'}
                    value={fechaUI}
                    onChangeText={(v) => setFechaUI(maskDDMMYYYY(v))}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={[styles.inputFlex, { color: theme.colors.text }]}
                  />
                </View>
              </View>

              {/* TIPO (chips con ícono) */}
              <View style={styles.fieldBlock}>
                <Text
                  style={[styles.label, { color: theme.colors.text }]}
                >
                  Tipo
                </Text>
                <View style={styles.pillRow}>
                  {(tipos ?? []).map((t) => {
                    const IconCmp = t.IconCmp || Lucide.Tag;
                    const active = tipoId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: theme.isDark
                              ? '#1b1b1b'
                              : '#f6f6f6',
                          },
                          active && {
                            backgroundColor: theme.isDark ? '#fff' : '#000',
                          },
                        ]}
                        onPress={() => setTipoId(String(t.id))}
                      >
                        <IconCmp
                          size={14}
                          color={
                            active
                              ? theme.isDark
                                ? '#000'
                                : '#fff'
                              : theme.colors.text
                          }
                          strokeWidth={2.2}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.pillText,
                            { color: theme.colors.text },
                            active && {
                              color: theme.isDark ? '#000' : '#fff',
                              fontWeight: '800',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {tiposLoading && (
                    <ActivityIndicator style={{ marginLeft: 6 }} />
                  )}
                  {!tiposLoading && (tipos ?? []).length === 0 && (
                    <Text
                      style={{
                        color: theme.colors.text,
                        opacity: 0.7,
                      }}
                    >
                      Aún no tienes tipos de gasto activos.
                    </Text>
                  )}
                </View>
              </View>

              {/* TOTAL */}
              <View style={styles.fieldBlock}>
                <Text
                  style={[styles.label, { color: theme.colors.text }]}
                >
                  Total
                </Text>
                <View
                  style={[
                    styles.inputBigWrapper,
                    {
                      backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6',
                    },
                  ]}
                >
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={theme.isDark ? '#888' : '#777'}
                    keyboardType="decimal-pad"
                    value={total}
                    onChangeText={setTotal}
                    style={[styles.inputBig, { color: theme.colors.text }]}
                  />
                </View>
              </View>

              {/* NOTA */}
              <View style={styles.fieldBlock}>
                <Text
                  style={[styles.label, { color: theme.colors.text }]}
                >
                  Nota (opcional)
                </Text>
                <TextInput
                  placeholder="Detalle del gasto..."
                  placeholderTextColor={theme.isDark ? '#888' : '#777'}
                  multiline
                  value={nota}
                  onChangeText={setNota}
                  style={[
                    styles.textarea,
                    {
                      backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6',
                      color: theme.colors.text,
                    },
                  ]}
                />
              </View>

              {/* FOTO DEL COMPROBANTE */}
              <View style={{ marginBottom: 140 }}>
                <Text
                  style={[styles.label, { color: theme.colors.text }]}
                >
                  Foto del comprobante (opcional)
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePhotoOptions}
                  style={[
                    styles.miniPreviewWrapper,
                    editPhotoZoomed && styles.miniPreviewWrapperBig,
                    !editFotoUrlPreview && {
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}
                >
                  {editFotoUrlPreview ? (
                    <>
                      <Image
                        source={{ uri: editFotoUrlPreview }}
                        style={styles.miniPreview}
                        resizeMode="cover"
                      />
                      <View style={styles.miniPreviewOverlayIcon}>
                        <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                      </View>
                    </>
                  ) : (
                    <Text
                      style={{
                        color: '#aaa',
                        fontSize: 13,
                      }}
                    >
                      Toca aquí para agregar una foto
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Footer de botones del modal */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={saving}
                style={[
                  styles.btnPrimary,
                  {
                    backgroundColor: theme.isDark ? '#fff' : '#000',
                    opacity: saving ? 0.7 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color={theme.isDark ? '#000' : '#fff'}
                  />
                ) : (
                  <Text
                    style={[
                      styles.btnText,
                      { color: theme.isDark ? '#000' : '#fff' },
                    ]}
                  >
                    Guardar
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btnSecondary2,
                  { backgroundColor: '#f0f0f0' },
                ]}
                onPress={() => setEditVisible(false)}
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: theme.colors.text },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL de vista previa de foto a pantalla casi completa
          👉 SOLO para el badge de la lista, no desde el modal de edición */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseArea}
            activeOpacity={1}
            onPress={() => setPreviewUrl(null)}
          />

          <View style={styles.previewContent}>
            {previewUrl && (
              <Image
                source={{ uri: previewUrl }}
                style={styles.previewImage}
                resizeMode="contain"
                onError={(e) =>
                  console.log('Error cargando imagen de recibo:', e.nativeEvent)
                }
              />
            )}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewUrl(null)}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =====================================================
   18) Estilos
   ===================================================== */
const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    alignItems: 'center',
    marginTop: 34,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },

  btnPrimary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },

  // Tarjeta resumen total del mes
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircleBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigTitle: { fontSize: 14, opacity: 0.8 },
  bigNumber: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  bigHint: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  // Filtros
  filterRow: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  filterText: { fontSize: 12, fontWeight: '700' },
  clearBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearText: { fontSize: 12, fontWeight: '700' },

  // Tarjeta de gasto
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 6 },
  deleteBtn: { marginTop: 4, paddingVertical: 2, paddingHorizontal: 6 },

  // Badge de foto en la lista
  photoBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
  },

  center: { alignItems: 'center', justifyContent: 'center' },

  // Footer (botón Volver)
  footerList: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 16,
    backgroundColor: 'transparent',
    marginBottom: 40,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  btnSecondary2: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: '700' },

  // Modal edición
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    paddingTop: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
  },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 6 },
  titleModal: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },

  fieldBlock: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputFlex: { flex: 1, fontSize: 15 },
  inputBigWrapper: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  inputBig: { fontSize: 26, fontWeight: '700', paddingVertical: 2 },

  textarea: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillText: { fontSize: 13 },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 0.3,
    borderTopColor: '#ccc',
  },

  // Mini preview de foto dentro del modal
  miniPreviewWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#111',
  },
  // Altura más grande cuando se elige "Ver foto"
  miniPreviewWrapperBig: {
    height: 260,
  },
  miniPreview: {
    width: '100%',
    height: '100%',
  },
  miniPreviewOverlayIcon: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 4,
  },

  // Modal vista previa foto grande
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseArea: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    width: '90%',
    height: '70%',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
