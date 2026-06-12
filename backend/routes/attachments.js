const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('../middleware/errorHandler');
const { requireAuth, requireAssigneeOrRole } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1000);
    const ext = path.extname(file.originalname);
    cb(null, `attach_${ts}_${rand}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', requireAuth, upload.single('file'), (req, res, next) => {
  try {
    const { visit_order_id, category } = req.body;
    if (!visit_order_id) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw new AppError('缺少就诊单ID', 400, 'material');
    }
    if (!category) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw new AppError('缺少附件分类', 400, 'material');
    }
    if (!req.file) {
      throw new AppError('请选择要上传的文件', 400, 'material');
    }

    const validCategories = ['pet_profile', 'appointment', 'diagnosis', 'treatment', 'follow_up', 'other'];
    if (!validCategories.includes(category)) {
      fs.unlinkSync(req.file.path);
      throw new AppError(`附件分类必须是以下之一: ${validCategories.join(', ')}`, 400, 'material');
    }

    const stmt = req.db.prepare(`
      INSERT INTO attachments (visit_order_id, filename, original_name, file_type, file_size, category, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Number(visit_order_id),
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      category,
      req.user.id
    );

    const attachment = req.db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      data: attachment,
      message: '附件上传成功'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const att = req.db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) {
      throw new AppError('附件不存在', 404, 'material');
    }

    const filePath = path.join(uploadDir, att.filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('附件文件不存在', 404, 'material');
    }

    res.download(filePath, att.original_name);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAssigneeOrRole('director', 'nurse'), (req, res, next) => {
  try {
    const att = req.db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) {
      throw new AppError('附件不存在', 404, 'material');
    }

    const filePath = path.join(uploadDir, att.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    req.db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: '附件删除成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
