import { spawn, type ChildProcess } from 'node:child_process';
type Spec = { name: string; args: string[] };
export class ProcessSupervisor {
  private stopping = false;
  private started = false;
  private readonly children = new Map<string, ChildProcess>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly failures = new Map<string, number[]>();
  constructor(
    private readonly specs: Spec[],
    private readonly cwd: string,
    private readonly report: (name: string, code: string) => void,
    private readonly restartDelayMs = 1000,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}
  start() {
    if (this.started || this.stopping) throw new Error('Supervisor already started/stopped');
    if (new Set(this.specs.map((spec) => spec.name)).size !== this.specs.length)
      throw new Error('Duplicate supervised process names');
    this.started = true;
    for (const spec of this.specs) this.launch(spec);
  }
  private launch(spec: Spec) {
    if (this.stopping) return;
    const child = spawn(process.execPath, spec.args, {
      cwd: this.cwd,
      env: { ...this.environment, SUPERVISED_PROCESS: 'true' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    this.children.set(spec.name, child);
    child.on('error', () => this.report(spec.name, 'PROCESS_START_FAILED'));
    child.once('exit', () => {
      if (this.children.get(spec.name) === child) this.children.delete(spec.name);
      if (this.stopping) return;
      const recent = (this.failures.get(spec.name) ?? []).filter(
        (time) => Date.now() - time < 60000,
      );
      recent.push(Date.now());
      this.failures.set(spec.name, recent);
      if (recent.length >= 5) {
        this.report(spec.name, 'RESTART_LIMIT_REACHED');
        void this.stop();
        return;
      }
      this.report(spec.name, 'PROCESS_RESTARTING');
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.launch(spec);
      }, this.restartDelayMs);
      this.timers.add(timer);
    });
  }
  async stop() {
    this.stopping = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.all(
      [...this.children.values()].map(
        (child) =>
          new Promise<void>((done) => {
            if (child.exitCode !== null) {
              done();
              return;
            }
            const deadline = setTimeout(() => child.kill('SIGTERM'), 10000);
            deadline.unref();
            child.once('exit', () => {
              clearTimeout(deadline);
              done();
            });
            if (child.connected) child.send('shutdown', () => {});
            else child.kill('SIGTERM');
          }),
      ),
    );
  }
}
