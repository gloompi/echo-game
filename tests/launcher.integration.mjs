import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

test(
  'sharing refuses missing, loopback and unsafe UDP endpoint configuration before launching services',
  { timeout: 10000 },
  async () => {
    for (const endpoint of [
      '',
      'https://127.0.0.1:4433/echo',
      'http://udp.example/echo',
      'https://udp.example/echo?key=secret',
    ]) {
      const child = spawn(process.execPath, [resolve('scripts/play.mjs'), '--share'], {
        env: { ...process.env, ECHO_WT_PUBLIC_URL: endpoint },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });
      assert.notEqual(code, 0);
      assert.match(output, /Sharing requires ECHO_WT_PUBLIC_URL/);
      assert.doesNotMatch(output, /LOCAL PLAY:|FRONTEND INVITE:/);
    }
  },
);

test(
  'share launcher registers public URL, prints keyed invites and stops children (mock services)',
  { skip: process.platform === 'win32', timeout: 10000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'echo-launcher-'));
    const allocator = createServer();
    await new Promise((resolve) => allocator.listen(0, '127.0.0.1', resolve));
    const port = allocator.address().port;
    await new Promise((resolve) => allocator.close(resolve));
    const binary = join(dir, 'echo-server');
    await writeFile(
      binary,
      `#!/usr/bin/env node\nconst http=require('node:http');let publicUrl=null;const s=http.createServer((q,r)=>{if(q.url==='/health'){r.end(JSON.stringify({ok:true,server:'rust',protocolVersion:3,transport:"webtransport"}));}else if(q.url==='/api/public-url'){if(q.headers['x-echo-control']!==process.env.ECHO_CONTROL_TOKEN){r.statusCode=403;r.end();return;}let b='';q.on('data',c=>b+=c);q.on('end',()=>{publicUrl=JSON.parse(b).url;r.statusCode=204;r.end();});}else{r.end(JSON.stringify({publicUrl}));}});s.listen(Number(process.env.PORT),'127.0.0.1');process.on('SIGTERM',()=>s.close(()=>process.exit()));\n`,
      { mode: 0o755 },
    );
    await writeFile(
      join(dir, 'cloudflared'),
      `#!/usr/bin/env node\nif(process.argv.includes('--version')){console.log('mock cloudflared');process.exit();}console.log('https://echo-mock.trycloudflare.com');setInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit());\n`,
      { mode: 0o755 },
    );
    const child = spawn(process.execPath, [resolve('scripts/play.mjs'), '--share'], {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        PORT: String(port),
        ECHO_SERVER_BIN: binary,
        ECHO_ACCESS_KEY: '',
        ECHO_WT_PUBLIC_URL: 'https://udp.example:4433/echo',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (c) => {
      output += c;
    });
    child.stderr.on('data', (c) => {
      output += c;
    });
    try {
      for (let i = 0; i < 100 && !output.includes('FRONTEND INVITE:'); i++) await sleep(30);
      assert.match(
        output,
        /FRONTEND INVITE: https:\/\/echo-mock\.trycloudflare\.com\/#key=[a-f0-9]{48}/,
      );
      assert.match(output, new RegExp(`LOCAL PLAY: http://127\\.0\\.0\\.1:${port}/#key=`));
      const config = await (await fetch(`http://127.0.0.1:${port}/api/config`)).json();
      assert.equal(config.publicUrl, 'https://echo-mock.trycloudflare.com');
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
      await assert.rejects(
        fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(300) }),
      );
    } finally {
      child.kill('SIGKILL');
      await rm(dir, { recursive: true, force: true });
    }
  },
);
