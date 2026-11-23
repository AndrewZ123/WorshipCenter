import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentryMock);

const CONFIG_MODULES = [
  { name: 'server', path: '../sentry.server.config' },
  { name: 'edge', path: '../sentry.edge.config' },
  { name: 'client', path: '../instrumentation-client' },
] as const;

const BLANK_DSNS = [
  { name: 'unset', value: undefined },
  { name: 'empty', value: '' },
  { name: 'whitespace', value: '   \t\n' },
] as const;

function setSentryEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    return;
  }

  vi.stubEnv('SENTRY_DSN', value);
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', value);
}

async function importFresh(path: string) {
  vi.resetModules();
  return import(path);
}

beforeEach(() => {
  sentryMock.init.mockClear();
  sentryMock.captureRequestError.mockClear();
  sentryMock.captureRouterTransitionStart.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

describe.each(CONFIG_MODULES)('$name Sentry init', ({ path }) => {
  it.each(BLANK_DSNS)('is a no-op when the DSN is $name', async ({ value }) => {
    setSentryEnv(value);

    await importFresh(path);

    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('initializes with errors only and no default PII when a DSN is set', async () => {
    const dsn = `https://dummy-key@example.invalid/${path.length}`;
    setSentryEnv(dsn);

    await importFresh(path);

    expect(sentryMock.init).toHaveBeenCalledTimes(1);
    expect(sentryMock.init).toHaveBeenCalledWith({
      dsn,
      tracesSampleRate: 0,
      dataCollection: { userInfo: false },
    });
  });
});

describe('instrumentation onRequestError', () => {
  it('forwards nothing when the DSN is unset', async () => {
    setSentryEnv(undefined);

    const { onRequestError } = await importFresh('../instrumentation');
    onRequestError(new Error('test error') as never, {} as never, {} as never);

    expect(sentryMock.captureRequestError).not.toHaveBeenCalled();
  });

  it('forwards nothing when the DSN is whitespace', async () => {
    setSentryEnv('  ');

    const { onRequestError } = await importFresh('../instrumentation');
    onRequestError(new Error('test error') as never, {} as never, {} as never);

    expect(sentryMock.captureRequestError).not.toHaveBeenCalled();
  });

  it('forwards the request error when a DSN is set', async () => {
    setSentryEnv('https://dummy-key@example.invalid/1');

    const { onRequestError } = await importFresh('../instrumentation');
    const error = new Error('test error');
    onRequestError(error as never, {} as never, {} as never);

    expect(sentryMock.captureRequestError).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureRequestError).toHaveBeenCalledWith(error, {}, {});
  });
});
