import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import type { Express } from 'express';
type Reply = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
};
class Cdp {
  seq = 0;
  pending = new Map<
    number,
    { resolve: (value: Record<string, unknown>) => void; reject: (e: Error) => void }
  >();
  onEvent: ((message: Reply) => void) | undefined;
  constructor(private socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as Reply;
      if (message.id) {
        const item = this.pending.get(message.id);
        if (!item) return;
        this.pending.delete(message.id);
        if (message.error) item.reject(new Error(message.error.message));
        else item.resolve(message.result ?? {});
      } else this.onEvent?.(message);
    });
  }
  send(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.seq;
    return new Promise<Record<string, unknown>>((done, reject) => {
      this.pending.set(id, { resolve: done, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression: string) {
    const raw = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (raw.exceptionDetails) throw new Error('Browser expression failed');
    return (raw.result as { value?: unknown })?.value;
  }
  async until(expression: string) {
    for (let i = 0; i < 100; i++) {
      if (await this.evaluate(expression)) return;
      await delay(100);
    }
    throw new Error('Browser condition timeout: ' + expression.slice(0, 100));
  }
  close() {
    this.socket.close();
  }
}
export async function runCommerceBrowser(input: {
  app: Express;
  origin: string;
  publicId: string;
  sessionId: string;
  refreshCookie: (role: 'customer' | 'staff') => Promise<string>;
  pay: () => Promise<string>;
  ticket: () => Promise<string>;
}) {
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  const web = resolve(repository, '../Fe/dist'),
    temporaryRoot = resolve(repository, 'tmp'),
    profile = resolve(temporaryRoot, `edge-commerce-${Date.now()}`);
  if (!profile.startsWith(temporaryRoot + sep)) throw new Error('Unsafe browser profile path');
  await mkdir(profile, { recursive: true });
  const host = createServer((req, res) => {
    if (req.url?.startsWith('/api/')) {
      input.app(req, res);
      return;
    }
    const pathname = new URL(req.url ?? '/', input.origin).pathname;
    const asset = pathname.startsWith('/assets/')
      ? resolve(web, '.' + pathname)
      : resolve(web, 'index.html');
    if (!asset.startsWith(web + sep)) {
      res.writeHead(404).end();
      return;
    }
    void readFile(asset)
      .then((bytes) => {
        res.setHeader(
          'Content-Type',
          extname(asset) === '.js'
            ? 'text/javascript'
            : extname(asset) === '.css'
              ? 'text/css'
              : 'text/html',
        );
        res.end(bytes);
      })
      .catch(() => res.writeHead(404).end());
  });
  await new Promise<void>((done, reject) => {
    host.once('error', reject);
    host.listen(Number(new URL(input.origin).port), '127.0.0.1', done);
  });
  const debugPort = Number(new URL(input.origin).port) + 1;
  const edge = spawn(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  let cdp: Cdp | undefined;
  try {
    let endpoint = '';
    for (let i = 0; i < 100; i++) {
      try {
        const pages = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as {
          type: string;
          webSocketDebuggerUrl: string;
        }[];
        endpoint = pages.find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? '';
        if (endpoint) break;
      } catch {
        /* browser starting */
      }
      await delay(100);
    }
    if (!endpoint) throw new Error('Test browser did not start');
    const socket = new WebSocket(endpoint);
    await new Promise<void>((done, reject) => {
      socket.addEventListener('open', () => done(), { once: true });
      socket.addEventListener('error', () => reject(new Error('CDP unavailable')), { once: true });
    });
    cdp = new Cdp(socket);
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    async function login(role: 'customer' | 'staff') {
      await cdp!.send('Network.clearBrowserCookies');
      await cdp!.send('Network.setCookie', {
        name: 'eventix.refresh',
        value: await input.refreshCookie(role),
        url: input.origin,
        path: '/api/v1/auth',
        httpOnly: true,
        sameSite: 'Lax',
      });
    }
    await login('customer');
    await cdp.send('Page.navigate', { url: `${input.origin}/events/${input.publicId}/book` });
    await cdp.until(
      "document.querySelectorAll('button[aria-pressed=false]:not([disabled])').length>=3",
    );
    await cdp.evaluate(
      "Array.from(document.querySelectorAll('button[aria-pressed=false]:not([disabled])')).slice(0,3).forEach(b=>b.click());true",
    );
    await cdp.until("document.querySelectorAll('main input').length===3");
    await cdp.evaluate(
      "Array.from(document.querySelectorAll('main input')).forEach((e,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Browser Person '+i);e.dispatchEvent(new Event('input',{bubbles:true}));});true",
    );
    await cdp.evaluate(
      "Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Giữ ghế và tiếp tục')).click();true",
    );
    await cdp.until(
      "location.pathname.startsWith('/checkout/')&&document.querySelectorAll('fieldset').length===3",
    );
    await cdp.evaluate(
      "Array.from(document.querySelectorAll('fieldset')).forEach((f,i)=>{const values=['Browser Person '+i,'1990-01-02','0901234567','00000000000'+i];Array.from(f.querySelectorAll('input')).forEach((e,j)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,values[j]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});});true",
    );
    let intercepted: Promise<void> | undefined;
    cdp.onEvent = (message) => {
      if (message.method === 'Fetch.requestPaused' && !intercepted) {
        const requestId = message.params?.requestId;
        intercepted = (async () => {
          const bookingId = await input.pay();
          await cdp!.send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 302,
            responseHeaders: [
              {
                name: 'Location',
                value: `${input.origin}/payments/return?bookingId=${bookingId}&status=PAID`,
              },
            ],
          });
        })();
      }
    };
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: 'https://pay.payos.vn/*', requestStage: 'Request' }],
    });
    await cdp.evaluate("document.querySelector('main button[type=submit]').click();true");
    await cdp.until("document.body.textContent.includes('Đặt vé thành công')");
    if (intercepted) await intercepted;
    await cdp.send('Fetch.disable');
    await cdp.send('Page.navigate', { url: input.origin + '/my-tickets' });
    await cdp.until(
      'document.querySelectorAll(\'img[alt="QR vé để kiểm tra tại cửa"]\').length===3',
    );
    const privateStorage = await cdp.evaluate(
      "[localStorage,sessionStorage].some(s=>Object.values(s).some(v=>v.includes('000000000000')||v.includes('EVX-')||v.includes('Browser Person')||v.startsWith('eyJ')))",
    );
    if (privateStorage) throw new Error('Credentials were written to browser storage');
    const code = await input.ticket();
    await login('staff');
    await cdp.send('Page.navigate', { url: input.origin + '/organizer/check-in' });
    await cdp.until(
      `!!document.querySelector('select option[value=${JSON.stringify(input.sessionId)}]')`,
    );
    await cdp.evaluate(
      `const s=document.querySelector('main select');s.value=${JSON.stringify(input.sessionId)};s.dispatchEvent(new Event('change',{bubbles:true}));true`,
    );
    await cdp.evaluate(
      `const e=document.querySelector('main form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(code)});e.dispatchEvent(new Event('input',{bubbles:true}));true`,
    );
    await cdp.evaluate("document.querySelector('main form button').click();true");
    await cdp.until("document.body.textContent.includes('Check-in tại quầy')");
    await cdp.evaluate(
      "Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Check-in tại quầy')).click();true",
    );
    await cdp.until("document.body.textContent.includes('Đã check-in. Cần đối chiếu')");
    await cdp.evaluate(
      "const inputs=document.querySelectorAll('main section form input');const values=['Browser Person 0','1990-01-02','000000000000'];Array.from(inputs).slice(0,3).forEach((e,i)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,values[i]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});inputs[3].click();true",
    );
    await cdp.evaluate("document.querySelector('main section form button').click();true");
    await cdp.until("document.body.textContent.includes('Đã xác minh và sử dụng vé')");
  } finally {
    try {
      if (cdp) await cdp.send('Browser.close');
    } catch {
      /* browser may have closed its transport */
    }
    cdp?.close();
    if (edge.exitCode === null)
      await new Promise<void>((done) => {
        edge.once('exit', () => done());
        setTimeout(() => {
          edge.kill();
          done();
        }, 2000);
      });
    await new Promise<void>((done, reject) =>
      host.close((error) => (error ? reject(error) : done())),
    );
    if (profile.startsWith(temporaryRoot + sep))
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
