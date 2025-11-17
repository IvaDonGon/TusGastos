// GastoEntryScreen.js
import React, { useEffect, useMemo, useState } from 'react';
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
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker'; // 👈 cámara + galería
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import { decode } from 'base64-arraybuffer'; // 👈 para convertir base64 → bytes

/* ===============================
   Utilidades de FECHA (LOCAL)
   =============================== */
const ymdLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayYMD = () => ymdLocal(new Date());

const normalizeToYMD = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  return ymdLocal(new Date(val));
};

const ymdToUI = (ymd) => {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const uiToYMD = (ui) => {
  if (!ui) return '';
  const [d, m, y] = String(ui).split('/');
  return `${y}-${m}-${d}`;
};

const isValidUIDate = (v) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
  const [d, m, y] = v.split('/').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
};

const maskDDMMYYYY = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/* ===============================
   Helper para obtener path real en Storage
   =============================== */
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
    // fallback textual
  }

  const token = 'BktGastos/';
  const i2 = fotoUrl.indexOf(token);
  if (i2 >= 0) {
    const rawPath = fotoUrl.substring(i2 + token.length);
    return decodeURIComponent(rawPath);
  }

  return null;
};

export default function GastoEntryScreen({ navigation, route }) {
  const { theme } = useTheme();
  const gastoEditar = route?.params?.gasto ?? null;

  const [userId, setUserId] = useState(null);

  // Pref de respaldo con foto (desde Settings)
  const [receiptBackupEnabled, setReceiptBackupEnabled] = useState(false);

  // Fecha por defecto
  const [fechaUI, setFechaUI] = useState(() => {
    const ymd = gastoEditar?.fecha
      ? normalizeToYMD(gastoEditar.fecha)
      : todayYMD();
    return ymdToUI(ymd);
  });

  // Tipo gasto
  const [tipoId, setTipoId] = useState(gastoEditar?.id_tipo_gasto ?? null);
  const [tiposList, setTiposList] = useState([]); // [{ id, nombre }]

  const [total, setTotal] = useState(
    typeof gastoEditar?.total === 'number' ? String(gastoEditar.total) : ''
  );
  const [nota, setNota] = useState(gastoEditar?.nota ?? '');

  // Foto nueva + URL existente (si edito)
  const [foto, setFoto] = useState(null); // asset nuevo (camera o galería)
  const [fotoUrlExistente] = useState(gastoEditar?.foto_url ?? null); // URL ya guardada
  const [removeFotoFlag, setRemoveFotoFlag] = useState(false);        // quitar foto existente

  // Preview a pantalla completa
  const [previewUrl, setPreviewUrl] = useState(null);

  const [loading, setLoading] = useState(false); // carga de tipos
  const [saving, setSaving] = useState(false);

  const esEdicion = useMemo(() => !!gastoEditar, [gastoEditar]);

  // URL que usamos como mini-preview
  const currentFotoPreview = useMemo(() => {
    if (foto?.uri) return foto.uri;
    if (removeFotoFlag) return null;
    if (fotoUrlExistente) return fotoUrlExistente;
    return null;
  }, [foto, fotoUrlExistente, removeFotoFlag]);

  /* =========================
     1) Obtener userId + configuración
     ========================= */
  useEffect(() => {
    (async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) {
        Alert.alert('Auth', error.message);
        return;
      }
      const uid = sessionData?.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) return;

      const { data: usuarioData, error: usuarioErr } = await supabase
        .from('usuarios')
        .select('receipt_backup_enabled')
        .eq('id', uid)
        .maybeSingle();

      if (usuarioErr) {
        console.log('Error cargando receipt_backup_enabled:', usuarioErr);
        return;
      }

      if (usuarioData && typeof usuarioData.receipt_backup_enabled === 'boolean') {
        setReceiptBackupEnabled(usuarioData.receipt_backup_enabled);
      } else {
        setReceiptBackupEnabled(false);
      }
    })();
  }, []);

  /* =========================
     2) Cargar tipos
     ========================= */
  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: activos, error: errAct } = await supabase
          .from('tipos_gastos')
          .select('id, nombre')
          .eq('user_id', userId)
          .eq('activo', true)
          .order('nombre', { ascending: true });
        if (errAct) throw errAct;

        let tipos = (activos || [])
          .map((t) => ({ id: t.id, nombre: t.nombre }))
          .filter((t) => t.nombre);

        if (esEdicion && gastoEditar?.id_tipo_gasto) {
          const existe = tipos.some((t) => t.id === gastoEditar.id_tipo_gasto);
          if (!existe) {
            const { data: inactivo, error: errIn } = await supabase
              .from('tipos_gastos')
              .select('id, nombre')
              .eq('user_id', userId)
              .eq('id', gastoEditar.id_tipo_gasto)
              .maybeSingle();
            if (!errIn && inactivo) {
              tipos = [{ id: inactivo.id, nombre: inactivo.nombre }, ...tipos];
            }
          }
        }

        if (!tipoId && esEdicion && gastoEditar?.tipo) {
          const byName = tipos.find(
            (t) =>
              String(t.nombre).toLowerCase() ===
              String(gastoEditar.tipo).toLowerCase()
          );
          if (byName) setTipoId(byName.id);
        }

        if (!mounted) return;
        setTiposList(Array.isArray(tipos) ? tipos : []);
      } catch (e) {
        if (!mounted) return;
        setTiposList([]);
        Alert.alert('Tipos de gasto', e.message ?? 'No se pudieron cargar los tipos.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, esEdicion, gastoEditar?.id_tipo_gasto, gastoEditar?.tipo, tipoId]);

  /* =========================
     FOTO: tomar con cámara
     ========================= */
  const takePhoto = () => {
    if (!ImagePicker || !ImagePicker.launchCamera) {
      Alert.alert(
        'Cámara',
        'No se pudo abrir la cámara. Revisa la instalación de react-native-image-picker.'
      );
      console.log('ImagePicker es:', ImagePicker);
      return;
    }

    ImagePicker.launchCamera(
      {
        mediaType: 'photo',
        quality: 0.6,
        maxWidth: 1280,
        maxHeight: 1280,
        includeBase64: true,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Cámara', 'No se pudo tomar la foto.');
          console.log('Camera error:', response.errorMessage);
          return;
        }

        const asset = response.assets?.[0];
        if (!asset) return;

        if (asset.base64) {
          console.log('📸 [CAMERA] base64 length:', asset.base64.length);
        }

        setFoto(asset);
        setRemoveFotoFlag(false); // ya no estamos quitando, sino reemplazando
      }
    );
  };

  /* =========================
     FOTO: elegir desde galería
     ========================= */
  const pickFromGallery = () => {
    if (!ImagePicker || !ImagePicker.launchImageLibrary) {
      Alert.alert(
        'Imagen',
        'No se pudo abrir la galería. Revisa la instalación de react-native-image-picker.'
      );
      console.log('ImagePicker es:', ImagePicker);
      return;
    }

    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.6,
        maxWidth: 1280,
        maxHeight: 1280,
        includeBase64: true,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Foto', 'No se pudo seleccionar la imagen.');
          console.log('ImagePicker error:', response.errorMessage);
          return;
        }
        const asset = response.assets?.[0];
        if (!asset) return;

        if (asset.base64) {
          console.log('📸 [GALLERY] base64 length:', asset.base64.length);
        }

        setFoto(asset);
        setRemoveFotoFlag(false);
      }
    );
  };

  /* =========================
     Submenú: elegir origen (cámara o galería)
     ========================= */
  const choosePhotoSource = () => {
    Alert.alert(
      'Origen de la foto',
      '¿Cómo quieres agregar la foto?',
      [
        {
          text: 'Cámara',
          onPress: () => takePhoto(),
        },
        {
          text: 'Galería',
          onPress: () => pickFromGallery(),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  /* =========================
     Menú de opciones para la foto
     ========================= */
  const handlePhotoOptions = () => {
    const hasPhoto = !!currentFotoPreview;
    const buttons = [];

    if (hasPhoto) {
      buttons.push({
        text: 'Ver foto',
        onPress: () => setPreviewUrl(currentFotoPreview),
      });
    }

    buttons.push({
      text: hasPhoto ? 'Cambiar foto' : 'Agregar foto',
      onPress: () => {
        choosePhotoSource(); // 👈 abre submenú: Cámara / Galería
      },
    });

    if (hasPhoto) {
      buttons.push({
        text: 'Quitar foto',
        style: 'destructive',
        onPress: () => {
          setRemoveFotoFlag(true);
          setFoto(null);
        },
      });
    }

    buttons.push({
      text: 'Cancelar',
      style: 'cancel',
    });

    Alert.alert('Foto del comprobante', '¿Qué quieres hacer?', buttons);
  };

  /* =========================
     Subir / borrar foto en Supabase (según flags)
     ========================= */
  const uploadFotoIfNeeded = async (uid) => {
    // 1) Usuario marcó quitar foto y no hay nueva -> borrar antigua y dejar null
    if (removeFotoFlag && !foto) {
      if (fotoUrlExistente) {
        try {
          const path = getStoragePathFromUrl(fotoUrlExistente);
          console.log('Quitar foto existente (sin nueva). Path:', path);
          if (path) {
            const { error: delErr } = await supabase.storage
              .from('BktGastos')
              .remove([path]);
            if (delErr) {
              console.log('Error borrando foto antigua:', delErr.message);
            } else {
              console.log('Foto antigua borrada correctamente');
            }
          } else {
            console.log('No se pudo resolver path de foto existente a borrar');
          }
        } catch (err) {
          console.log('Excepción borrando foto antigua:', err.message);
        }
      }
      return null;
    }

    // 2) No se marcó quitar y no hay nueva foto -> conservar URL actual
    if (!foto) return fotoUrlExistente || null;

    // 3) Hay foto nueva -> subirla, y luego borrar la antigua si existe
    try {
      if (!foto.base64) {
        Alert.alert(
          'Foto',
          'No se pudo leer la imagen seleccionada. Intenta nuevamente.'
        );
        console.log('Foto sin base64:', foto);
        return fotoUrlExistente || null;
      }

      const ext = foto.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${uid}/${Date.now()}.${ext}`;

      console.log('⏱ Iniciando subida de foto a Supabase...');
      console.log('📸 base64 length:', foto.base64.length);

      const t0 = Date.now();

      const fileData = decode(foto.base64);

      const { data, error } = await supabase.storage
        .from('BktGastos')
        .upload(path, fileData, {
          contentType: foto.type || 'image/jpeg',
          upsert: true,
        });

      const t1 = Date.now();
      console.log(`⏱ Subida completada en ${(t1 - t0) / 1000} segundos`);

      if (error) {
        console.log('Error upload foto:', error);
        Alert.alert('Foto', `No se pudo subir la foto: ${error.message}`);
        return fotoUrlExistente || null;
      }

      const { data: publicData } = supabase.storage
        .from('BktGastos')
        .getPublicUrl(path);

      console.log('Foto subida OK. URL pública:', publicData?.publicUrl);

      const newUrl = publicData?.publicUrl || null;

      if (fotoUrlExistente) {
        try {
          const oldPath = getStoragePathFromUrl(fotoUrlExistente);
          console.log('Borrando foto antigua tras subir nueva. Path:', oldPath);
          if (oldPath) {
            const { error: delErr } = await supabase.storage
              .from('BktGastos')
              .remove([oldPath]);
            if (delErr) {
              console.log('Error borrando foto antigua:', delErr.message);
            } else {
              console.log('Foto antigua borrada correctamente (replace)');
            }
          } else {
            console.log('No se pudo resolver path de foto antigua (replace)');
          }
        } catch (err) {
          console.log('Excepción borrando foto antigua (replace):', err.message);
        }
      }

      return newUrl;
    } catch (err) {
      console.log('uploadFotoIfNeeded error:', err);
      Alert.alert('Foto', `Ocurrió un error al subir la foto: ${err.message}`);
      return fotoUrlExistente || null;
    }
  };

  /* =========================
     Validación
     ========================= */
  const validar = () => {
    if (!isValidUIDate(fechaUI)) return 'Formato de fecha inválido (DD/MM/YYYY).';
    const ymd = uiToYMD(fechaUI);
    const [y, m, d] = ymd.split('-').map(Number);
    const probe = new Date(y, m - 1, d);
    if (ymdLocal(probe) !== ymd) return 'La fecha no es válida.';
    if (!tipoId) return 'Debes seleccionar un tipo.';
    const monto = parseFloat(String(total).replace(',', '.'));
    if (isNaN(monto) || monto <= 0) return 'El total debe ser mayor a 0.';
    return null;
  };

  const irAlDashboard = () =>
    navigation.navigate('MainTabs', { screen: 'Home' });

  /* =========================
     Guardar
     ========================= */
  const guardar = async () => {
    const msg = validar();
    if (msg) {
      Alert.alert('Validación', msg);
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        Alert.alert('Error', 'No hay sesión activa.');
        setSaving(false);
        return;
      }

      const fotoUrl = receiptBackupEnabled
        ? await uploadFotoIfNeeded(uid)
        : fotoUrlExistente || null;

      const payload = {
        user_id: uid,
        fecha: uiToYMD(fechaUI),
        id_tipo_gasto: tipoId,
        total: parseFloat(String(total).replace(',', '.')),
        nota: nota?.trim() || null,
        foto_url: receiptBackupEnabled ? fotoUrl : null,
      };

      let error;
      if (esEdicion) {
        ({ error } = await supabase
          .from('gastos')
          .update(payload)
          .eq('id', gastoEditar.id)
          .eq('user_id', uid));
      } else {
        ({ error } = await supabase.from('gastos').insert(payload));
      }

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }

      Alert.alert(
        'Listo',
        esEdicion ? 'Gasto actualizado.' : 'Gasto registrado.',
        [{ text: 'OK', onPress: irAlDashboard }]
      );
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Render
     ========================= */
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {esEdicion ? 'Editar gasto' : 'Nuevo gasto'}
          </Text>

          {/* FECHA */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Fecha</Text>
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

          {/* TIPO */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Tipo</Text>
            <View style={styles.pillRow}>
              {(tiposList ?? []).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
                    tipoId === t.id && {
                      backgroundColor: theme.isDark ? '#fff' : '#000',
                    },
                  ]}
                  onPress={() => setTipoId(t.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: theme.colors.text },
                      tipoId === t.id && {
                        color: theme.isDark ? '#000' : '#fff',
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {t.nombre}
                  </Text>
                </TouchableOpacity>
              ))}

              {loading && <ActivityIndicator style={{ marginLeft: 6 }} />}
              {!loading && (tiposList ?? []).length === 0 && (
                <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
                  Aún no tienes tipos de gasto activos.
                </Text>
              )}
            </View>
          </View>

          {/* TOTAL */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Total</Text>
            <View
              style={[
                styles.inputBigWrapper,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
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

          {/* FOTO */}
          {receiptBackupEnabled && (
            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Foto del comprobante (opcional)
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePhotoOptions}
                style={[
                  styles.miniPreviewWrapper,
                  !currentFotoPreview && {
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                {currentFotoPreview ? (
                  <>
                    <Image
                      source={{ uri: currentFotoPreview }}
                      style={styles.miniPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.miniPreviewOverlayIcon}>
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color="#fff"
                      />
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

              <Text style={[styles.hintText, { color: theme.colors.text }]}>
                Puedes tomar una foto con la cámara o elegir una desde la galería.
              </Text>
            </View>
          )}

          {/* NOTA */}
          <View style={{ marginBottom: 140 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
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
        </ScrollView>

        {/* BOTONES */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={guardar}
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
              <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
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

          <TouchableOpacity style={[styles.btnSecondary]} onPress={irAlDashboard}>
            <Text style={[styles.btnText, { color: theme.colors.text }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL PREVIEW FOTO */}
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
                  console.log('Error cargando imagen de comprobante:', e.nativeEvent)
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

/* =======================
   ESTILOS
   ======================= */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { paddingHorizontal: 22, paddingTop: 16 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFlex: { flex: 1, fontSize: 16 },
  inputBigWrapper: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inputBig: { fontSize: 30, fontWeight: '800', paddingVertical: 4 },

  textarea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: 'top',
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  pillText: { fontSize: 14 },

  // Bloque foto
  miniPreviewWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#111',
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

  hintText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 0.3,
    borderTopColor: '#ccc',
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  btnText: { fontSize: 16, fontWeight: '800' },

  // Modal preview grande
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
