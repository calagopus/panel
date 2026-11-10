import { system } from '@rjweb/utils';
import * as fs from 'node:fs';
import logger from '@/globals/logger.ts';

export default function getVersion() {
  return `${JSON.parse(fs.readFileSync('../package.json', 'utf8')).version}:${system.execute('git rev-parse --short=10 HEAD').trim()}`;
}

logger()
  .text('Panel Database', (c) => c.yellowBright)
  .text(`(${process.env.NODE_ENV === 'development' ? 'development' : 'production'} ${getVersion()})`, (c) => c.gray)
  .info();
logger()
  .text('This is not meant to be ran directly, this only provides the database schema', (c) => c.red)
  .info();
