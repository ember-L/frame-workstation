const fs = require('node:fs/promises');
const path = require('node:path');

async function isSourcePath(source, destination) {
  const sourcePath = await fs.realpath(source);
  const destinationPath = path.join(await fs.realpath(path.dirname(destination)), path.basename(destination));
  const sourceEntry = path.join(await fs.realpath(path.dirname(source)), path.basename(source));
  if (sourcePath === destinationPath || sourceEntry === destinationPath) return true;
  try {
    const [sourceStat, destinationStat] = await Promise.all([fs.stat(source), fs.stat(destination)]);
    return sourceStat.dev === destinationStat.dev && sourceStat.ino === destinationStat.ino;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = { isSourcePath };
