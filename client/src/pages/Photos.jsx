import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Stack, Button, IconButton, TextField,
  MenuItem, Collapse, CircularProgress, Chip, ToggleButton, ImageList, ImageListItem,
  ImageListItemBar, Dialog, DialogContent,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CompareIcon from '@mui/icons-material/Compare';
import { api } from '../api.js';
import { todayISO, prettyDate } from '../utils/dates.js';

const POSES = ['front', 'side', 'back', 'other'];

export default function Photos() {
  const fileRef = useRef();
  const [photos, setPhotos] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [meta, setMeta] = useState({ date: todayISO(), pose: 'front', note: '' });
  const [uploading, setUploading] = useState(false);
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  const load = () => api.getPhotos().then(setPhotos);
  useEffect(() => { load().catch(() => setPhotos([])); }, []);

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setShowForm(true);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      await api.addPhoto({ file, ...meta });
      setFile(null); setPreview(''); setMeta({ date: todayISO(), pose: 'front', note: '' });
      setShowForm(false);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    await api.deletePhoto(id);
    setSelected((s) => s.filter((x) => x !== id));
    await load();
  }

  function onTile(p) {
    if (compare) {
      setSelected((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id].slice(-2));
    } else {
      setLightbox(p);
    }
  }

  if (!photos) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80dvh' }}><CircularProgress /></Box>;
  }

  const comparePair = selected.map((id) => photos.find((p) => p.id === id)).filter(Boolean);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Photos</Typography>
        <Stack direction="row" spacing={1}>
          <ToggleButton
            size="small" value="compare" selected={compare}
            onChange={() => { setCompare((c) => !c); setSelected([]); }}
          >
            <CompareIcon fontSize="small" sx={{ mr: 0.5 }} /> Compare
          </ToggleButton>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
          <Button variant="contained" startIcon={<AddPhotoAlternateIcon />} onClick={() => fileRef.current?.click()}>
            Add
          </Button>
        </Stack>
      </Stack>

      {/* Upload form */}
      <Collapse in={showForm}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={2}>
              {preview && <Box component="img" src={preview} alt="preview" sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 2 }} />}
              <TextField type="date" label="Date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField select label="Pose" value={meta.pose} onChange={(e) => setMeta({ ...meta, pose: e.target.value })} fullWidth>
                {POSES.map((p) => <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>{p}</MenuItem>)}
              </TextField>
              <TextField label="Note (optional)" value={meta.note} onChange={(e) => setMeta({ ...meta, note: e.target.value })} fullWidth />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={upload} disabled={uploading} fullWidth>
                  {uploading ? <CircularProgress size={22} color="inherit" /> : 'Upload'}
                </Button>
                <Button onClick={() => { setShowForm(false); setFile(null); setPreview(''); }}>Cancel</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>

      {/* Compare panel */}
      {compare && (
        <Card sx={{ mb: 2, bgcolor: 'background.default' }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Select two photos to compare
            </Typography>
            {comparePair.length === 0 && <Typography variant="body2" color="text.secondary">None selected yet.</Typography>}
            <Stack direction="row" spacing={1}>
              {comparePair.map((p) => (
                <Box key={p.id} sx={{ flex: 1 }}>
                  <Box component="img" src={api.photoSrc(p.url)} alt={p.pose} sx={{ width: '100%', borderRadius: 2, aspectRatio: '3/4', objectFit: 'cover' }} />
                  <Typography variant="caption" color="text.secondary">{prettyDate(p.date)} · {p.pose}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Gallery */}
      {photos.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 5 }}>
          No progress photos yet. Tap <b>Add</b> to upload your first one.
        </Typography>
      ) : (
        <ImageList cols={2} gap={10}>
          {photos.map((p) => {
            const idx = selected.indexOf(p.id);
            return (
              <ImageListItem
                key={p.id}
                onClick={() => onTile(p)}
                sx={{
                  cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                  outline: idx > -1 ? '3px solid' : 'none', outlineColor: 'primary.main',
                }}
              >
                <Box component="img" src={api.photoSrc(p.url)} alt={p.pose} loading="lazy" sx={{ aspectRatio: '3/4', objectFit: 'cover' }} />
                <ImageListItemBar
                  title={prettyDate(p.date)}
                  subtitle={<Box sx={{ textTransform: 'capitalize' }}>{p.pose}{p.note ? ` · ${p.note}` : ''}</Box>}
                  actionIcon={
                    !compare && (
                      <IconButton sx={{ color: '#fff' }} onClick={(e) => { e.stopPropagation(); remove(p.id); }} aria-label="delete">
                        <DeleteOutlineIcon />
                      </IconButton>
                    )
                  }
                />
                {idx > -1 && <Chip size="small" color="primary" label={idx + 1} sx={{ position: 'absolute', top: 8, left: 8 }} />}
              </ImageListItem>
            );
          })}
        </ImageList>
      )}

      {/* Lightbox */}
      <Dialog open={Boolean(lightbox)} onClose={() => setLightbox(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          {lightbox && <Box component="img" src={api.photoSrc(lightbox.url)} alt={lightbox.pose} sx={{ width: '100%', display: 'block' }} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
