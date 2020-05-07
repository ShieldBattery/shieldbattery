require('@babel/register')({
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { electron: '7.1' },
        useBuiltIns: 'usage',
        corejs: 3,
      },
    ],
  ],

  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-function-bind'],
  ],
})

require('startup.js')
