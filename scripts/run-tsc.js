#!/usr/bin/env node
const { spawnSync } = require('node:child_process')

const result = spawnSync('pnpm', ['exec', 'tsc', '--noEmit'], {
  stdio: 'inherit',
})

process.exit(result.status === null ? 1 : result.status)
