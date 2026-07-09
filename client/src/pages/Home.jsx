import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardActionArea, Stack, Chip, Avatar, CircularProgress, Button, IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import HotelIcon from '@mui/icons-material/Hotel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsightsIcon from '@mui/icons-material/Insights';
import { api } from '../api.js';
import { planDayToISO, currentWeek, prettyDate, todayISO } from '../utils/dates.js';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]);
  const [programStart, setProgramStart] = useState(null);
  const [week, setWeek] = useState(null);
  const [days, setDays] = useState([]);
  const [logs, setLogs] = useState({}); // date -> log

  useEffect(() => {
    (async () => {
      const [wk, settings] = await Promise.all([api.getWeeks(), api.getSettings()]);
      setWeeks(wk);
      setProgramStart(settings.program_start);
      setWeek(currentWeek(settings.program_start, wk));
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (week == null) return;
    (async () => {
      const d = await api.getWeek(week);
      setDays(d);
      const entries = await Promise.all(
        d.map(async (pd) => {
          const iso = planDayToISO(programStart, pd.week, pd.day);
          const log = iso ? await api.getLog(iso) : null;
          return [iso, log];
        })
      );
      setLogs(Object.fromEntries(entries.filter(([iso]) => iso)));
    })().catch(() => {});
  }, [week, programStart]);

  if (loading) {
    return <Centered><CircularProgress /></Centered>;
  }

  if (!weeks.length) {
    return (
      <Centered>
        <UploadFileIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
        <Typography variant="h6">No plan yet</Typography>
        <Typography color="text.secondary" sx={{ mb: 2, textAlign: 'center', px: 4 }}>
          Import your Excel workout routine to get started.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/settings')}>Go to Settings</Button>
      </Centered>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h5" sx={{ mb: 0.5 }}>Schedule</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Your {weeks.length}-week program
          </Typography>
        </Box>
        <IconButton color="primary" onClick={() => navigate('/insights')} aria-label="weekly insights">
          <InsightsIcon />
        </IconButton>
      </Stack>

      {/* Week selector */}
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1, mb: 2 }}>
        {weeks.map((w) => (
          <Chip
            key={w}
            label={`Week ${w}`}
            color={w === week ? 'primary' : 'default'}
            variant={w === week ? 'filled' : 'outlined'}
            onClick={() => setWeek(w)}
          />
        ))}
      </Stack>

      <Stack spacing={1.5}>
        {days.map((pd) => {
          const iso = planDayToISO(programStart, pd.week, pd.day);
          const log = logs[iso];
          const isRest = /rest/i.test(pd.workout_label || '');
          const done = log?.workout_done;
          const isToday = iso === todayISO();
          return (
            <Card key={pd.id} sx={{ borderColor: isToday ? 'primary.main' : undefined, borderWidth: isToday ? 2 : 1 }}>
              <CardActionArea onClick={() => navigate(`/day/${iso}`)} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: isRest ? 'grey.200' : 'primary.main', color: isRest ? 'text.secondary' : '#fff', width: 46, height: 46 }}>
                    {isRest ? <HotelIcon /> : <Typography fontWeight={700}>{pd.day}</Typography>}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600} noWrap>{pd.workout_label || '—'}</Typography>
                      {isToday && <Chip label="Today" size="small" color="primary" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{iso ? prettyDate(iso) : pd.day}</Typography>
                  </Box>
                  {!isRest && (done
                    ? <CheckCircleIcon color="success" />
                    : <RadioButtonUncheckedIcon sx={{ color: 'grey.300' }} />)}
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

function Centered({ children }) {
  return (
    <Box sx={{ minHeight: '80dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Box>
  );
}
