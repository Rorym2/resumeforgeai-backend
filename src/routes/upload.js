const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const supabase = require('../lib/supabase');

const router = express.Router();

// Write uploads to /tmp — always available on Railway (ephemeral is fine, we read immediately)
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
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

// Extract text from a PDF buffer using pdf-parse for reliable text extraction from PDFs
async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text;
}

// POST /upload/resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a PDF or DOCX as form-data with key "resume".' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  console.log(`[upload] File received: ${req.file.originalname}, size: ${req.file.size}, path: ${req.file.path}`);

  let buffer;
  try {
    buffer = fs.readFileSync(req.file.path);
  } catch (err) {
    console.error('[upload] Failed to read temp file:', err.message);
    return res.status(500).json({ error: 'Failed to read uploaded file.', detail: err.message });
  } finally {
    // Always clean up the temp file
    try { fs.unlinkSync(req.file.path); } catch {}
  }

  try {
    let text;
    if (ext === '.docx') {
      text = await extractDocx(buffer);
    } else if (ext === '.pdf') {
      text = await extractPdf(buffer);
    } else {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(422).json({ error: 'Could not extract text from the file. Make sure it is not a scanned image PDF.' });
    }

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
    console.error('[upload] Processing error:', err.message);
    return res.status(500).json({ error: 'Failed to process file.', detail: err.message });
  }
});

module.exports = router;
