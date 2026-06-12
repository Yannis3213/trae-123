class AppError extends Error {
  constructor(message, statusCode = 400, exceptionType = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.exceptionType = exceptionType;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let exceptionType = err.exceptionType || null;
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    exceptionType = 'material';
    message = '参数验证失败';
    details = err.errors || {};
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    statusCode = 400;
    if (err.message.includes('UNIQUE')) {
      exceptionType = 'material';
      message = '数据重复，唯一约束冲突';
    } else if (err.message.includes('FOREIGN KEY')) {
      exceptionType = 'material';
      message = '关联数据不存在';
    }
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    exceptionType = 'permission';
    message = '无效的认证令牌';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    exceptionType = 'permission';
    message = '认证令牌已过期';
  }

  res.status(statusCode).json({
    success: false,
    message,
    exceptionType,
    details,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};

module.exports = {
  AppError,
  errorHandler
};
