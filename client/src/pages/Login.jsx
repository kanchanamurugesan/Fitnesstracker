import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Stack, CircularProgress, Link, Alert,
} from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isSignup) await signup(email.trim(), password);
      else await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', p: 3,
        background: 'linear-gradient(160deg, #f3edfb 0%, #faf8fd 60%)',
      }}
    >
      <Box sx={{ width: 64, height: 64, borderRadius: 4, bgcolor: 'primary.main', display: 'grid', placeItems: 'center', mb: 2, color: '#fff' }}>
        <FitnessCenterIcon fontSize="large" />
      </Box>
      <Typography variant="h5">Fitness Tracker</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {isSignup ? 'Create your account' : 'Welcome back'}
      </Typography>

      <Box component="form" onSubmit={submit} sx={{ width: '100%', maxWidth: 360 }}>
        <Stack spacing={2}>
          <TextField
            label="Email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth autoComplete="email" required
          />
          <TextField
            label="Password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth required
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            helperText={isSignup ? 'At least 6 characters' : ' '}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? <CircularProgress size={24} color="inherit" /> : isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <Link
          component="button" type="button"
          onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }}
        >
          {isSignup ? 'Sign in' : 'Sign up'}
        </Link>
      </Typography>
    </Box>
  );
}
