const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Block .gradle and fsevents directories on Windows to prevent path errors
config.resolver = {
  ...config.resolver,
  blockList: [
    /node_modules[\\/].*[\\/]\.gradle[\\/].*/,
    /node_modules[\\/]fsevents[\\/].*/,
  ],
};

module.exports = config;
