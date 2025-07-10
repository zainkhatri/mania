const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add resolve alias for browser-image-compression
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'browser-image-compression': path.resolve(__dirname, 'node_modules/browser-image-compression/dist/browser-image-compression.js'),
      };

      // Silence source map warnings from react-datepicker
      if (webpackConfig.ignoreWarnings) {
        // Webpack 5 approach
        webpackConfig.ignoreWarnings = [
          ...webpackConfig.ignoreWarnings,
          // Ignore warnings about missing source maps in react-datepicker
          function ignoreSourcemapsloaderWarnings(warning) {
            return (
              warning.module &&
              warning.module.resource &&
              warning.module.resource.includes('react-datepicker') &&
              warning.message.includes('Failed to parse source map')
            );
          },
        ];
      } else {
        // Older approach - modify stats settings
        webpackConfig.stats = webpackConfig.stats || {};
        webpackConfig.stats.warningsFilter = [/Failed to parse source map/];
      }
      
      return webpackConfig;
    },
  },
}; 