'use strict';

module.exports = (config) => {
  config.externals = [...config.externals, 'react', 'react-dom'];
  return config;
};
