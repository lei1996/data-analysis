export default {
  server:
    process.env.Server ||
    (process.env.NODE_ENV === 'development'
      ? '//localhost:7777'
      : '/'),
};
