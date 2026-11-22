import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '@/api/config';
import { colors, spacing } from '@/theme';

interface AuthFormProps {
  title: string;
  error: string | null;
  children: ReactNode;
  footerText: string;
  footerLink: { href: '/login' | '/register'; label: string };
}

export function AuthForm({ title, error, children, footerText, footerLink }: AuthFormProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Ionicons name="musical-notes" size={36} color="#000" />
        </View>
        <Text style={styles.title}>{title}</Text>
        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.form}>{children}</View>
        <Text style={styles.footer}>
          {footerText}{' '}
          <Link href={footerLink.href} replace style={styles.link}>
            {footerLink.label}
          </Link>
        </Text>
        <Text style={styles.server}>Server: {API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, paddingHorizontal: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,92,92,0.12)',
    padding: spacing.md,
    borderRadius: 6,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.text, flex: 1 },
  form: { gap: spacing.lg },
  footer: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  link: { color: colors.text, fontWeight: '700', textDecorationLine: 'underline' },
  server: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: spacing.xl },
});
