import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { COLORS } from '../utils/constants';

export default function SplashScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>MultiTabWatsap</Text>
      <ActivityIndicator color="#fff" size="large" style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
});

