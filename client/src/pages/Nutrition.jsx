import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, TextField, Button, IconButton,
  CircularProgress, LinearProgress, Collapse, MenuItem, Chip, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../api.js';
import { todayISO } from '../utils/dates.js';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const blank = () => ({ name: '', meal_type: 'Breakfast', calories: '', protein_g: '', carbs_g: '', fat_g: '' });

export default function Nutrition() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [goals, setGoals] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const goal = goals.calorie_goal;

  const load = () => api.getMeals(date).then(setData);
  useEffect(() => { setData(null); load().catch(() => {}); }, [date]);
  useEffect(() => { api.getSettings().then(setGoals).catch(() => {}); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.addMeal({ ...form, date });
      setForm(blank());
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    await api.deleteMeal(id);
    await load();
  }

  if (!data) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80dvh' }}><CircularProgress /></Box>;
  }

  const { meals, totals } = data;
  const cals = Math.round(totals.calories);
  const pct = goal ? Math.min(100, (cals / goal) * 100) : 0;
  const over = goal && cals > goal;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Nutrition</Typography>
        <TextField type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>

      {/* Summary */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="h4" fontWeight={800}>{cals}</Typography>
            <Typography color="text.secondary">{goal ? `/ ${goal} kcal` : 'kcal'}</Typography>
            {over && <Chip size="small" color="warning" label="over goal" />}
          </Stack>
          {goal ? (
            <LinearProgress
              variant="determinate" value={pct}
              color={over ? 'warning' : 'primary'}
              sx={{ height: 8, borderRadius: 4, mt: 1 }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">Set a daily calorie goal in Settings to track progress.</Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Macro label="Protein" value={totals.protein_g} goal={goals.protein_goal} />
            <Macro label="Carbs" value={totals.carbs_g} goal={goals.carbs_goal} />
            <Macro label="Fat" value={totals.fat_g} goal={goals.fat_goal} />
          </Stack>
        </CardContent>
      </Card>

      <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={() => setShowForm((s) => !s)} sx={{ mb: 2 }}>
        Add meal
      </Button>

      <Collapse in={showForm}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField label="Meal name" value={form.name} onChange={set('name')} fullWidth autoFocus />
              <TextField select label="Type" value={form.meal_type} onChange={set('meal_type')} fullWidth>
                {MEAL_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField label="Calories" type="number" value={form.calories} onChange={set('calories')} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField label="Protein (g)" type="number" value={form.protein_g} onChange={set('protein_g')} fullWidth />
                <TextField label="Carbs (g)" type="number" value={form.carbs_g} onChange={set('carbs_g')} fullWidth />
                <TextField label="Fat (g)" type="number" value={form.fat_g} onChange={set('fat_g')} fullWidth />
              </Stack>
              <Button variant="contained" onClick={add} disabled={saving || !form.name.trim()}>
                {saving ? <CircularProgress size={22} color="inherit" /> : 'Save meal'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>

      {/* Meal list */}
      <Stack spacing={1}>
        {meals.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No meals logged for this day.
          </Typography>
        )}
        {meals.map((m) => (
          <Card key={m.id}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={600} noWrap>{m.name}</Typography>
                    {m.meal_type && <Chip size="small" variant="outlined" label={m.meal_type} />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {[
                      m.calories != null && `${Math.round(m.calories)} kcal`,
                      m.protein_g != null && `P ${m.protein_g}`,
                      m.carbs_g != null && `C ${m.carbs_g}`,
                      m.fat_g != null && `F ${m.fat_g}`,
                    ].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <IconButton onClick={() => remove(m.id)} aria-label="delete"><DeleteOutlineIcon /></IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

function Macro({ label, value, goal }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center', bgcolor: 'background.default', borderRadius: 2, py: 1 }}>
      <Typography fontWeight={700}>
        {Math.round(value)}
        {goal ? <Typography component="span" variant="caption" color="text.secondary">/{Math.round(goal)}</Typography> : ''}g
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}
