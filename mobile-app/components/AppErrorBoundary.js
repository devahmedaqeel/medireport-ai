import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

/**
 * AppErrorBoundary — catches render-time errors throughout the app.
 * Shows a white, visible fallback instead of a black or red screen.
 * Must be a CLASS component (React error boundaries require class).
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary] Runtime error caught:', error);
    console.error('[AppErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.iconBox}>
              <Text style={styles.iconEmoji}>⚠️</Text>
            </View>
            <Text style={styles.title}>MediReport AI</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>

            {/* Error details (dev mode only) */}
            {__DEV__ && this.state.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>ERROR DETAILS (dev only)</Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackText} numberOfLines={10}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.message}>
              The app encountered an unexpected error.{'\n'}
              Press "Try Again" to reload, or use Guest Mode.
            </Text>

            {/* Actions */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Safety disclaimer always visible */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                ⚠️ MediReport AI is for informational use only.{'\n'}
                Not a substitute for professional medical diagnosis.
              </Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingBottom: 48,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fed7aa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 1,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackText: {
    fontSize: 10,
    color: '#7f1d1d',
    marginTop: 8,
    lineHeight: 14,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    elevation: 4,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disclaimer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
