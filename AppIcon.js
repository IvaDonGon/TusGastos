// AppIcon.js
import React from 'react';
import {
  ArrowUp, ArrowDown, Banknote, Clock, Wallet2, Repeat,
  ShoppingCart, Bolt, Waves, Wifi, Bus, Utensils, Tag,
  Cube, Home, Settings, DollarSign, Calendar, TrendingUp,
} from 'lucide-react-native';

/**
 * Diccionario controlado de íconos Lucide.
 * Solo se importan los necesarios para reducir el bundle.
 */
const LUCIDE_REGISTRY = {
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'banknote': Banknote,
  'clock': Clock,
  'wallet-2': Wallet2,
  'repeat': Repeat,
  'shopping-cart': ShoppingCart,
  'bolt': Bolt,
  'waves': Waves,
  'wifi': Wifi,
  'bus': Bus,
  'utensils': Utensils,
  'tag': Tag,
  'cube': Cube,
  'home': Home,
  'settings': Settings,
  'dollar-sign': DollarSign,
  'calendar': Calendar,
  'trending-up': TrendingUp,
};

/**
 * Componente global para renderizar íconos Lucide.
 *
 * @param {string} name - nombre del ícono (según LUCIDE_REGISTRY)
 * @param {number} size - tamaño (ancho/alto en px)
 * @param {string} color - color del trazo (stroke)
 * @param {number} strokeWidth - grosor del trazo (por defecto 2)
 */
export default function AppIcon({
  name = 'tag',
  size = 22,
  color = '#000',
  strokeWidth = 2,
  style,
}) {
  const LucideComp = LUCIDE_REGISTRY[name] || LUCIDE_REGISTRY['tag'];
  return (
    <LucideComp
      width={size}
      height={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}
