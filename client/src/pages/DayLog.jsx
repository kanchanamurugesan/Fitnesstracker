import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Stack, Switch, FormControlLabel, TextField,
  Button, IconButton, InputAdornment, CircularProgress, Snackbar, Divider,
  Checkbox, Chip, LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import EggIcon from '@mui/icons-material/Egg';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import { api } from '../api.js';
import { prettyDate } from '../utils/dates.js';

const NUM_FIELDS = [
  { key: 'steps', label: 'Steps', icon: <DirectionsWalkIcon />, unit: '', step: 100 },
  { key: 'water_l', label: 'Water', icon: <WaterDropIcon />, unit: 'L', step: 0.1 },
  { key: 'protein_g', label: 'Protein', icon: <EggIcon />, unit: 'g', step: 5 },
  { key: 'sleep_hrs', label: 'Sleep', icon: <BedtimeIcon />, unit: 'hrs', step: 0.5 },
];

export default function DayLog() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState('');
  const [form, setForm] = useState(null);
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    (async () => {
      const [log, ex] = await Promise.all([api.getLog(date), api.getExercises(date)]);
      setLabel(ex.workout_label || '');
      setExercises(ex.exercises);
      setForm({
        workout_done: log.workout_done,
        core_done: log.core_done,
        steps: log.steps ?? '',
        water_l: log.water_l ?? '',
        protein_g: log.protein_g ?? '',
        sleep_hrs: log.sleep_hrs ?? '',
        notes: log.notes ?? '',
      });
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [date]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));
  const setEx = (i, patch) => setExercises((list) => list.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)));

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        api.saveLog(date, form),
        exercises.length
          ? api.saveExercises(
              date,
              exercises.map((e) => ({ exercise_id: e.id, done: e.done, weight: e.weight, notes: e.notes }))
            )
          : Promise.resolve(),
      ]);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80dvh' }}><CircularProgress /></Box>;
  }

  const isRest = /rest/i.test(label);
  const doneCount = exercises.filter((e) => e.done).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ p: 2, pb: 3, bgcolor: 'primary.main', color: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <IconButton onClick={() => navigate('/')} sx={{ color: '#fff', mb: 1 }} aria-label="back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" sx={{ opacity: 0.85 }}>{prettyDate(date)}</Typography>
        <Typography variant="h5">{label || 'Day log'}</Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          {/* Exercises checklist */}
          {exercises.length > 0 && (
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Exercises</Typography>
                  <Typography variant="caption" color="text.secondary">{doneCount}/{exercises.length} done</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={exercises.length ? (doneCount / exercises.length) * 100 : 0}
                  color="success"
                  sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
                />
                <Stack divider={<Divider flexItem />}>
                  {exercises.map((ex, i) => (
                    <Stack key={ex.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                      <Checkbox
                        checked={ex.done}
                        onChange={(e) => setEx(i, { done: e.target.checked })}
                        sx={{ p: 0.5 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{ textDecoration: ex.done ? 'line-through' : 'none', color: ex.done ? 'text.disabled' : 'text.primary' }}
                          noWrap
                        >
                          {ex.name}
                        </Typography>
                        {ex.sets && ex.reps && (
                          <Chip size="small" variant="outlined" label={`${ex.sets} × ${ex.reps}`} sx={{ height: 20, fontSize: 11 }} />
                        )}
                      </Box>
                      {ex.sets != null && (
                        <TextField
                          size="small"
                          type="number"
                          value={ex.weight}
                          onChange={(e) => setEx(i, { weight: e.target.value })}
                          sx={{ width: 84 }}
                          InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                        />
                      )}
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {!isRest && (
            <Card>
              <CardContent>
                <FormControlLabel
                  control={<Switch checked={form.workout_done} onChange={toggle('workout_done')} />}
                  label="Workout done"
                />
                <Divider sx={{ my: 1 }} />
                <FormControlLabel
                  control={<Switch checked={form.core_done} onChange={toggle('core_done')} />}
                  label="Core done"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Daily metrics</Typography>
              <Stack spacing={2}>
                {NUM_FIELDS.map((f) => (
                  <TextField
                    key={f.key}
                    label={f.label}
                    type="number"
                    inputProps={{ step: f.step, min: 0 }}
                    value={form[f.key]}
                    onChange={set(f.key)}
                    fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{f.icon}</InputAdornment>,
                      endAdornment: f.unit ? <InputAdornment position="end">{f.unit}</InputAdornment> : null,
                    }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <TextField label="Notes" value={form.notes} onChange={set('notes')} fullWidth multiline minRows={2} />
            </CardContent>
          </Card>

          <Button variant="contained" size="large" onClick={save} disabled={saving}>
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Save'}
          </Button>
        </Stack>
      </Box>

      <Snackbar open={saved} autoHideDuration={2000} onClose={() => setSaved(false)} message="Saved" />
    </Box>
  );
}
