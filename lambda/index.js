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
  'default': [840, 1120]
};

exports.handler = function(event, context, callback) {
  let test = false;
  let modifier = 'default';
  let key;
  let baseKey;

  if (event.queryStringParameters) {
    test = event.queryStringParameters.test;
    key = event.queryStringParameters.key;
    const match = key.match(/images\/((.*)_([^_]+)|[^_]+)\.jpg/);
    key = match[0];
    baseKey  = match[2] || match[1];
    modifier = match[3] || modifier;
  } else {
    key = event.Records && event.Records[0].s3.object.key;
    const match = key.match(/original\/(.+)\.jpg/);
    baseKey = match[1];
    key = `images/${baseKey}.jpg`;
  }

  const width  = IMAGE_SIZES[modifier][0];
  const height = IMAGE_SIZES[modifier][1];

  S3.getObject({Bucket: BUCKET, Key: ORIGINAL_PATH + baseKey + ".jpg"}).promise()
    .then(function(data) {
      console.log(`Fetched ${baseKey} from S3`);
      const image = Sharp(data.Body);
      image
        .metadata()
        .then(function(metadata) {
          console.log('Metadata: height=' + metadata.height + ', width=' + metadata.width);
          return image
            .rotate(metadata.height >= metadata.width ? 0 : 90)
            .resize(width, height)
            .toFormat('jpeg')
            .toBuffer();
        })
        .then(buffer => S3.putObject({
          Body: buffer,
          Bucket: BUCKET,
          CacheControl: 'max-age=86400',
          ContentType: 'image/jpeg',
          Key: key,
        }).promise())
        .then(() => callback(null, {
          statusCode: '301',
          headers: {'location': test ? `${TEST_URL}/${key}` : `${URL}/${key}?resized=true`},
          body: '',
        }))
        .catch(err => callback(err))
    })
    .catch(err => callback(err))
}
