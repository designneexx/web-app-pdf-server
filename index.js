const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
const fs = require('fs');
const AdmZip = require('adm-zip');
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const app = express();

const PORT = 3030;
const PDF_UPLOAD_DIR = `${__dirname}/pdf`
const credentials = PDFServicesSdk.Credentials
  .serviceAccountCredentialsBuilder()
  .fromFile('pdfservices-api-credentials.json')
  .build();
const executionContext = PDFServicesSdk.ExecutionContext.create(credentials);
const OUTPUT_ZIP = './ExtractTextInfoFromPDF.zip';

app.use(cors());
app.use(fileUpload());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/test', (req, res) => res.send('test'))

app.post('/parse-pdf', ({ files }, res) => {
  const pdf = files?.pdf;

  if (!pdf) return res.status(400).json('No files uploaded')

  if (fs.existsSync(OUTPUT_ZIP)) fs.unlinkSync(OUTPUT_ZIP);

  const path = `${PDF_UPLOAD_DIR}/${pdf.name}`;

  pdf.mv(path, err => {
    if(err) return res.status(500).json(err);

    const extractPDFOperation = PDFServicesSdk.ExtractPDF.Operation.createNew()
    const input = PDFServicesSdk.FileRef.createFromLocalFile(path, PDFServicesSdk.ExtractPDF.SupportedSourceFormat.pdf)
    const options = new PDFServicesSdk.ExtractPDF.options.ExtractPdfOptions.Builder()
      .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TEXT).build()

    extractPDFOperation.setInput(input);
    extractPDFOperation.setOptions(options);

    // Execute the operation
    extractPDFOperation.execute(executionContext)
      .then(result => result.saveAsFile(OUTPUT_ZIP))
      .then(() => {
        console.log('Successfully extracted information from PDF. Printing H1 Headers:\n');
        let zip = new AdmZip(OUTPUT_ZIP);
        let jsondata = zip.readAsText('structuredData.json');
        let data = JSON.parse(jsondata);

        res.json(data)

        console.log(parsePortfolioPdf(data))

        fs.unlinkSync(path);
      })
      .catch(err => console.log(err));
  })

})

app.listen(PORT, function () {
  console.log('CORS-enabled web server listening on port 80')
})

function parsePortfolioPdf(structuredData) {
  let portfolio = {}

  structuredData.elements.forEach(item => {
    const [document, section, ...content] = item.Path.split("/").filter(item => item)

    const sectionItems = portfolio[section] || [];

    portfolio[section] = [...sectionItems, item.Text]
  })

  console.log(portfolio)
}