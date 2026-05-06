const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const PDFParser = require('pdf2json');
const path = require('path');
const supabase = require('../lib/supabase');

const router = express.Router();

// Use memory storage — no filesystem dependency, works on ephemeral hosts like Railway
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only PDF and DOCX files are allowed'));
  },
});

// Extract text from a DOCX buffer
async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Extract text from a PDF buffer
function extractPdf(buffer) {
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
    pdfParser.parseBuffer(buffer);
  });
}

// POST /upload/resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a PDF or DOCX as form-data with key "resume".' });
  }

  const buffer = req.file.buffer;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let text;
    if (ext === '.docx') {
      text = await extractDocx(buffer);
    } else if (ext === '.pdf') {
      text = await extractPdf(buffer);
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'Could not extract text from the file. Make sure it is not a scanned image PDF.' });
    }

    // Save the resume text to Supabase linked to the logged-in user
    const { data: resume, error } = await supabase
      .from('resumes')
      .insert({
        user_id: req.user.id,
        filename: req.file.originalname,
        text_content: text.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save resume.', detail: error.message });
    }

    return res.json({
      success: true,
      resume_id: resume.id,
      filename: resume.filename,
      text: resume.text_content,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to process file.', detail: err.message });
  }
});

module.exports = router;
