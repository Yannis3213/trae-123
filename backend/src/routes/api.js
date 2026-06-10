const express = require('express');
const { roleAuth } = require('../middleware/auth');
const {
  getWorkorders,
  getWorkorderDetail,
  createWorkorder,
  scheduleProduction,
  issueMaterial,
  reportCompletion,
  submitForReview,
  reviewApprove,
  reviewReject,
  factoryConfirm,
  addAuditNote
} = require('../controllers/workorderController');

const {
  batchSubmitForReview,
  batchReview,
  batchFactoryConfirm
} = require('../controllers/batchController');

const {
  getStatistics,
  getWarningList,
  getNodeStatistics
} = require('../controllers/statisticsController');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

router.get('/workorders', roleAuth(), getWorkorders);
router.get('/workorders/:id', roleAuth(), getWorkorderDetail);
router.post('/workorders', roleAuth(), createWorkorder);

router.post('/workorders/:id/schedule', roleAuth(), scheduleProduction);
router.post('/workorders/:id/material', roleAuth(), issueMaterial);
router.post('/workorders/:id/completion', roleAuth(), reportCompletion);
router.post('/workorders/:id/submit', roleAuth(), submitForReview);
router.post('/workorders/:id/review/approve', roleAuth(), reviewApprove);
router.post('/workorders/:id/review/reject', roleAuth(), reviewReject);
router.post('/workorders/:id/confirm', roleAuth(), factoryConfirm);
router.post('/workorders/:id/notes', roleAuth(), addAuditNote);

router.post('/batch/submit', roleAuth(), batchSubmitForReview);
router.post('/batch/review', roleAuth(), batchReview);
router.post('/batch/confirm', roleAuth(), batchFactoryConfirm);

router.get('/statistics', roleAuth(), getStatistics);
router.get('/warnings', roleAuth(), getWarningList);
router.get('/node-stats', roleAuth(), getNodeStatistics);

module.exports = router;
