module.exports = {
  success(ctx, data = null, message = 'success') {
    ctx.body = {
      code: 0,
      data,
      message
    };
  },
  error(ctx, message = 'error', code = 1, data = null) {
    ctx.body = {
      code,
      data,
      message
    };
  }
};
