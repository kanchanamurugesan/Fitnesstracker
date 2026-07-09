import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Stack, IconButton, CircularProgress,
  LinearProgress, Grid, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import { api } from '../api.js';
import { mondayOf, addDaysISO, shortDate, todayISO } from '../utils/dates.js';

export default function Insights() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(mondayOf(todayISO()));
  const [data, setData] = useState(null);
  const to = addDaysISO(from, 6);
  const isThisWeek = from === mondayOf(todayISO());

  useEffect(() => {
    setData(null);
    api.getInsights(from, to).then(setData).catch(() => setData(null));
  }, [from, to]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ p: 2, pb: 3, bgcolor: 'primary.main', color: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Stack direction="row" alignItems="center">
          <IconButton onClick={() => navigate('/')} sx={{ color: '#fff' }} aria-label="back"><ArrowBackIcon /></IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>Weekly insights</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mt: 1 }}>
          <IconButton onClick={() => setFrom(addDaysISO(from, -7))} sx={{ color: '#fff' }} aria-label="previous week"><ChevronLeftIcon /></IconButton>
          <Typography sx={{ minWidth: 150, textAlign: 'center' }}>
            {shortDate(from)} – {shortDate(to)}
          </Typography>
          <IconButton
            onClick={() => setFrom(addDaysISO(from, 7))}
            disabled={isThisWeek}
            sx={{ color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)' } }}
            aria-label="next week"
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Box>

      {!data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40dvh' }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ p: 2 }}>
          {/* Highlights */}
          <Card sx={{ mb: 2, bgcolor: '#f3edfb', border: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>This week</Typography>
              <Stack spacing={1}>
                {data.highlights.map((h, i) => (
                  <Typography key={i} sx={{ fontWeight: 500 }}>{h}</Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Workout completion */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={600}>Workouts</Typography>
                <Typography color="text.secondary">
                  {data.workouts.done} / {data.workouts.planned || '—'} done
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={data.workouts.planned ? Math.min(100, (data.workouts.done / data.workouts.planned) * 100) : 0}
                color="success"
                sx={{ height: 8, borderRadius: 4, mt: 1 }}
              />
            </CardContent>
          </Card>

          {/* Stat grid */}
          <Grid container spacing={1.5}>
            <Stat icon={<DirectionsWalkIcon />} label="Avg steps" value={data.steps.avg?.toLocaleString() ?? '—'} />
            <Stat icon={<BedtimeIcon />} label="Avg sleep" value={data.sleep.avg != null ? `${data.sleep.avg} h` : '—'} />
            <Stat icon={<WaterDropIcon />} label="Avg water" value={data.water.avg != null ? `${data.water.avg} L` : '—'} />
            <Stat icon={<FitnessCenterIcon />} label="Avg protein" value={data.protein.avg != null ? `${data.protein.avg} g` : '—'} />
            <Stat
              icon={<LocalFireDepartmentIcon />} label="Avg calories"
              value={data.calories.avg != null ? `${data.calories.avg}` : '—'}
              sub={data.calories.goal ? `goal ${data.calories.goal}` : null}
            />
            <Stat
              icon={<MonitorWeightIcon />} label="Weight change"
              value={data.weight.change != null ? `${data.weight.change > 0 ? '+' : ''}${data.weight.change} kg` : '—'}
              sub={data.bodyFat.change != null ? `fat ${data.bodyFat.change > 0 ? '+' : ''}${data.bodyFat.change}%` : null}
              positive={data.weight.change != null && data.weight.change <= 0}
            />
          </Grid>
        </Box>
      )}
    </Box>
  );
}

function Stat({ icon, label, value, sub, positive }) {
  return (
    <Grid item xs={6}>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={1} alignItems="center" color="primary.main" sx={{ mb: 1 }}>
            {icon}
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Stack>
          <Typography variant="h6" fontWeight={700} color={positive ? 'success.main' : 'text.primary'}>
            {value}
          </Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  );
}
