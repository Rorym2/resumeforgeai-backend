const express = require('express');
const supabase = require('../lib/supabase');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, HeadingLevel, TabStopType, TabStopLeader,
} = require('docx');

const router = express.Router();

// GET /documents
// Returns all generations for the logged-in user, newest first
router.get('/', async (req, res) => {
  console.log(`[documents] Fetching document list for user: ${req.user.id}`);
  const { data, error } = await supabase
    .from('generations')
    .select('id, job_text, job_analysis, match_score, duration_seconds, created_at, resume_id')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[documents] Fetch error:', error.message, { user: req.user.id });
    return res.status(500).json({ error: 'Failed to fetch documents.', detail: error.message });
  }

  console.log(`[documents] Returned ${data.length} documents for user: ${req.user.id}`);
  return res.json({
    success: true,
    count: data.length,
    documents: data,
  });
});

// GET /documents/:id
// Returns a single generation with full content
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id) // ensure users can only fetch their own documents
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  return res.json({
    success: true,
    document: data,
  });
});

// ─── Word doc builder helpers ─────────────────────────────────────────────

function s(val) {
  return (val && val !== 'undefined' && val !== 'null') ? String(val) : '';
}

function fmtDates(item) {
  if (s(item.dates)) return item.dates;
  const start = s(item.start_date), end = s(item.end_date);
  if (start && end) return `${start} – ${end}`;
  return start || '';
}

const FONT = 'Times New Roman';
const BORDER_BOTTOM = {
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    border: BORDER_BOTTOM,
    children: [new TextRun({ text, bold: true, size: 22, font: FONT, allCaps: true })],
  });
}

function entryHeader(org, dates) {
  return new Paragraph({
    spacing: { before: 100, after: 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: TabStopLeader.NONE }],
    children: [
      new TextRun({ text: org, bold: true, size: 22, font: FONT }),
      new TextRun({ text: '\t' + dates, size: 20, font: FONT }),
    ],
  });
}

function entryTitle(title) {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: title, italics: true, size: 22, font: FONT })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}

function buildResumeDoc(resume) {
  const r = resume || {};
  const children = [];

  // Name
  if (r.contact?.name) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: s(r.contact.name), bold: true, size: 32, font: FONT })],
    }));
  }

  // Contact line
  const contactParts = [r.contact?.email, r.contact?.phone, r.contact?.location].filter(s);
  if (contactParts.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      border: BORDER_BOTTOM,
      children: [new TextRun({ text: contactParts.join('  |  '), size: 20, font: FONT })],
    }));
  }

  // Summary
  if (r.summary) {
    children.push(sectionHeader('Summary'));
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: s(r.summary), size: 22, font: FONT })],
    }));
  }

  // Experience
  const experience = r.experience || r.work_experience || [];
  if (experience.length) {
    children.push(sectionHeader('Experience'));
    experience.forEach(job => {
      const org = s(job.company || job.organization);
      const title = s(job.title || job.role);
      const dates = fmtDates(job);
      if (org) children.push(entryHeader(org, dates));
      if (title) children.push(entryTitle(title));
      (job.bullets || job.responsibilities || []).forEach(b => children.push(bullet(s(b))));
    });
  }

  // Skills
  const skills = r.skills;
  if (skills) {
    const allSkills = Array.isArray(skills)
      ? skills
      : [...(skills.technical || []), ...(skills.languages || []), ...(skills.other || [])];
    if (allSkills.length) {
      children.push(sectionHeader('Skills'));
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: allSkills.map(s).join(' · '), size: 22, font: FONT })],
      }));
    }
  }

  // Education
  const education = r.education || [];
  if (education.length) {
    children.push(sectionHeader('Education'));
    education.forEach(e => {
      const institution = s(e.institution || e.school);
      const degree = s(e.degree || e.field);
      const dates = fmtDates(e) || s(e.graduation_date);
      if (institution) children.push(entryHeader(institution, dates));
      if (degree) children.push(entryTitle(degree));
    });
  }

  // Leadership
  const leadership = r.leadership_activities || r.leadership || [];
  if (leadership.length) {
    children.push(sectionHeader('Leadership & Activities'));
    leadership.forEach(item => {
      const org = s(item.organization);
      const role = s(item.role || item.title);
      const dates = fmtDates(item);
      if (org) children.push(entryHeader(org, dates));
      if (role) children.push(entryTitle(role));
      (item.bullets || []).forEach(b => children.push(bullet(s(b))));
    });
  }

  return new Document({
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
  });
}

function buildCoverLetterDoc(coverLetter, contactName) {
  const text = typeof coverLetter === 'string'
    ? coverLetter
    : coverLetter?.body || coverLetter?.text || '';

  const children = [];

  if (contactName) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      border: BORDER_BOTTOM,
      children: [new TextRun({ text: s(contactName), bold: true, size: 32, font: FONT })],
    }));
  }

  text.split(/\n{2,}/).filter(Boolean).forEach(para => {
    children.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: para.trim(), size: 22, font: FONT })],
    }));
  });

  return new Document({
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
  });
}

// POST /documents/export
// Body: { type: 'resume' | 'cover_letter', optimized_resume?, cover_letter? }
router.post('/export', async (req, res) => {
  const { type, optimized_resume, cover_letter } = req.body;

  if (!type || !['resume', 'cover_letter'].includes(type)) {
    return res.status(400).json({ error: 'type must be "resume" or "cover_letter"' });
  }

  try {
    const contactName = optimized_resume?.contact?.name || null;
    const doc = type === 'resume'
      ? buildResumeDoc(optimized_resume)
      : buildCoverLetterDoc(cover_letter, contactName);

    const buffer = await Packer.toBuffer(doc);
    const filename = type === 'resume' ? 'Resume.docx' : 'CoverLetter.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[export] Word doc generation failed:', err.message);
    res.status(500).json({ error: 'Failed to generate document.' });
  }
});

module.exports = router;
