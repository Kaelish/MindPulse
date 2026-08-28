const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  fs.mkdirSync(path.join(__dirname, '..', 'node_modules', 'fsevents'), {
    recursive: true,
  });
}