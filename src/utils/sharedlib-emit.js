const os = require('os');
const fs = require('graceful-fs');
const glob = require('glob');
const path = require('path');

let sharedlibGlob;
switch (os.platform()) {
  case 'darwin':
    sharedlibGlob = '/**/*.@(dylib|so?(.*))';
  break;
  case 'win32':
    sharedlibGlob = '/**/*.dll';
  break;
  default:
    sharedlibGlob = '/**/*.so?(.*)';
}

// helper for emitting the associated shared libraries when a binary is emitted
module.exports = async function (pkgPath, assetState, assetBase, emitFile) {
  const files = await new Promise((resolve, reject) =>
    glob(pkgPath + sharedlibGlob, { ignore: 'node_modules/**/*' }, (err, files) => err ? reject(err) : resolve(files))
  );
  await Promise.all(files.map(async file => {
    const [source, stats] = await Promise.all([
      new Promise((resolve, reject) =>
        fs.readFile(file, (err, source) => err ? reject(err) : resolve(source))
      ),
      await new Promise((resolve, reject) => 
        fs.lstat(file, (err, stats) => err ? reject(err) : resolve(stats))
      )
    ]);
    assetState.assetPermissions[file.substr(pkgPath.length)] = stats.mode;
    if (stats.isSymbolicLink()) {
      const symlink = await new Promise((resolve, reject) => {
        fs.readlink(file, (err, path) => err ? reject(err) : resolve(path));
      });
      const baseDir = path.dirname(file);
      assetState.assetSymlinks[file.substr(pkgPath.length + 1)] = path.relative(baseDir, path.resolve(baseDir, symlink));
    }
    else {
      emitFile(assetBase + file.substr(pkgPath.length), source);
    }
  }));
};