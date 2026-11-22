import { useState } from 'react';
import { useSession } from '@/auth/session';
import { AuthForm } from '@/components/AuthForm';
import { PrimaryButton, TextField } from '@/components/Form';

export default function LoginScreen() {
  const signIn = useSession((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Log in"
      error={error}
      footerText="New here?"
      footerLink={{ href: '/register', label: 'Create an account' }}
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <PrimaryButton title="Log in" onPress={submit} loading={loading} disabled={!email || password.length < 8} />
    </AuthForm>
  );
}
