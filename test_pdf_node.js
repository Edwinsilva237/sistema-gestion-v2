const express = require("express");
const router = express.Router();
const pdf = require("html-pdf-node");

router.get("/test-pdf-node", async (req, res) => {
  try {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 2rem; }
            h1 { color: green; text-align: center; }
            p { text-align: center; }
          </style>
        </head>
        <body>
          <h1>✅ ¡html-pdf-node está funcionando!</h1>
          <p>Este PDF fue generado sin navegador 🧾</p>
        </body>
      </html>
    `;

    const file = { content: html };
    const options = { format: "A4" };
    const pdfBuffer = await pdf.generatePdf(file, options);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=test-html-node.pdf"
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Error al generar PDF de prueba:", error);
    res.status(500).send("Error al generar el PDF.");
  }
  
});

module.exports = router;
