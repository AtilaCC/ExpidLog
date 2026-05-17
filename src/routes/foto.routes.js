// ══════════════════════════════════════════════════════
// DOCKCHECK PRO — Foto Routes (Cloudinary upload)
// ══════════════════════════════════════════════════════

const router     = require('express').Router();
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { query }  = require('../database/connection');
const { authenticate, authorizeMin } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// ─── Cloudinary config ────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer: memory storage (stream to Cloudinary) ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only images are allowed'));
    }
    cb(null, true);
  }
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

router.use(authenticate);

// POST /api/fotos/upload
router.post('/upload', authorizeMin('conferente'), upload.single('foto'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { operacao_id, tipo = 'evidencia', descricao } = req.body;

    const result = await uploadToCloudinary(req.file.buffer, {
      folder:         `dockcheck/${req.empresaId}`,
      transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }],
      resource_type:  'image',
    });

    const { rows: [foto] } = await query(`
      INSERT INTO fotos (empresa_id, operacao_id, uploader_id, tipo, url, url_thumb, public_id, nome_arquivo, tamanho_bytes, mime_type, descricao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      req.empresaId,
      operacao_id || null,
      req.user.id,
      tipo,
      result.secure_url,
      result.secure_url.replace('/upload/', '/upload/w_400,h_300,c_fill/'),
      result.public_id,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      descricao || null
    ]);

    logger.info(`Photo uploaded: ${result.public_id}`);
    res.status(201).json({ data: foto });
  } catch (err) {
    if (err.message === 'Only images are allowed') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/fotos?operacao_id=xxx
router.get('/', async (req, res, next) => {
  try {
    const { operacao_id, tipo } = req.query;
    const conds = ['f.empresa_id = $1'];
    const params = [req.empresaId];
    if (operacao_id) { params.push(operacao_id); conds.push(`f.operacao_id = $${params.length}`); }
    if (tipo)        { params.push(tipo);         conds.push(`f.tipo = $${params.length}`); }

    const { rows } = await query(`
      SELECT f.*, u.nome AS uploader_nome
      FROM fotos f
      LEFT JOIN users u ON u.id = f.uploader_id
      WHERE ${conds.join(' AND ')}
      ORDER BY f.created_at DESC
      LIMIT 100
    `, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) { next(err); }
});

// DELETE /api/fotos/:id
router.delete('/:id', authorizeMin('supervisor'), async (req, res, next) => {
  try {
    const { rows: [foto] } = await query(
      'SELECT * FROM fotos WHERE id = $1 AND empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!foto) return res.status(404).json({ error: 'Foto not found' });

    if (foto.public_id) {
      await cloudinary.uploader.destroy(foto.public_id).catch(() => {});
    }
    await query('DELETE FROM fotos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Foto deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
