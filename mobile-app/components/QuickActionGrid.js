import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fs, scale, verticalScale } from '../utils/responsive';

// Interactive, Animated Action Button Component (Standard Grid Item)
function QuickActionButton({ item, isDarkMode }) {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Run blink (opacity flash) and scale down bounce
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleValue, { toValue: 0.90, duration: 65, useNativeDriver: true }),
        Animated.spring(scaleValue, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacityValue, { toValue: 0.15, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 1.0, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 0.25, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 1.0, duration: 65, useNativeDriver: true }),
      ])
    ]).start(() => {
      if (item.onPress) {
        item.onPress();
      }
    });
  };

  const borderColor = isDarkMode ? '#334155' : (item.borderColor || 'transparent');

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View
        style={[
          styles.actionBtn,
          {
            backgroundColor: item.bgColor,
            borderWidth: 1.5,
            borderColor: borderColor,
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
          }
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.actionName, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.actionDesc, { color: isDarkMode ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
            {item.desc}
          </Text>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// Full-width Action Button for History & Logs
function QuickActionButtonFull({ item, isDarkMode }) {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleValue, { toValue: 0.94, duration: 65, useNativeDriver: true }),
        Animated.spring(scaleValue, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacityValue, { toValue: 0.15, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 1.0, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 0.25, duration: 45, useNativeDriver: true }),
        Animated.timing(opacityValue, { toValue: 1.0, duration: 65, useNativeDriver: true }),
      ])
    ]).start(() => {
      if (item.onPress) {
        item.onPress();
      }
    });
  };

  const borderColor = isDarkMode ? '#334155' : (item.borderColor || 'transparent');

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View
        style={[
          styles.actionBtnFull,
          {
            backgroundColor: item.bgColor,
            borderWidth: 1.5,
            borderColor: borderColor,
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
          }
        ]}
      >
        <View style={styles.rowFull}>
          <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <View style={styles.textContainerFull}>
            <Text style={[styles.actionNameFull, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
              {item.name}
            </Text>
            <Text style={[styles.actionDescFull, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
              {item.desc}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} style={styles.chevronFull} />
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default function QuickActionGrid({ navigation, onManualPress, isDarkMode = false }) {
  const actions = [
    {
      name: 'Scan Report',
      desc: 'AI camera scan',
      icon: 'camera',
      color: '#0ea5e9',
      bgColor: isDarkMode ? '#1e293b' : '#f0f9ff',
      borderColor: '#bae6fd',
      onPress: () => navigation.navigate('Scan'),
    },
    {
      name: 'Manual Entry',
      desc: 'Type report values',
      icon: 'create',
      color: '#10b981',
      bgColor: isDarkMode ? '#1e293b' : '#ecfdf5',
      borderColor: '#a7f3d0',
      onPress: () => {
        if (onManualPress) {
          onManualPress('manual');
        }
      },
    },
    {
      name: 'Lab Wiki',
      desc: 'Define biomarkers',
      icon: 'book',
      color: '#db2777',
      bgColor: isDarkMode ? '#1e293b' : '#fdf2f8',
      borderColor: '#fbcfe8',
      onPress: () => {
        if (onManualPress) {
          onManualPress('wiki');
        }
      },
    },
    {
      name: 'Export PDF',
      desc: 'Download summary',
      icon: 'document-text',
      color: '#f59e0b',
      bgColor: isDarkMode ? '#1e293b' : '#fffbeb',
      borderColor: '#fde68a',
      onPress: () => {
        if (onManualPress) {
          onManualPress('pdf');
        }
      },
    },
    {
      name: 'History',
      desc: 'View previously scanned reports & trend logs',
      icon: 'time',
      color: '#7c3aed',
      bgColor: isDarkMode ? '#1e293b' : '#f5f3ff',
      borderColor: '#ddd6fe',
      onPress: () => navigation.navigate('History'),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>Quick Actions</Text>
      
      <View style={styles.grid}>
        <View style={styles.row}>
          <QuickActionButton item={actions[0]} isDarkMode={isDarkMode} />
          <QuickActionButton item={actions[1]} isDarkMode={isDarkMode} />
        </View>
        <View style={styles.row}>
          <QuickActionButton item={actions[2]} isDarkMode={isDarkMode} />
          <QuickActionButton item={actions[3]} isDarkMode={isDarkMode} />
        </View>
        <QuickActionButtonFull item={actions[4]} isDarkMode={isDarkMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: verticalScale(20),
    paddingHorizontal: scale(4),
  },
  title: {
    fontSize: fs(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(12),
  },
  grid: {
    gap: scale(10),
  },
  row: {
    flexDirection: 'row',
    gap: scale(10),
  },
  actionBtn: {
    flex: 1,
    height: verticalScale(114),
    borderRadius: 24,
    padding: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  actionBtnFull: {
    width: '100%',
    height: verticalScale(74),
    borderRadius: 24,
    paddingHorizontal: scale(16),
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  rowFull: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: scale(8),
    width: '100%',
  },
  textContainerFull: {
    flex: 1,
    marginLeft: scale(12),
    justifyContent: 'center',
  },
  actionName: {
    fontSize: fs(13),
    fontWeight: '800',
    textAlign: 'center',
  },
  actionDesc: {
    fontSize: fs(10),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  actionNameFull: {
    fontSize: fs(14),
    fontWeight: '800',
  },
  actionDescFull: {
    fontSize: fs(11),
    fontWeight: '600',
    marginTop: 2,
  },
  chevronFull: {
    marginLeft: 'auto',
  },
});
