import React from 'react';
import { View, StyleSheet } from 'react-native';
export default function Card({ children }) { return <View style={styles.card}>{children}</View>; }
const styles = StyleSheet.create({ card: { backgroundColor:'#fff', padding:16, borderRadius:14, marginVertical:8, elevation:2 } });
