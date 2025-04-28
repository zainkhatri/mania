const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add resolve alias for browser-image-compression
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'browser-image-compression': path.resolve(__dirname, 'node_modules/browser-image-compression/dist/browser-image-compression.js'),
      };
      return webpackConfig;
    },
  },
}; 