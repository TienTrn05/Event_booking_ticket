import { expect, it } from 'vitest';
import { ProcessSupervisor } from '../src/shared/workers/process-supervisor.js';
it('restarts crashed children within a fixed budget and shuts down its remaining child via IPC', async () => {
  const reports: string[] = [];
  const supervisor = new ProcessSupervisor(
    [
      { name: 'fixture-crash', args: ['-e', 'process.exit(1)'] },
      {
        name: 'fixture-alive',
        args: [
          '-e',
          "process.on('message',m=>{if(m==='shutdown')process.exit(0)});setInterval(()=>{},100)",
        ],
      },
    ],
    process.cwd(),
    (_name, code) => reports.push(code),
    10,
  );
  supervisor.start();
  try {
    const deadline = Date.now() + 8000;
    while (!reports.includes('RESTART_LIMIT_REACHED') && Date.now() < deadline)
      await new Promise((done) => setTimeout(done, 20));
    expect(reports.filter((code) => code === 'PROCESS_RESTARTING')).toHaveLength(4);
    expect(reports).toContain('RESTART_LIMIT_REACHED');
  } finally {
    await supervisor.stop();
  }
}, 10000);
