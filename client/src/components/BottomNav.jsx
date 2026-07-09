import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/', label: 'Schedule', icon: <CalendarMonthIcon /> },
  { path: '/nutrition', label: 'Nutrition', icon: <RestaurantIcon /> },
  { path: '/body', label: 'Body', icon: <MonitorWeightIcon /> },
  { path: '/photos', label: 'Photos', icon: <PhotoLibraryIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // /day/* belongs to the Schedule tab; otherwise match the longest path prefix.
  let value = 0;
  if (pathname.startsWith('/nutrition')) value = 1;
  else if (pathname.startsWith('/body')) value = 2;
  else if (pathname.startsWith('/photos')) value = 3;
  else if (pathname.startsWith('/settings')) value = 4;

  return (
    <Paper
      elevation={3}
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, mx: 'auto', borderRadius: 0 }}
    >
      <BottomNavigation showLabels value={value} onChange={(_, v) => navigate(TABS[v].path)}>
        {TABS.map((t) => (
          <BottomNavigationAction key={t.path} label={t.label} icon={t.icon} sx={{ minWidth: 0, px: 0.5 }} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
