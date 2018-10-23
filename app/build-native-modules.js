const os = require('os')
const { exec } = require('child_process')

// Build the native modules on Windows platform only
// NOTE: This will only affect our own native modules (defined in `binding.gyp`); native
// modules included in `package.json` will be built based on their own settings.
if (os.platform() === 'win32') {
  exec('node-gyp rebuild', err => {
    if (err) {
      console.log('Error installing the native dependencies: ' + err)
    }
  })
}
