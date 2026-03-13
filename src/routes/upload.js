const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const PDFParser = require('pdf2json');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Store uploaded files temporarily in the /uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only PDF and DOCX files are allowed'));
  },
});

// Extract text from a DOCX file
async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// Extract text from a PDF file
function extractPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', err => reject(err.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const text = pdfData.Pages.map(page =>
        page.Texts.map(t => {
          try { return decodeURIComponent(t.R.map(r => r.T).join('')); }
          catch { return t.R.map(r => r.T).join(''); }
        }).join(' ')
      ).join('\n');
      resolve(text);
    });
    pdfParser.loadPDF(filePath);
  });
}

// POST /upload/resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a PDF or DOCX as form-data with key "resume".' });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let text;
    if (ext === '.docx') {
      text = await extractDocx(filePath);
    } else if (ext === '.pdf') {
      text = await extractPdf(filePath);
    }

    // Clean up the temp file after extraction
    fs.unlinkSync(filePath);

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'Could not extract text from the file. Make sure it is not a scanned image PDF.' });
    }

    return res.json({
      success: true,
      filename: req.file.originalname,
      text: text.trim(),
    });
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to process file.', detail: err.message });
  }
});

module.exports = router;
