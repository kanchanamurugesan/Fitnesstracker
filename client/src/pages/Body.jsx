import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, TextField, Button, ToggleButtonGroup,
  ToggleButton, IconButton, CircularProgress, Divider, Collapse,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '../api.js';
import { todayISO, prettyDate } from '../utils/dates.js';

const METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'muscle_mass', label: 'Muscle', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Fat', unit: '%' },
  { key: 'water_pct', label: 'Water', unit: '%' },
];

const blankForm = () => ({
  date: todayISO(), weight: '', muscle_mass: '', body_fat_pct: '', water_pct: '',
  waist: '', hips: '', arms: '',
});

export default function Body() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('weight');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  const load = () => api.getBody().then((e) => { setEntries(e); setLoading(false); });
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function add() {
    setSaving(true);
    try {
      const { waist, hips, arms, ...rest } = form;
      const measurements = {};
      if (waist) measurements.waist = Number(waist);
      if (hips) measurements.hips = Number(hips);
      if (arms) measurements.arms = Number(arms);
      await api.addBody({ ...rest, measurements });
      setForm(blankForm());
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    await api.deleteBody(id);
    await load();
  }

  const chartData = entries
    .filter((e) => e[metric] != null)
    .map((e) => ({ date: e.date.slice(5), value: e[metric] }));
  const unit = METRICS.find((m) => m.key === metric).unit;

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80dvh' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Body</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowForm((s) => !s)}>
          Add entry
        </Button>
      </Stack>

      {/* Add form */}
      <Collapse in={showForm}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField label="Date" type="date" value={form.date} onChange={set('date')} InputLabelProps={{ shrink: true }} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField label="Weight (kg)" type="number" value={form.weight} onChange={set('weight')} fullWidth />
                <TextField label="Muscle (kg)" type="number" value={form.muscle_mass} onChange={set('muscle_mass')} fullWidth />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Body fat (%)" type="number" value={form.body_fat_pct} onChange={set('body_fat_pct')} fullWidth />
                <TextField label="Water (%)" type="number" value={form.water_pct} onChange={set('water_pct')} fullWidth />
              </Stack>
              <Divider><Typography variant="caption" color="text.secondary">Measurements (cm)</Typography></Divider>
              <Stack direction="row" spacing={2}>
                <TextField label="Waist" type="number" value={form.waist} onChange={set('waist')} fullWidth />
                <TextField label="Hips" type="number" value={form.hips} onChange={set('hips')} fullWidth />
                <TextField label="Arms" type="number" value={form.arms} onChange={set('arms')} fullWidth />
              </Stack>
              <Button variant="contained" onClick={add} disabled={saving}>
                {saving ? <CircularProgress size={22} color="inherit" /> : 'Save entry'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>

      {/* Chart */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <ToggleButtonGroup
            size="small" exclusive value={metric}
            onChange={(_, v) => v && setMetric(v)} sx={{ mb: 2, flexWrap: 'wrap' }}
          >
            {METRICS.map((m) => <ToggleButton key={m.key} value={m.key}>{m.label}</ToggleButton>)}
          </ToggleButtonGroup>
          {chartData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No data yet — add an entry to see your trend.
            </Typography>
          ) : (
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v) => `${v} ${unit}`} />
                  <Line type="monotone" dataKey="value" stroke="#6750a4" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>History</Typography>
      <Stack spacing={1}>
        {[...entries].reverse().map((e) => (
          <Card key={e.id}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600}>{prettyDate(e.date)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[
                      e.weight != null && `${e.weight} kg`,
                      e.body_fat_pct != null && `${e.body_fat_pct}% fat`,
                      e.muscle_mass != null && `${e.muscle_mass} kg muscle`,
                    ].filter(Boolean).join(' · ') || 'No composition data'}
                  </Typography>
                </Box>
                <IconButton onClick={() => remove(e.id)} aria-label="delete"><DeleteOutlineIcon /></IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>No entries yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
