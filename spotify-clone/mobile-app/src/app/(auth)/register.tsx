import { useState } from 'react';
import { useSession } from '@/auth/session';
import { AuthForm } from '@/components/AuthForm';
import { PrimaryButton, TextField } from '@/components/Form';

export default function RegisterScreen() {
  const register = useSession((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Create account"
      error={error}
      footerText="Already have an account?"
      footerLink={{ href: '/login', label: 'Log in' }}
    >
      <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password (8+ characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <PrimaryButton
        title="Create account"
        onPress={submit}
        loading={loading}
        disabled={name.trim().length < 2 || !email || password.length < 8}
      />
    </AuthForm>
  );
}
