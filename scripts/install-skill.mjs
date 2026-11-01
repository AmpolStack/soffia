#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstaller } from '../skill/soffia/scripts/install-lib.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, '..', 'skill', 'soffia');

process.exitCode = runInstaller(skillDir, process.argv.slice(2));
