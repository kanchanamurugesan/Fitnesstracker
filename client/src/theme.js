import { createTheme } from '@mui/material/styles';

// Soft, modern Material 3-ish palette — friendly and calm.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6750a4' },
    secondary: { main: '#7d5260' },
    success: { main: '#3a8a5f' },
    background: { default: '#faf8fd', paper: '#ffffff' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #ece7f2' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default theme;
