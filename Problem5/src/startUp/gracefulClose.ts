let shuttingDown = false;

export default (...fnArg: any[]) => {
  console.log('Graceful shutdown initiated...');

  async function shutdown(signal:string) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}, shutting down...`);

    const forceTimeout = setTimeout(() => {
      console.error('Force exit: shutdown timeout');
      process.exit(1);
    }, 20000);
    forceTimeout.unref?.();

    try {
      for (const fn of fnArg) {
        if (fn && typeof fn.shutdown === 'function') {
          await fn.shutdown();
        }
      }
      clearTimeout(forceTimeout);
      process.exit(0);
    } catch (err) {
      console.error('Shutdown error:', err);
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err);
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    shutdown('uncaughtException');
  });
}