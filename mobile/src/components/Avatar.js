import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

const palette = ['#075E54', '#128C7E', '#25D366', '#34B7F1', '#ECC30B', '#D81159', '#7B2CBF', '#3D5A80'];

function colorFor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

export default function Avatar({ name, size = 44 }) {
  const bg = colorFor(name || 'x');
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.txt, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontWeight: '700' },
});

