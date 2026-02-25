import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, 'uploads/'); 
  },
  filename: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});

// NEW: Add file filter to accept specific types
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, ZIP, and video files are allowed.'), false);
  }
};

// UPDATE: Add fileFilter and limits
const upload = multer({ 
  storage,
  fileFilter,  // NEW: Add this
  limits: {    // NEW: Add this
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos and zip files
  }
});

export default upload;