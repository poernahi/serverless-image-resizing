'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;
const TEST_URL = process.env.TEST_URL;
const URL = process.env.URL;
const ORIGINAL_PATH = process.env.ORIGINAL_PATH;

const IMAGE_SIZES = {
  'medium': [180, 240],
  'large': [450, 600],
  'default': [768, 1024]
};

exports.handler = function(event, context, callback) {
  const test = event.queryStringParameters.test;
  const key = event.queryStringParameters.key;
  const match = key.match(/images\/((.*)_([^_]+)|[^_]+).jpg/);
  //const match = key.match(/(\d+)x(\d+)\/(.*)/);
  //const width = parseInt(match[1], 10);
  //const height = parseInt(match[2], 10);
  //const originalKey = match[3];
  const baseKey  = match[2] || match[1];
  const modifier = match[3] || 'default';
  const width  = IMAGE_SIZES[modifier][0];
  const height = IMAGE_SIZES[modifier][1];

  S3.getObject({Bucket: BUCKET, Key: ORIGINAL_PATH + baseKey + ".jpg"}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat('jpeg')
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        CacheControl: 'max-age=86400',
        ContentType: 'image/jpeg',
        Key: key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': test ? `${TEST_URL}/${key}` : `${URL}/${key}?resized=true`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
