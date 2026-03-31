const sharp = require('sharp');

const DEFAULT_MAX_WIDTH = 800;

async function processImageToWebp(buffer, { maxWidth = DEFAULT_MAX_WIDTH } = {}) {
  if (!buffer) {
    return null;
  }

  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: 70, effort: 4 })
      .toBuffer();
  } catch (err) {
    const wrapped = new Error('Invalid image file. Upload jpg, jpeg, png, or webp.');
    wrapped.code = 'IMAGE_PROCESSING_FAILED';
    throw wrapped;
  }
}

module.exports = {
  DEFAULT_MAX_WIDTH,
  processImageToWebp,
};
