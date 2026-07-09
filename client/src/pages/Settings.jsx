import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, Button, TextField, Alert,
  ToggleButtonGroup, ToggleButton, CircularProgress, Snackbar,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { logout, user } = useAuth();
  const fileRef = useRef();
  const [settings, setSettings] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [importErr, setImportErr] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState('');

  // change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwErr, setPwErr] = useState('');

  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}); }, []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportErr(null); setImportMsg(null);
    try {
      const r = await api.importPlan(file);
      let msg = `Imported ${r.imported} days across ${r.weeks} weeks`;
      if (r.exercises) msg += `, ${r.exercises} exercises`;
      if (r.macros) msg += '. Nutrition goals set from the Macro sheet';
      setImportMsg(`${msg}.`);
      setSettings(await api.getSettings());
    } catch (err) {
      setImportErr(err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveStart(e) {
    const program_start = e.target.value;
    setSettings((s) => ({ ...s, program_start }));
    await api.saveSettings({ ...settings, program_start });
    setToast('Program start updated');
  }

  async function saveUnits(units_weight) {
    const next = { ...settings, units_weight };
    setSettings(next);
    await api.saveSettings(next);
    setToast('Units updated');
  }

  async function saveGoals() {
    await api.saveSettings(settings);
    setToast('Goals updated');
  }
  const setGoal = (key) => (e) => setSettings((s) => ({ ...s, [key]: e.target.value }));

  async function changePassword() {
    setPwErr('');
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword('');
      setToast('Password changed');
    } catch (e) {
      setPwErr(e.message);
    }
  }

  if (!settings) return null;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Settings</Typography>

      <Stack spacing={2}>
        {/* Import */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Workout plan</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
              Upload your Excel routine (columns: Week, Day, Workout).
            </Typography>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onFile} />
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <CircularProgress size={22} color="inherit" /> : 'Upload Excel'}
            </Button>
            {importMsg && <Alert severity="success" sx={{ mt: 2 }}>{importMsg}</Alert>}
            {importErr && <Alert severity="error" sx={{ mt: 2 }}>{importErr}</Alert>}
          </CardContent>
        </Card>

        {/* Program start */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Program start (Week 1, Monday)</Typography>
            <TextField
              type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={settings.program_start || ''} onChange={saveStart}
            />
          </CardContent>
        </Card>

        {/* Units */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Weight units</Typography>
            <ToggleButtonGroup exclusive value={settings.units_weight} onChange={(_, v) => v && saveUnits(v)}>
              <ToggleButton value="kg">kg</ToggleButton>
              <ToggleButton value="lb">lb</ToggleButton>
            </ToggleButtonGroup>
          </CardContent>
        </Card>

        {/* Nutrition goals */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Daily nutrition goals</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
              Tracked on the Nutrition tab. Auto-filled from your workbook's Macro
              Calculator sheet on import — edit any value here. Leave blank for none.
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Calories" type="number" fullWidth
                InputProps={{ endAdornment: <Typography color="text.secondary">kcal</Typography> }}
                value={settings.calorie_goal ?? ''} onChange={setGoal('calorie_goal')} onBlur={saveGoals}
              />
              <Stack direction="row" spacing={2}>
                <TextField label="Protein" type="number" fullWidth
                  InputProps={{ endAdornment: <Typography color="text.secondary">g</Typography> }}
                  value={settings.protein_goal ?? ''} onChange={setGoal('protein_goal')} onBlur={saveGoals} />
                <TextField label="Carbs" type="number" fullWidth
                  InputProps={{ endAdornment: <Typography color="text.secondary">g</Typography> }}
                  value={settings.carbs_goal ?? ''} onChange={setGoal('carbs_goal')} onBlur={saveGoals} />
                <TextField label="Fat" type="number" fullWidth
                  InputProps={{ endAdornment: <Typography color="text.secondary">g</Typography> }}
                  value={settings.fat_goal ?? ''} onChange={setGoal('fat_goal')} onBlur={saveGoals} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Account</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
              Signed in as <b>{user?.email}</b>
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Change password</Typography>
            <Stack spacing={2}>
              <TextField label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <TextField label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} helperText="At least 6 characters" />
              {pwErr && <Alert severity="error">{pwErr}</Alert>}
              <Button variant="outlined" onClick={changePassword} disabled={!currentPassword || !newPassword}>Update password</Button>
            </Stack>
          </CardContent>
        </Card>

        <Button color="inherit" onClick={logout}>Sign out</Button>
      </Stack>

      <Snackbar open={Boolean(toast)} autoHideDuration={2000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
