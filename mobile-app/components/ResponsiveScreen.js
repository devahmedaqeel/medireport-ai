import React from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale } from '../utils/responsive';

export default function ResponsiveScreen({ 
  children, 
  style, 
  contentContainerStyle, 
  keyboardAvoiding = false, 
  scrollable = true,
  edges = ['top', 'bottom', 'left', 'right'],
  refreshControl,
}) {
  const insets = useSafeAreaInsets();
  
  // Compute paddingBottom: use provided value OR default (110 + Math.max(insets.bottom, 10))
  let providedPadding = undefined;
  if (Array.isArray(contentContainerStyle)) {
    for (const styleObj of contentContainerStyle) {
      if (styleObj && styleObj.paddingBottom !== undefined) {
        providedPadding = styleObj.paddingBottom;
      }
    }
  } else if (contentContainerStyle && contentContainerStyle.paddingBottom !== undefined) {
    providedPadding = contentContainerStyle.paddingBottom;
  }

  const finalPaddingBottom = providedPadding !== undefined 
    ? providedPadding 
    : (110 + Math.max(insets.bottom, 10));

  const container = (
    <ScrollView 
      style={[styles.scroll, style]} 
      contentContainerStyle={[
        styles.content, 
        contentContainerStyle,
        { paddingBottom: finalPaddingBottom }
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, style && style.backgroundColor ? { backgroundColor: style.backgroundColor } : null]} edges={edges}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            {scrollable ? container : children}
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      ) : (
        scrollable ? container : children
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: scale(20), paddingBottom: verticalScale(100) }
});
