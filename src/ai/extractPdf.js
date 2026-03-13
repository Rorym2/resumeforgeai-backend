const PDFParser = require('pdf2json');
const fs = require('fs');

const filePath = process.argv[2];

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', err => {
  console.error(err.parserError);
  process.exit(1);
});

pdfParser.on('pdfParser_dataReady', pdfData => {
  const text = pdfData.Pages.map(page =>
    page.Texts.map(t => {
      try { return decodeURIComponent(t.R.map(r => r.T).join('')); }
      catch { return t.R.map(r => r.T).join(''); }
    }).join(' ')
  ).join('\n');
  console.log(text);
});

pdfParser.loadPDF(filePath);
