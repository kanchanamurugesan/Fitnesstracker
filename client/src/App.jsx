import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './context/AuthContext.jsx';
import BottomNav from './components/BottomNav.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import DayLog from './pages/DayLog.jsx';
import Body from './pages/Body.jsx';
import Nutrition from './pages/Nutrition.jsx';
import Photos from './pages/Photos.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}><CircularProgress /></Box>;
  }
  if (!user) return <Login />;

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', minHeight: '100dvh', pb: 9, position: 'relative' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/day/:date" element={<DayLog />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/body" element={<Body />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </Box>
  );
}
