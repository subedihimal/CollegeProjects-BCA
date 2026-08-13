import path from 'path';
import express from 'express';
import multer from 'multer';

const router = express.Router();
const isVercel = Boolean(process.env.VERCEL);

const getFilename = (file) =>
  `${file.fieldname}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`;

const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, getFilename(file));
  },
});

function fileFilter(req, file, cb) {
  const filetypes = /jpe?g|png|webp/;
  const mimetypes = /image\/jpe?g|image\/png|image\/webp/;

  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Images only!'), false);
  }
}

const upload = multer({
  storage: isVercel ? multer.memoryStorage() : diskStorage,
  fileFilter,
  // Vercel has request/response size limits. A smaller cap also keeps the data
  // URI written to MongoDB from making product documents excessively large.
  limits: { fileSize: (isVercel ? 1 : 4) * 1024 * 1024 },
});

const uploadSingleImage = upload.single('image');

router.post('/', (req, res, next) => {
  uploadSingleImage(req, res, async (error) => {
    if (error) {
      return res.status(400).send({ message: error.message });
    }

    if (!req.file) {
      return res.status(400).send({ message: 'Please select an image' });
    }

    try {
      if (isVercel) {
        return res.status(200).send({
          message: 'Image uploaded successfully',
          image: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        });
      }

      return res.status(200).send({
        message: 'Image uploaded successfully',
        image: `/${req.file.path.replaceAll('\\', '/')}`,
      });
    } catch (uploadError) {
      return next(uploadError);
    }
  });
});

export default router;
