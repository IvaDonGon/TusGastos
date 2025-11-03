// DashboardScreen.js (completo: íconos en carrusel, gastos recientes y gráfico semanal con tooltip fijo desde Supabase)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,Dimensions,
} from 'react-native';
import Ion from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import * as Lucide from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';

const MAX_VISIBLE = 3;

/* =========================
   Helpers de íconos Lucide
   ========================= */
const toPascal = (str) =>
  (str || '')
    .replace(/[-_ ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');

const getLucide = (name) => {
  if (!name) return null;
  const direct = Lucide[name];
  if (direct) return direct;
  const pascal = toPascal(name);
  return Lucide[pascal] || null;
};

// Mapeo por palabras clave del nombre del tipo
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

  return Lucide.Tag; // fallback
};

// Resolver final: 1) icon_name (si existe y válido), 2) por nombre, 3) Tag
const resolveIcon = (iconName, nombre) => {
  const fromDB = getLucide(iconName);
  if (fromDB) return fromDB;
  return resolveIconByNombre(nombre) || Lucide.Tag;
};

export default function DashboardScreen({ route, navigation }) {
  const { theme } = useTheme();
  const params = route?.params ?? {};
  const [perfil, setPerfil] = useState({ nombre: params?.nombre, email: params?.email });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showAllRecent, setShowAllRecent] = useState(false);

  // Totales y colecciones
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [prevMonthlyTotal, setPrevMonthlyTotal] = useState(0);
  const [montosRecientes, setMontosRecientes] = useState([]);
  const [recurrentes, setRecurrentes] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  // 🆕 Total gastado hoy
  const [dailyTotal, setDailyTotal] = useState(0); // 🆕

  // Tipos para UI + diccionario por id para resolver icono en recientes
  const [tiposGastoUI, setTiposGastoUI] = useState([]);
  const [tiposDict, setTiposDict] = useState({}); // { [id]: { nombre, icon_name, IconCmp } }

  // Gráfico semanal (desde Supabase)
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedBarIndex, setSelectedBarIndex] = useState(-1);
  const screenWidth = Dimensions.get('window').width;
  const containerHPad = 20;   // padding horizontal del container
  const cardHPad = 16;        // padding horizontal del sparkCard
  const chartWidth = Math.max(0, screenWidth - 2*containerHPad - 2*cardHPad);

  const nBars = weeklyData?.length ?? 0;
  const bw = 28; // barWidth
  const sp = nBars > 1 ? Math.max(6, (chartWidth - (nBars * bw)) / (nBars - 1)) : 0; // spacing mínimo 6

  // Helpers de nombre
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

  // Formatos
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

  // Rango mes anterior
  const prevMonthRange = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const prevStart = new Date(y, m - 1, 1);
    const prevEnd = new Date(y, m, 0);
    const toISO = (x) => x.toISOString().slice(0, 10);
    return { startISO: toISO(prevStart), endISO: toISO(prevEnd) };
  }, []);

  // Nombre del mes
  const monthNameEs = useMemo(() => {
    const meses = [
      'enero','febrero','marzo','abril','mayo','junio',
      'julio','agosto','septiembre','octubre','noviembre','diciembre'
    ];
    const idx = new Date().getMonth();
    const name = meses[idx] || '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  // Variaciones
  const { deltaPctAbs, isUp } = useMemo(() => {
    const curr = Number(monthlyTotal || 0);
    const prev = Number(prevMonthlyTotal || 0);
    if (prev <= 0 && curr <= 0) return { deltaPctAbs: 0, isUp: false };
    if (prev <= 0 && curr > 0)  return { deltaPctAbs: 100, isUp: true };
    const delta = ((curr - prev) / prev) * 100;
    return { deltaPctAbs: Math.abs(delta), isUp: delta > 0 };
  }, [monthlyTotal, prevMonthlyTotal]);

  const deltaAmount = useMemo(() => {
    return Number(monthlyTotal || 0) - Number(prevMonthlyTotal || 0);
  }, [monthlyTotal, prevMonthlyTotal]);

  // Perfil (si no vino por params)
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

        if (!error && data) setPerfil({ nombre: data.nombre, email: data.email });
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

    // 🆕 Promedio diario del mes actual
const dailyAvgThisMonth = useMemo(() => {
  const now = new Date();
  const day = now.getDate();
  if (day <= 0) return 0;
  return Number(monthlyTotal || 0) / day;
}, [monthlyTotal]);


  // Carga datos del dashboard (totales, recientes, recurrentes, pendientes)
  const fetchMonthlyTotalAndRecent = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setMonthlyTotal(0);
        setPrevMonthlyTotal(0);
        setMontosRecientes([]);
        setRecurrentes([]);
        setPendingCount(0);
        setTiposGastoUI([]);
        setTiposDict({});
        setDailyTotal(0); // 🆕
        return;
      }

      // 1) Tipos (trae icon_name)
      const { data: tiposData, error: errTipos } = await supabase
        .from('tipos_gastos')
        .select('id, nombre, icon_name')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true });

      const tiposDictTmp = {};
      const tiposUI = [];
      if (!errTipos && Array.isArray(tiposData)) {
        tiposData.forEach((t) => {
          const IconCmp = resolveIcon(t.icon_name, t.nombre);
          const id = String(t.id);
          tiposDictTmp[id] = {
            nombre: t.nombre || 'Tipo',
            icon_name: t.icon_name || null,
            IconCmp,
          };
          tiposUI.push({ id, nombre: t.nombre || 'Tipo', IconCmp });
        });
      }
      setTiposDict(tiposDictTmp);
      setTiposGastoUI(tiposUI);

      // 2) Mes actual
      const { data, error } = await supabase
        .from('gastos')
        .select('id, fecha, tipo, id_tipo_gasto, total, nota')
        .eq('user_id', user.id)
        .gte('fecha', monthRange.startISO)
        .lte('fecha', monthRange.endISO)
        .order('fecha', { ascending: false })
        .limit(50);

      if (error) {
        console.log('Error leyendo gastos actuales:', error.message);
        setMonthlyTotal(0);
        setMontosRecientes([]);
        setDailyTotal(0); // 🆕
      } else {
        const sum = (data || []).reduce((acc, it) => acc + Number(it.total || 0), 0);
        setMonthlyTotal(sum);

        // 🆕 Calcular total de HOY a partir del mismo dataset mensual
        const todayISO = new Date().toISOString().slice(0, 10);
        const todayTotal = (data || [])
          .filter(g => String(g.fecha).slice(0,10) === todayISO)
          .reduce((acc, it) => acc + Number(it.total || 0), 0);
        setDailyTotal(todayTotal); // 🆕

        const recientes = (data || []).map((g) => {
          let nombreTipo = 'Gasto';
          let IconCmp = Lucide.Tag;

          const idStr = g.id_tipo_gasto != null ? String(g.id_tipo_gasto) : null;
          if (idStr && tiposDictTmp[idStr]) {
            nombreTipo = tiposDictTmp[idStr].nombre;
            IconCmp = tiposDictTmp[idStr].IconCmp || Lucide.Tag;
          } else if (g.tipo) {
            nombreTipo = g.tipo;
            IconCmp = resolveIcon(null, nombreTipo) || Lucide.Tag;
          }

          return {
            id: String(g.id),
            producto: nombreTipo,
            sub: `${formatUIDate(g.fecha)}${g.nota ? ' • ' + String(g.nota).trim() : ''}`,
            monto: Number(g.total || 0),
            IconCmp,
          };
        });

        setMontosRecientes(recientes);
      }

    
      // 3) Mes anterior
      const { data: dataPrev, error: errPrev } = await supabase
        .from('gastos')
        .select('total, fecha')
        .eq('user_id', user.id)
        .gte('fecha', prevMonthRange.startISO)
        .lte('fecha', prevMonthRange.endISO);

      if (errPrev) {
        console.log('Error leyendo gastos previos:', errPrev.message);
        setPrevMonthlyTotal(0);
      } else {
        const sumPrev = (dataPrev || []).reduce((acc, it) => acc + Number(it.total || 0), 0);
        setPrevMonthlyTotal(sumPrev);
      }

      // 4) Recurrentes
      const { data: dataRec, error: errRec } = await supabase
        .from('gastos_recurrentes')
        .select('id, nombre, monto, activo')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true })
        .limit(200);

      if (errRec) {
        console.log('Error leyendo recurrentes:', errRec.message);
        setRecurrentes([]);
      } else {
        setRecurrentes(
          (dataRec || []).map((r) => ({
            id: String(r.id),
            nombre: r.nombre || 'Recurrente',
            monto: Number(r.monto || 0),
            activo: Boolean(r.activo),
          }))
        );
      }

      // 5) Pendientes por confirmar (mes actual)
      const { count: pendCount, error: errPend } = await supabase
        .from('gastos_recurrentes_ocurrencias')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('fecha_venc', monthRange.startISO)
        .lte('fecha_venc', monthRange.endISO)
        .eq('estado', 'pendiente');

      if (errPend) {
        console.log('Error contando pendientes:', errPend.message);
        setPendingCount(0);
      } else {
        setPendingCount(pendCount || 0);
      }
    } catch (e) {
      console.log('Excepción leyendo datos del dashboard:', e?.message);
      setMonthlyTotal(0);
      setPrevMonthlyTotal(0);
      setMontosRecientes([]);
      setRecurrentes([]);
      setPendingCount(0);
      setTiposGastoUI([]);
      setTiposDict({});
      setDailyTotal(0); // 🆕
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthRange, prevMonthRange, refreshing]);

  // Gráfico semanal desde Supabase
  const fetchWeeklyData = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setWeeklyData([]);
        return;
      }

      // Rango: últimos 7 días (incluye hoy)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6);

      const toISO = (d) => d.toISOString().slice(0, 10);

      // Consulta
      const { data, error } = await supabase
        .from('gastos')
        .select('fecha, total')
        .eq('user_id', user.id)
        .gte('fecha', toISO(startDate))
        .lte('fecha', toISO(endDate));

      if (error) throw error;

      // Sumar por día (YYYY-MM-DD)
      const totalsByDay = {};
      (data || []).forEach((g) => {
        const day = String(g.fecha).slice(0, 10);
        totalsByDay[day] = (totalsByDay[day] || 0) + Number(g.total || 0);
      });

      // Armar array ordenado por los 7 días cronológicos (de startDate a endDate)
      const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const result = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const key = d.toISOString().slice(0, 10);

        // getDay(): 0=Dom ... 6=Sab → convertir a 0=Lun ... 6=Dom
        const dow = d.getDay(); // 0..6
        const idxDia = dow === 0 ? 6 : dow - 1;
        const label = diasSemana[idxDia];

        result.push({
          idx: i,
          label,
          value: totalsByDay[key] || 0,
        });
      }

      // Adjuntamos onPress por barra para controlar tooltip
      const withPress = result.map((it) => ({
        ...it,
        onPress: () => setSelectedBarIndex((prev) => (prev === it.idx ? -1 : it.idx)),
      }));

      setWeeklyData(withPress);
      setSelectedBarIndex(-1);
    } catch (e) {
      console.log('Error cargando datos semanales:', e.message);
      setWeeklyData([]);
      setSelectedBarIndex(-1);
    }
  }, []);

  // Carga inicial + cuando vuelves al foco
  useEffect(() => {
    fetchMonthlyTotalAndRecent();
    fetchWeeklyData();
  }, [fetchMonthlyTotalAndRecent, fetchWeeklyData]);

  useFocusEffect(
    useCallback(() => {
      fetchMonthlyTotalAndRecent();
      fetchWeeklyData();
    }, [fetchMonthlyTotalAndRecent, fetchWeeklyData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMonthlyTotalAndRecent();
    fetchWeeklyData();
  }, [fetchMonthlyTotalAndRecent, fetchWeeklyData]);

  const onVerDetalle = (item) => {
    Alert.alert('Detalle', `${item.producto}\n${item.sub}\nMonto: ${formatCLP(item.monto)}`);
  };

  const recentToShow = useMemo(
    () => (showAllRecent ? montosRecientes : montosRecientes.slice(0, MAX_VISIBLE)),
    [showAllRecent, montosRecientes]
  );

  const activosRecurrentes = recurrentes.filter(r => r.activo).length;

  /* ===========================
     Ítems: Gastos recientes
     =========================== */
  const renderMontoItem = ({ item }) => {
    const IconCmp = item.IconCmp || Lucide.Tag;
    return (
      <View style={[styles.listItem, { backgroundColor: theme.colors.card }]}>
        <View
          style={[
            styles.itemAvatar,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <IconCmp size={18} color={theme.colors.text} strokeWidth={2.2} />
        </View>

        <View style={styles.itemTextWrap}>
          <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {item.producto}
          </Text>
          <Text style={[styles.itemSub, { color: theme.colors.text }]} numberOfLines={1}>
            {item.sub}
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Text style={[styles.itemAmount, { color: theme.colors.text }]}>{formatCLP(item.monto)}</Text>
          <TouchableOpacity onPress={() => onVerDetalle(item)} style={styles.detailBtn} />
        </View>
      </View>
    );
  };

  /* =====================================
     Carrusel Tipos: ícono redondo + nombre
     ===================================== */
  const renderTipoCard = ({ item }) => {
    const IconCmp = item.IconCmp || Lucide.Tag;
    const goToFiltered = () => {
      navigation.navigate('ExpensesList', {
        filterTipoGastoId: item.id,
        filterTipoGastoNombre: item.nombre,
      });
    };

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={goToFiltered} style={styles.tipoCardWrap}>
        <View
          style={[
            styles.tipoIconBtn,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <IconCmp size={26} color={theme.colors.text} strokeWidth={2.2} />
        </View>
        <Text style={[styles.tipoLabel, { color: theme.colors.text }]} numberOfLines={1}>
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  };

  // ------ Cálculo dinámico para maxValue (aire superior del tooltip) ------
  const dynamicMaxValue = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) return 1000;
    const maxY = Math.max(...weeklyData.map(d => d.value || 0));
    if (maxY <= 0) return 1000;
    return Math.ceil((maxY * 1.25) / 1000) * 1000;
  }, [weeklyData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading && !refreshing ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.text}
            />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.hello, { color: theme.colors.text }]}>Hola,</Text>
              <Text style={[styles.userName, { color: theme.colors.text }]}>{primerNombre}</Text>
            </View>
            <View style={[styles.avatar, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
              <Text style={[styles.avatarText, { color: theme.isDark ? '#000' : '#fff' }]}>
                {getIniciales(nombre)}
              </Text>
            </View>
          </View>

          {/* Cards pequeñas */}
          <View style={styles.row}>
          {/* Promedio diario */}
  <View style={[styles.smallCard, { backgroundColor: theme.colors.card }]}>
    <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
      <Ion name="bar-chart-outline" size={20} color={theme.isDark ? '#000' : '#fff'} />
    </View>
    <View style={{ marginLeft: 10 }}>
      <Text style={{ fontSize: 10, opacity: 0.6, color: theme.colors.text }}>Promedio diario</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 2, color: theme.colors.text }}>
        {formatCLP(dailyAvgThisMonth)}
      </Text>
    </View>
  </View>

            {/* 🆕 Card: Gastado HOY */}
            <View style={[styles.smallCard, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
                <Ion name="cash-outline" size={20} color={theme.isDark ? '#000' : '#fff'} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontSize: 10, opacity: 0.6, color: theme.colors.text }}>Gastos del dia</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 2, color: theme.colors.text }}>
                  {formatCLP(Math.abs(dailyTotal))}
                </Text>
              </View>
            </View>
          </View>

          {/* Por confirmar */}
          {pendingCount > 0 && (
            <View style={[styles.smallCard, { backgroundColor: theme.colors.card, marginTop: 12 }]}>
              <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
                <Ion name="time-outline" size={20} color={theme.isDark ? '#000' : '#fff'} />
              </View>

              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontSize: 12, opacity: 0.7, color: theme.colors.text }}>Gastos por confirmar</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 2 }}>
                  {pendingCount}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('RecurringConfirm')}
                style={[styles.chipBtnFilled, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
                activeOpacity={0.9}
              >
                <Text style={[styles.chipTxtFilled, { color: theme.isDark ? '#000' : '#fff' }]}>Revisar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gasto del mes */}
          <View style={[styles.bigCard, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.iconCircleBig, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
              <Ion name="wallet-outline" size={26} color={theme.isDark ? '#000' : '#fff'} />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={[styles.bigCardTitle, { color: theme.colors.text }]}>{monthNameEs}</Text>
              <Text style={[styles.bigCardNumber, { color: theme.colors.text }]}>{formatCLP(monthlyTotal)}</Text>
              <Text style={[styles.bigCardHint, { color: theme.colors.text }]}>Gasto del mes</Text>
            </View>
          </View>

          {/* Carrusel Tipos (ícono redondo + nombre) */}
          {tiposGastoUI.length > 0 && (
            <View style={{ marginTop: 20, marginBottom: 8 }}>
              <FlatList
                horizontal
                data={tiposGastoUI}
                keyExtractor={(it) => it.id}
                renderItem={renderTipoCard}
                showsHorizontalScrollIndicator={false}
                style={{ minHeight: 88 }}
                contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 6 }}
                ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
              />
            </View>
          )}

          {/* Recientes */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Gastos recientes
            </Text>

            <View style={{ flex: 1 }} /> {/* empuja el botón a la derecha */}

            <TouchableOpacity
              onPress={() => navigation.navigate('ExpensesList')}
              style={[
                styles.sectionBtn,
                { borderColor: theme.isDark ? '#fff' : '#000' },
              ]}
              activeOpacity={0.9}
            >
              <Text style={[styles.sectionBtnTxt, { color: theme.colors.text }]}>Ver todos</Text>
              <Ion
                name="chevron-forward"
                size={14}
                color={theme.colors.text}
                style={{ marginLeft: 6, opacity: 0.8 }}
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={recentToShow}
            keyExtractor={(item) => item.id}
            renderItem={renderMontoItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            ListEmptyComponent={
              <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
                No hay gastos este mes.
              </Text>
            }
          />

          {/* Resumen Recurrentes */}
          <View style={[styles.bigCard, { backgroundColor: theme.colors.card, marginTop: 20 }]}>
            <View style={[styles.iconCircleBig, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
              <Ion name="repeat-outline" size={26} color={theme.isDark ? '#000' : '#fff'} />
            </View>

            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={[styles.bigCardTitle, { color: theme.colors.text }]}>Gastos recurrentes</Text>
              <Text style={[styles.bigCardNumber, { color: theme.colors.text }]}>
                {activosRecurrentes}
              </Text>
              <Text style={[styles.bigCardHint, { color: theme.colors.text }]}>
                activos
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('RecurringList')}
                style={[styles.chipBtn, { borderColor: theme.isDark ? '#fff' : '#000' }]}
              >
                <Text style={[styles.chipTxt, { color: theme.colors.text }]}>Ver todos</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Gasto semanal (gráfico moderno de barras) ===== */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Gasto semanal
            </Text>

            <Text
              style={[
                styles.sparkHint,
                { color: theme.colors.text, opacity: 0.6 }
              ]}
            >
              Últimos 7 días
            </Text>
          </View>

          <View style={[styles.sparkCard, { backgroundColor: theme.colors.card, marginTop: 8 }]}>
            <BarChart
              data={weeklyData}
              width={chartWidth}
              maxValue={dynamicMaxValue}
              noOfSections={4}
              height={220}
              barWidth={bw}
              spacing={sp}
              initialSpacing={0}
              roundedTop
              roundedBottom
              barBorderRadius={4}
              hideRules
              hideYAxisText
              xAxisThickness={0}
              yAxisThickness={0}
              frontColor={theme.isDark ? '#fff' : '#000'}
              xAxisLabelTextStyle={{
                color: theme.colors.text,
                opacity: 0.8,
                fontSize: 11,
                marginTop: 6,
              }}
              onPress={(item, index) => {
                setSelectedBarIndex(prev => (prev === index ? -1 : index));
              }}
              renderTooltip={(item, index) => {
                if (selectedBarIndex !== index) return null;
                return (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: (item?.value || 0) + 30,
                      alignSelf: 'center',
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(0,0,0,0.08)',
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      zIndex: 10,
                      ...Platform.select({
                        android: { elevation: 6 },
                        ios: {
                          shadowColor: '#000',
                          shadowOpacity: 0.2,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 3 },
                        },
                      }),
                    }}
                    pointerEvents="none"
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>
                      {formatCLP(item?.value || 0)}
                    </Text>
                    <Text style={{ color: theme.colors.text, opacity: 0.7, fontSize: 11, marginTop: 2 }}>
                      {item?.label}
                    </Text>
                  </View>
                );
              }}
            />
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 50 },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, marginTop: 40
  },
  hello: { fontSize: 20, opacity: 0.8 },
  userName: { fontSize: 26, fontWeight: 'bold' },
  avatar: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold' },

  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 1,
    borderRadius: 999,
  },
  sectionBtnTxt: { fontSize: 12, fontWeight: '700' },

  // Carrusel Tipos (ícono redondo + nombre)
  tipoCardWrap: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  tipoIconBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipoLabel: {
    marginTop: 6,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Cards pequeñas
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  smallCard: {
    flex: 0.48, padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },

  // Card grande
  bigCard: {
    marginTop: 24, padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowRadius: 5, elevation: 3,
  },
  iconCircleBig: {
    width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center',
  },
  bigCardTitle: { fontSize: 16, opacity: 0.8 },
  bigCardNumber: { fontSize: 30, fontWeight: 'bold', marginTop: 4 },
  bigCardHint: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  // Secciones
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },

  // Ítems lista (recientes)
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

  // Tarjeta del gráfico
  sparkCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    overflow: 'visible', // permite que el tooltip sobresalga
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  sparkTitle: { fontSize: 16, fontWeight: '800' },
  sparkHint: { fontSize: 12, fontWeight: '600' },

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
});
