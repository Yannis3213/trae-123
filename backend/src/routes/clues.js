import { Hono } from 'hono';
import { 
  getClueList, getClueDetail, processClue, processBatch,
  addAuditNote, getStatistics, getAbnormalLogs, getBatchResults
} from '../services/clueService.js';
import { isAllRoles, isAuditorOrReviewer } from '../middleware/auth.js';
import { ROLES } from '../config.js';

const clues = new Hono();

clues.get('/stats', isAllRoles(), async (c) => {
  const user = c.get('user');
  const stats = getStatistics(user);
  return c.json({ code: 200, data: stats });
});

clues.get('/', isAllRoles(), async (c) => {
  const user = c.get('user');
  const query = c.req.query();
  
  const filters = {
    status: query.status,
    priority: query.priority,
    clue_type: query.clue_type,
    keyword: query.keyword,
    expiryStatus: query.expiry_status
  };

  const list = getClueList(user, filters);
  return c.json({ code: 200, data: list });
});

clues.get('/:id', isAllRoles(), async (c) => {
  const user = c.get('user');
  const clueId = parseInt(c.req.param('id'));
  
  const detail = getClueDetail(clueId, user);
  
  if (!detail) {
    return c.json({ code: 404, message: '线索单不存在' }, 404);
  }
  
  if (detail.error) {
    return c.json({ code: detail.code, message: detail.error }, detail.code);
  }
  
  return c.json({ code: 200, data: detail });
});

clues.post('/:id/process', isAllRoles(), async (c) => {
  const user = c.get('user');
  const clueId = parseInt(c.req.param('id'));
  const actionData = await c.req.json();
  
  const result = processClue(clueId, actionData, user);
  
  if (!result.success) {
    return c.json({ code: result.code || 400, message: result.message }, result.code || 400);
  }
  
  return c.json({ code: 200, message: result.message, data: result.data });
});

clues.get('/batch/:batchNo', isAllRoles(), async (c) => {
  const batchNo = c.req.param('batchNo');
  const results = getBatchResults(batchNo);
  return c.json({ code: 200, data: results });
});

clues.post('/batch', isAllRoles(), async (c) => {
  const user = c.get('user');
  const { items, action } = await c.req.json();

  if (!items || items.length === 0) {
    return c.json({ code: 400, message: '请选择要批量处理的线索单' }, 400);
  }

  if (!action) {
    return c.json({ code: 400, message: '请指定批量操作类型' }, 400);
  }

  const result = processBatch(items, action, user);

  return c.json({ code: 200, message: '批量处理完成', data: result });
});

clues.post('/:id/audit-notes', isAuditorOrReviewer(), async (c) => {
  const user = c.get('user');
  const clueId = parseInt(c.req.param('id'));
  const { note } = await c.req.json();
  
  if (!note || !note.trim()) {
    return c.json({ code: 400, message: '备注内容不能为空' }, 400);
  }
  
  const result = addAuditNote(clueId, note, user);
  
  if (!result.success) {
    return c.json({ code: result.code || 400, message: result.message }, result.code || 400);
  }
  
  return c.json({ code: 200, message: result.message });
});

clues.get('/:id/abnormal-logs', isAllRoles(), async (c) => {
  const clueId = parseInt(c.req.param('id'));
  const logs = getAbnormalLogs(clueId);
  return c.json({ code: 200, data: logs });
});

clues.get('/config', isAllRoles(), async (c) => {
  const user = c.get('user');
  return c.json({
    code: 200,
    data: {
      roles: ROLES
    }
  });
});

export default clues;
