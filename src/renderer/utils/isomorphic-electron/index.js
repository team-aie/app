let imports;
if (process.type === 'renderer' || process.type === 'worker') {
  imports = require('@electron/remote');
} else {
  imports = require('electron');
}

module.exports = imports;
