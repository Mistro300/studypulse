type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    ...context,
  };

  if (level === 'error') {
    console.error('[StudyPulse]', payload);
  } else if (level === 'warn') {
    console.warn('[StudyPulse]', payload);
  } else if (import.meta.env.DEV) {
    console.info('[StudyPulse]', payload);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
