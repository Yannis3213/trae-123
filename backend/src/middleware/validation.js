const { error } = require('../utils/response');

const validate = (schema, source = 'body') => {
  return async (ctx, next) => {
    const data = ctx.request[source] || ctx.query;
    if (!schema || typeof schema !== 'object') {
      await next();
      return;
    }
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`字段 '${field}' 必填`);
        continue;
      }
      if (value !== undefined && value !== null && value !== '') {
        if (rules.type && typeof value !== rules.type) {
          if (rules.type === 'number' && isNaN(Number(value))) {
            errors.push(`字段 '${field}' 必须是数字`);
          } else if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`字段 '${field}' 必须是字符串`);
          } else if (rules.type === 'object' && typeof value !== 'object') {
            errors.push(`字段 '${field}' 必须是对象`);
          } else if (rules.type === 'array' && !Array.isArray(value)) {
            errors.push(`字段 '${field}' 必须是数组`);
          }
        }
        if (rules.min !== undefined && Number(value) < rules.min) {
          errors.push(`字段 '${field}' 最小值为 ${rules.min}`);
        }
        if (rules.max !== undefined && Number(value) > rules.max) {
          errors.push(`字段 '${field}' 最大值为 ${rules.max}`);
        }
        if (rules.minLength !== undefined && String(value).length < rules.minLength) {
          errors.push(`字段 '${field}' 最小长度为 ${rules.minLength}`);
        }
        if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
          errors.push(`字段 '${field}' 最大长度为 ${rules.maxLength}`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`字段 '${field}' 值必须为 [${rules.enum.join(', ')}] 之一`);
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
          errors.push(`字段 '${field}' 格式不正确`);
        }
      }
    }
    if (errors.length > 0) {
      error(ctx, '参数校验失败', 400, { errors });
      return;
    }
    await next();
  };
};

module.exports = { validate };
