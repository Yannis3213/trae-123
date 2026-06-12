const { AppError } = require('./errorHandler');

const validate = (rules) => {
  return (req, res, next) => {
    const errors = {};
    const data = { ...req.query, ...req.params, ...req.body };

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      const fieldErrors = [];

      if (rule.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(`${field} 为必填项`);
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rule.type && typeof value !== rule.type) {
          if (rule.type === 'integer') {
            if (!Number.isInteger(Number(value))) {
              fieldErrors.push(`${field} 必须是整数`);
            }
          } else if (rule.type === 'number') {
            if (isNaN(Number(value))) {
              fieldErrors.push(`${field} 必须是数字`);
            }
          } else if (typeof value !== rule.type) {
            fieldErrors.push(`${field} 必须是 ${rule.type} 类型`);
          }
        }

        if (rule.min !== undefined && Number(value) < rule.min) {
          fieldErrors.push(`${field} 最小值为 ${rule.min}`);
        }

        if (rule.max !== undefined && Number(value) > rule.max) {
          fieldErrors.push(`${field} 最大值为 ${rule.max}`);
        }

        if (rule.minLength !== undefined && String(value).length < rule.minLength) {
          fieldErrors.push(`${field} 最小长度为 ${rule.minLength}`);
        }

        if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
          fieldErrors.push(`${field} 最大长度为 ${rule.maxLength}`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          fieldErrors.push(`${field} 必须是以下值之一: ${rule.enum.join(', ')}`);
        }

        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          fieldErrors.push(`${field} 格式不正确`);
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
      }
    }

    if (Object.keys(errors).length > 0) {
      const err = new AppError('参数验证失败', 400, 'material', errors);
      return next(err);
    }

    next();
  };
};

module.exports = { validate };
