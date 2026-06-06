import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAccount } from '../context/AccountContext';
import Avatar from './Avatar';
import { COLORS } from '../utils/constants';

/**
 * Horizontal pill bar of every signed-in account, plus an "Add" button.
 * Tapping a pill switches the active account instantly.
 */
export default function AccountSwitcherTabs({ onAdd }) {
  const { accounts, activeId, switchTo } = useAccount();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.barContent}
    >
      {accounts.map((a) => {
        const active = a.id === activeId;
        return (
          <TouchableOpacity
            key={a.id}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => switchTo(a.id)}
            activeOpacity={0.8}
          >
            <Avatar name={a.displayName || a.username} size={26} />
            <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
              {a.displayName || a.username}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.addPill} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.addPlus}>＋</Text>
        <Text style={styles.addText}>Add</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: COLORS.primaryLight, maxHeight: 56 },
  barContent: { paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 6,
    maxWidth: 160,
  },
  pillActive: { backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '600' },
  pillTextActive: { color: COLORS.primary },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 4,
  },
  addPlus: { color: '#fff', fontSize: 18, fontWeight: '700' },
  addText: { color: '#fff', fontWeight: '700' },
});

