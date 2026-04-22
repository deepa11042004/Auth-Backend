const { SESClient } = require('@aws-sdk/client-ses');
const env = require('./env');

const sesClient = new SESClient({
  region: env.sesRegion,
  credentials:
    env.awsAccessKey && env.awsSecretKey
      ? {
          accessKeyId: env.awsAccessKey,
          secretAccessKey: env.awsSecretKey,
        }
      : undefined,
});

module.exports = sesClient;
