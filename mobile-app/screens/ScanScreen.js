import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity,
  TextInput,
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import { scanReport, analyzeTextDirect, API_BASE, checkBackendHealth } from '../services/api';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';

export default function ScanScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualText, setManualText] = useState('');
  const [analyzingManual, setAnalyzingManual] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'connected', 'offline'
  
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (route?.params?.openManual) {
      setShowManualEntry(true);
      navigation.setParams({ openManual: undefined });
    }
  }, [route?.params?.openManual]);

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    inputBg: isDarkMode ? '#0f172a' : '#ffffff',
    badgeBg: isDarkMode ? '#1e293b' : '#f1f5f9',
  };

  const steps = [
    "Preparing image...",
    "Compressing image...",
    "Uploading to backend...",
    "Extracting OCR text...",
    "Running medical analysis...",
    "Preparing result..."
  ];

  const checkConnection = useCallback(async () => {
    try {
      const status = await checkBackendHealth();
      if (status && status.status === 'ok') {
        setBackendStatus('connected');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your gallery to upload reports.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your camera to take report photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const runOCR = async () => {
    if (!image) {
      Alert.alert('No Image', 'Please select or capture a report first.');
      return;
    }
    
    setLoading(true);
    setProgressStep(0); // Preparing image
    
    try {
      // Step 2: Compressing image
      setProgressStep(1);
      let uploadUri = image;
      try {
        // Attempt to compress with minimal loss and no resize for better OCR quality
        const manipResult = await ImageManipulator.manipulateAsync(
          image,
          [], // No resizing for initial OCR
          { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG } // Max quality
        );
        uploadUri = manipResult.uri;
        console.log("[DEBUG] Image manipulated for OCR (no resize, compress: 1.0):", uploadUri);
      } catch (e) {
        console.warn("[WARN] Image manipulation failed, falling back to original URI:", e.message);
      }

      // Step 3: Uploading
      setProgressStep(2);
      
      const fileName = uploadUri.split('/').pop();
      const fileType = fileName.split('.').pop();
      const mimeType = `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;

      console.log("[DEBUG-UPLOAD] Image URI:", uploadUri);
      console.log("[DEBUG-UPLOAD] File Name:", fileName);
      console.log("[DEBUG-UPLOAD] File Type:", mimeType);
      console.log("[DEBUG-UPLOAD] API URL:", API_BASE + "/api/reports/scan");

      const data = await scanReport(uploadUri);
      
      console.log("[DEBUG-FRONTEND] Backend Response:", JSON.stringify(data, null, 2));
      console.log("[DEBUG-FRONTEND] OCR Text Length:", data.ocr_text ? data.ocr_text.length : 0);
      console.log("[DEBUG-FRONTEND] Markers Detected Count:", data.markers_detected ? data.markers_detected.length : 0);
      console.log("[DEBUG-FRONTEND] Needs Review:", data.needs_review);
      console.log("[DEBUG-FRONTEND] Rejection Reason:", data.rejection_reason);


      // Step 4: Extracting (simulated delay as scanReport already finished)
      setProgressStep(3);
      
      // Handle backend returning success: false
      if (data.success === false) {
        setProgressStep(5);
        Alert.alert(
          "Scan Failed",
          data.message || data.error || "The scan could not be processed due to an unknown error.",
          [
            { text: "OK", onPress: () => setImage(null) },
            { text: "Manual Entry", onPress: () => setShowManualEntry(true) }
          ]
        );
        return; // Exit function after showing alert
      }

      // If backend returned success: true, but with no OCR text
      if (!data.ocr_text || data.ocr_text.trim().length === 0) {
        setProgressStep(5);
        Alert.alert(
          "Unreadable Report",
          data.rejection_reason || "The system could not extract any readable text from the image. Please ensure you are uploading a valid lab report with clear text.",
          [
            { text: "OK", onPress: () => setImage(null) },
            { text: "Manual Entry", onPress: () => setShowManualEntry(true) }
          ]
        );
        return;
      }

      // If OCR text exists but no markers were detected — send to OCR preview for correction
      const markersCount = (data.tests || data.markers_detected || []).length;
      if (markersCount === 0 && data.needs_review) {
        setProgressStep(4);
        Alert.alert(
          "Review Needed",
          data.rejection_reason || "Text was extracted but no medical markers were identified. Please verify the text manually.",
          [
            { text: "Review & Correct", onPress: () => navigateToOCRPreview(data) },
            { text: "Manual Entry", onPress: () => setShowManualEntry(true) }
          ]
        );
        return;
      }

      // SUCCESS: markers found — navigate directly to Result screen
      setProgressStep(4);
      setTimeout(() => {
        setProgressStep(5);
        navigateToResult(data);
      }, 500);

    } catch (error) {
      console.error(`[ERROR] Scan failed:`, error);
      Alert.alert(
        "Scan Failed",
        `${error.message}\n\nMake sure the backend is running at ${API_BASE}.`,
        [
          { text: "Retry", onPress: () => runOCR() },
          { text: "Manual Entry", onPress: () => setShowManualEntry(true) },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualText || manualText.trim().length < 10) {
      Alert.alert("Input Too Short", "Please paste or type the full content of your lab report.");
      return;
    }

    setAnalyzingManual(true);
    try {
      const result = await analyzeTextDirect(manualText);
      setShowManualEntry(false);
      navigation.navigate('Result', { result });
    } catch (error) {
      Alert.alert("Analysis Failed", error.message);
    } finally {
      setAnalyzingManual(false);
    }
  };

  const navigateToResult = (data) => {
    // Navigate directly to Result screen with the full analysis from backend
    navigation.navigate('Result', { result: data });
  };

  const navigateToOCRPreview = (data) => {
    // Navigate to OCR preview for manual correction when no markers found
    navigation.navigate('OCRPreview', {
      ocrText: data.ocr_text || '',
      ocrConfidence: data.ocrConfidence
    });
  };

  return (
    <ResponsiveScreen 
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.container, { paddingBottom: 110 + Math.max(insets.bottom, 10) }]} 
      edges={['top']}
    >
      {/* 1. Header with Title and Connection Status */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: colors.text }]}>Report Scanner</Text>
          
          {/* Status Badge */}
          {backendStatus === 'checking' && (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#334155' : '#fef3c7' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#d97706' }]} />
              <Text style={[styles.statusText, { color: '#d97706' }]}>Checking...</Text>
            </View>
          )}
          {backendStatus === 'connected' && (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#1e3a8a' : '#d1fae5' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.statusText, { color: '#10b981' }]}>Connected</Text>
            </View>
          )}
          {backendStatus === 'offline' && (
            <TouchableOpacity 
              onPress={checkConnection}
              activeOpacity={0.8}
              style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#3f1a1a' : '#fee2e2' }]}
            >
              <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.statusText, { color: '#ef4444' }]}>Offline (Retry)</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Scan your lab report using the camera or gallery to extract and analyze medical markers automatically.
        </Text>
      </View>

      {/* 2. Upload Box Card (If no image) */}
      {!image ? (
        <AppCard style={[styles.uploadCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={[styles.uploadIconContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff' }]}>
            <Ionicons name="document-text-outline" size={scale(44)} color="#0ea5e9" />
          </View>
          <Text style={[styles.uploadTitle, { color: colors.text }]}>No Report Selected</Text>
          <Text style={[styles.uploadDesc, { color: colors.textMuted }]}>
            Align the report clearly in a well-lit area. We support JPEG and PNG formats.
          </Text>

          <View style={styles.actionButtonContainer}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.actionBtnPrimary]} 
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.actionBtnSecondary, { borderColor: '#0ea5e9', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }]} 
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={20} color="#0ea5e9" />
              <Text style={[styles.actionBtnText, { color: '#0ea5e9' }]}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </AppCard>
      ) : (
        /* 3. Image Preview Card (If image exists) */
        <AppCard style={[styles.previewCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.previewImageWrapper}>
            <Image source={{ uri: image }} style={[styles.previewImage, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]} resizeMode="contain" />
          </View>
          
          <Text style={[styles.previewTitle, { color: colors.text }]}>Report Preview</Text>
          <Text style={[styles.previewDesc, { color: colors.textMuted }]}>
            Ensure all values, dates, and test names are clearly legible before proceeding.
          </Text>

          <View style={styles.buttonRowSideBySide}>
            <TouchableOpacity 
              style={[styles.actionBtnHalf, styles.actionBtnSecondary, { borderColor: '#ef4444', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }]} 
              onPress={() => setImage(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Remove</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtnHalf, styles.actionBtnPrimary]} 
              onPress={runOCR}
              activeOpacity={0.8}
            >
              <Ionicons name="analytics-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Analyze Now</Text>
            </TouchableOpacity>
          </View>
        </AppCard>
      )}

      {/* 4. Tips Card Section */}
      <AppCard style={[styles.tipsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.tipsCardTitle, { color: colors.text }]}>Tips for Better Results 💡</Text>
        
        <View style={styles.tipRow}>
          <View style={[styles.tipIconBadge, { backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff' }]}>
            <Ionicons name="sunny-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={styles.tipTextCol}>
            <Text style={[styles.tipTextTitle, { color: colors.text }]}>Good Lighting</Text>
            <Text style={[styles.tipTextDesc, { color: colors.textMuted }]}>Avoid harsh shadows or camera glares reflecting on the paper.</Text>
          </View>
        </View>

        <View style={styles.tipRow}>
          <View style={[styles.tipIconBadge, { backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff' }]}>
            <Ionicons name="scan-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={styles.tipTextCol}>
            <Text style={[styles.tipTextTitle, { color: colors.text }]}>Keep it Flat</Text>
            <Text style={[styles.tipTextDesc, { color: colors.textMuted }]}>Align the report pages horizontally and keep the paper flat.</Text>
          </View>
        </View>

        <View style={styles.tipRow}>
          <View style={[styles.tipIconBadge, { backgroundColor: isDarkMode ? '#0f172a' : '#f0f9ff' }]}>
            <Ionicons name="eye-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={styles.tipTextCol}>
            <Text style={[styles.tipTextTitle, { color: colors.text }]}>Text Readability</Text>
            <Text style={[styles.tipTextDesc, { color: colors.textMuted }]}>Ensure test names and numbers are not blurry or out of focus.</Text>
          </View>
        </View>
      </AppCard>

      {/* 5. Manual Entry Link Section */}
      <TouchableOpacity 
        style={[styles.manualLinkCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        onPress={() => setShowManualEntry(true)}
        activeOpacity={0.8}
      >
        <View style={styles.manualLinkLeft}>
          <View style={[styles.manualLinkIcon, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}>
            <Ionicons name="create-outline" size={20} color="#0ea5e9" />
          </View>
          <View>
            <Text style={[styles.manualLinkTitle, { color: colors.text }]}>Manual Report Entry</Text>
            <Text style={[styles.manualLinkDesc, { color: colors.textMuted }]}>Type or paste report text instead of scanning</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {/* MODAL: Manual Entry (Styled) */}
      <Modal visible={showManualEntry} animationType="slide" transparent={false}>
        <ResponsiveScreen 
          style={{ backgroundColor: colors.bg }}
          edges={['top', 'bottom']} 
          keyboardAvoiding={true}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manual Entry</Text>
            <TouchableOpacity onPress={() => setShowManualEntry(false)}>
              <Text style={styles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: colors.textMuted }]}>
            Enter or paste the full content of your lab report here. For example: "Hemoglobin 14.5, sugar 110..."
          </Text>
          <TextInput
            style={[styles.manualInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            multiline
            placeholder="Paste your report details here..."
            placeholderTextColor={colors.textMuted}
            value={manualText}
            onChangeText={setManualText}
            textAlignVertical="top"
          />
          <AppButton 
            title="Analyze Manual Text" 
            onPress={handleManualSubmit}
            loading={analyzingManual}
            style={styles.submitBtn}
          />
        </ResponsiveScreen>
      </Modal>

      {/* Full screen progress-loader overlay */}
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)' }]}>
          <View style={styles.loadingPulseOuter}>
            <View style={styles.loadingPulseInner}>
              <Ionicons name="pulse" size={40} color="#0ea5e9" />
            </View>
          </View>
          
          <Text style={[styles.loadingText, { color: colors.text }]}>{steps[progressStep] || "Processing..."}</Text>
          <Text style={[styles.loadingSub, { color: colors.textMuted }]}>Step {progressStep + 1} of {steps.length}</Text>
          
          {/* Progress bar container */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFg, { width: `${((progressStep + 1) / steps.length) * 100}%` }]} />
          </View>
          
          {progressStep >= 4 && (
            <Text style={styles.longWaitText}>interpreting clinical references, please hold on...</Text>
          )}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: scale(20) },
  header: { marginBottom: verticalScale(20) },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) },
  title: { fontSize: fs(24), fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: fs(13), lineHeight: 18 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: fs(10), fontWeight: '800' },
  
  uploadCard: { padding: scale(24), alignItems: 'center', borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', marginBottom: verticalScale(20) },
  uploadIconContainer: { width: scale(64), height: scale(64), borderRadius: scale(32), justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(16), elevation: 2, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
  uploadTitle: { fontSize: fs(17), fontWeight: '800', marginBottom: 4 },
  uploadDesc: { fontSize: fs(12), textAlign: 'center', lineHeight: 18, marginBottom: verticalScale(20), paddingHorizontal: scale(10) },
  actionButtonContainer: { width: '100%', gap: 12 },
  
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  actionBtnPrimary: { backgroundColor: '#0ea5e9' },
  actionBtnSecondary: { borderWidth: 1 },
  actionBtnText: { color: '#fff', fontSize: fs(14), fontWeight: '800' },
  
  previewCard: { padding: scale(16), borderRadius: 24, marginBottom: verticalScale(20) },
  previewImageWrapper: { width: '100%', height: verticalScale(240), borderRadius: 16, overflow: 'hidden', marginBottom: verticalScale(16) },
  previewImage: { width: '100%', height: '100%' },
  previewTitle: { fontSize: fs(16), fontWeight: '800', marginBottom: 4 },
  previewDesc: { fontSize: fs(12), lineHeight: 18, marginBottom: verticalScale(16) },
  buttonRowSideBySide: { flexDirection: 'row', gap: 10, width: '100%' },
  actionBtnHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  
  tipsCard: { padding: scale(20), borderRadius: 24, marginBottom: verticalScale(20) },
  tipsCardTitle: { fontSize: fs(15), fontWeight: '800', marginBottom: verticalScale(16) },
  tipRow: { flexDirection: 'row', gap: 12, marginBottom: verticalScale(14) },
  tipIconBadge: { width: scale(36), height: scale(36), borderRadius: scale(18), justifyContent: 'center', alignItems: 'center' },
  tipTextCol: { flex: 1 },
  tipTextTitle: { fontSize: fs(13), fontWeight: '800', marginBottom: 2 },
  tipTextDesc: { fontSize: fs(12), lineHeight: 16 },
  
  manualLinkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: scale(16), borderRadius: 20, borderWidth: 1, borderStyle: 'solid' },
  manualLinkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  manualLinkIcon: { width: scale(38), height: scale(38), borderRadius: scale(19), justifyContent: 'center', alignItems: 'center' },
  manualLinkTitle: { fontSize: fs(13), fontWeight: '800', marginBottom: 2 },
  manualLinkDesc: { fontSize: fs(11), lineHeight: 15 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(16), padding: scale(20) },
  modalTitle: { fontSize: fs(22), fontWeight: '900' },
  modalSub: { fontSize: fs(13), lineHeight: 18, paddingHorizontal: scale(20), marginBottom: verticalScale(16) },
  closeBtn: { fontSize: fs(15), color: '#ef4444', fontWeight: '800' },
  manualInput: { flex: 1, borderRadius: 16, padding: scale(16), fontSize: fs(14), borderWidth: 1, marginHorizontal: scale(20), minHeight: verticalScale(240), marginBottom: verticalScale(20) },
  submitBtn: { height: 54, borderRadius: 14, marginHorizontal: scale(20), marginBottom: verticalScale(20) },
  
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: 30 },
  loadingPulseOuter: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(14, 165, 233, 0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  loadingPulseInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(14, 165, 233, 0.15)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: fs(18), fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  loadingSub: { fontSize: fs(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 },
  progressBarBg: { width: '80%', height: 6, backgroundColor: '#cbd5e1', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressBarFg: { height: '100%', backgroundColor: '#0ea5e9', borderRadius: 3 },
  longWaitText: { fontSize: fs(11), color: '#cbd5e1', fontStyle: 'italic', marginTop: 10 }
});
