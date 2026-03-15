import pino, { type LoggerOptions as PinoLoggerOptions } from 'pino';

export interface LoggerOptions {
  name: string;
  level?: string;
  pretty?: boolean;
}

export function createLoggerConfig(options: LoggerOptions): PinoLoggerOptions {
  const { name, level, pretty } = options;

  return {
    name,
    level: level ?? process.env.LOG_LEVEL ?? 'info',
    ...(pretty || process.env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  };
}

export function createLogger(options: LoggerOptions): pino.Logger {
  return pino(createLoggerConfig(options));
}
