try {
  const response = await fetch('http://127.0.0.1:3000/api/v1/health/ready', {
    signal: AbortSignal.timeout(8000),
  });
  if (response.status !== 200) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
export {};
