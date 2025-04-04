
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const QRCode = require('qrcode'); // Librería para generar QR
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const qrcode = require("qrcode"); // ✅ Importar el módulo QR
const getStream = require("get-stream");
const moment = require("moment");
const pdf = require("html-pdf-node");




const cloudinary = require("cloudinary").v2;
const { PassThrough } = require("stream");


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});




const JWT_SECRET = process.env.JWT_SECRET || "secreto_seguro"; // 🔒 Clave secreta para los tokens
console.log("🔐 JWT_SECRET usado en el backend:", process.env.JWT_SECRET);
console.log("🔐 JWT_SECRET cargado:", JWT_SECRET);


const app = express();
app.use(express.json());
app.use(express.static('public'));

app.use(require("./test_pdf_node"));


function verificarToken(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(403).json({ error: "Acceso denegado" });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido" });
        req.usuario = decoded;
        next();
    });
}


// 🔒 Restringir CORS a dominios permitidos
const corsOptions = {
    origin: process.env.ALLOWED_ORIGIN || 'https://appgh-2z0e.onrender.com',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// ✅ Verificar y crear carpetas necesarias al iniciar el servidor
const pdfDir = path.join(__dirname, 'public');
const fontsDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

// ✅ Configurar base de datos con variables de entorno
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'  // ✅ Asegura que la conexión use UTF-8 correctamente
});
db.getConnection()
    .then(() => console.log("✅ Conexión a la base de datos exitosa"))
    .catch(err => console.error("❌ Error al conectar a la base de datos:", err));


// 🔄 Función para verificar la conexión y reintentar si falla
async function checkDBConnection() {
    try {
        const connection = await db.getConnection();
        console.log("✅ Conexión a MySQL establecida");
        connection.release();
    } catch (err) {
        console.error("❌ Error de conexión a MySQL", err);
        setTimeout(checkDBConnection, 5000); // Reintentar en 5 segundos
    }
}
checkDBConnection();


// ✅ Agregar una venta
app.post('/ventas', async (req, res) => {
    try {
        const { cliente, fecha, monto, folio } = req.body;

        if (!cliente || !fecha || !monto || !folio) {
            return res.status(400).json({ error: "Todos los campos son obligatorios" });
        }

        const [result] = await db.query(
            "INSERT INTO ventas (cliente, fecha, monto, folio) VALUES (?, ?, ?, ?)", 
            [cliente, fecha, monto, folio]
        );

        res.json({ message: "✅ Venta agregada con éxito", insertId: result.insertId });
    } catch (error) {
        console.error("❌ Error en POST /ventas:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ✅ Obtener todas las ventas con saldos correctos
app.get('/ventas', async (req, res) => {
    try {
        const query = `
            SELECT v.id, v.cliente, v.fecha, 
                   v.monto AS saldo_inicial, 
                   (v.monto - COALESCE(SUM(a.monto), 0)) AS saldo_actual, 
                   v.folio, v.estado
            FROM ventas v
            LEFT JOIN abonos a ON v.id = a.venta_id
            GROUP BY v.id, v.cliente, v.fecha, v.monto, v.folio, v.estado
            ORDER BY v.fecha DESC;
        `;

        const [result] = await db.query(query);
        res.json(result);
    } catch (error) {
        console.error("❌ Error en GET /ventas:", error);
        res.status(500).json({ error: "Error al obtener las ventas" });
    }
});

// ✅ 🚀 Código agregado: Obtener una venta específica con su historial de abonos
app.get('/ventas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ventaId = parseInt(id, 10);
        if (isNaN(ventaId)) {
            return res.status(400).json({ error: "ID de venta inválido" });
        }

        // ✅ Obtener la venta
        const [venta] = await db.query("SELECT * FROM ventas WHERE id = ?", [ventaId]);
        if (venta.length === 0) {
            return res.status(404).json({ error: "Venta no encontrada" });
        }

        // ✅ Obtener los abonos de la venta
        const [abonos] = await db.query(
            "SELECT id, fecha, monto FROM abonos WHERE venta_id = ? ORDER BY fecha ASC",
            [ventaId]
        );

        res.json({ venta: venta[0], abonos });
    } catch (error) {
        console.error("❌ Error en GET /ventas/:id:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});
// ✅ Obtener abonos por ID de venta (incluyendo recibo_url)
app.get('/abonos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ventaId = parseInt(id, 10);
        if (isNaN(ventaId)) {
            return res.status(400).json({ error: "ID de venta inválido" });
        }

        const [abonos] = await db.query(
            `SELECT 
                id, 
                fecha, 
                CAST(monto AS DECIMAL(10,2)) AS monto, 
                recibo_url 
             FROM abonos 
             WHERE venta_id = ? 
             ORDER BY fecha ASC`,
            [ventaId]
        );

        const abonosConvertidos = abonos.map(abono => ({
            ...abono,
            monto: parseFloat(abono.monto),
            recibo_url: abono.recibo_url || null
        }));

        res.json(abonosConvertidos);
    } catch (error) {
        console.error("❌ Error en GET /abonos/:id:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


// ✅ Editar una venta
app.put('/ventas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente, fecha, monto, folio } = req.body;

        await db.query(
            "UPDATE ventas SET cliente = ?, fecha = ?, monto = ?, folio = ? WHERE id = ?",
            [cliente, fecha, monto, folio, id]
        );

        res.json({ message: "✅ Venta actualizada con éxito" });
    } catch (error) {
        console.error("❌ Error en PUT /ventas/:id:", error);
        res.status(500).json({ error: "Error al actualizar la venta" });
    }
});

// ✅ Cancelar una venta
app.put('/ventas/:id/cancelar', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("UPDATE ventas SET estado = 'Cancelada' WHERE id = ?", [id]);
        res.json({ message: "✅ Venta cancelada con éxito" });
    } catch (error) {
        console.error("❌ Error en PUT /ventas/:id/cancelar:", error);
        res.status(500).json({ error: "Error al cancelar la venta" });
    }
});

app.put("/abonos/:id", async (req, res) => {
  const { id } = req.params;
  const { monto, recibo_url } = req.body;

  try {
    if (recibo_url) {
      // ✅ Actualizar solo la URL del recibo
      await db.query("UPDATE abonos SET recibo_url = ? WHERE id = ?", [recibo_url, id]);
      return res.json({ message: "✅ URL del recibo actualizada correctamente." });
    }

    if (monto) {
      // ✅ Actualizar monto si viene (caso más general)
      await db.query("UPDATE abonos SET monto = ? WHERE id = ?", [monto, id]);
      return res.json({ message: "✅ Monto del abono actualizado correctamente." });
    }

    res.status(400).json({ error: "❌ No se recibió ningún dato válido para actualizar." });

  } catch (error) {
    console.error("❌ Error al actualizar abono:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

app.delete('/abonos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = "DELETE FROM abonos WHERE id = ?";
        db.query(query, [id], (err, result) => {
            if (err) {
                console.error("❌ Error en la base de datos:", err);
                return res.status(500).json({ error: "Error al eliminar el abono" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Abono no encontrado" });
            }

            res.json({ message: "✅ Abono eliminado correctamente" });
        });
    } catch (error) {
        console.error("❌ Error en DELETE /abonos/:id:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ✅ Eliminar una venta
app.delete('/ventas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM abonos WHERE venta_id = ?", [id]);
        await db.query("DELETE FROM ventas WHERE id = ?", [id]);
                res.json({ message: "✅ Venta eliminada con éxito" });
    } catch (error) {
        console.error("❌ Error en DELETE /ventas/:id:", error);
        res.status(500).json({ error: "Error al eliminar la venta" });
    }
});

// 🔧 FUNCION AUXILIAR: obtener datos de la venta
async function obtenerDatosVenta(ventaId) {
  const [resultado] = await db.query(
    "SELECT cliente, folio FROM ventas WHERE id = ?",
    [ventaId]
  );
  return resultado[0] || {};
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}


app.post("/abonos", async (req, res) => {
  const { venta_id, fecha, monto } = req.body;

  if (!venta_id || !fecha || !monto) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    // 1️⃣ Insertar el abono
    const [result] = await db.query(
      "INSERT INTO abonos (venta_id, fecha, monto) VALUES (?, ?, ?)",
      [venta_id, fecha, monto]
    );

    const abonoId = result.insertId;

    // 2️⃣ Obtener datos de la venta para generar el recibo
    const [ventaRes] = await db.query(
      "SELECT cliente, folio, monto AS saldoInicial FROM ventas WHERE id = ?",
      [venta_id]
    );
    const venta = ventaRes[0];
    const saldoRestante = parseFloat(venta.saldoInicial) - parseFloat(monto);

    // 3️⃣ Preparar URL predecible
    const reciboURL = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/recibos/Recibo_Abono_${abonoId}.pdf`;

    // 4️⃣ Generar y subir el PDF
    const urlFinal = await generarReciboPDFconQR({
      abonoId,
      cliente: venta.cliente,
      folio: venta.folio,
      fecha,
      monto,
      saldoInicial: venta.saldoInicial,
      saldoRestante,
      reciboURL
    });

    // 5️⃣ Guardar la URL final en la base de datos
    await db.query(
      "UPDATE abonos SET recibo_url = ? WHERE id = ?",
      [urlFinal, abonoId]
    );

    res.json({
      message: "✅ Abono registrado y recibo generado",
      recibo_url: urlFinal,
      id: abonoId
    });

  } catch (error) {
    console.error("❌ Error al registrar abono:", error);
    res.status(500).json({ error: "Error interno del servidor al registrar abono." });
  }
});

async function generarReciboPDFconQR(datos) {
  const { abonoId, cliente, folio, fecha, monto, saldoInicial, saldoRestante, reciboURL } = datos;

  const qrBase64 = await QRCode.toDataURL(reciboURL);

  const templatePath = path.join(__dirname, "plantillas", "recibo.html");
  let html = fs.readFileSync(templatePath, "utf-8");

  html = html.replace("{{cliente}}", cliente)
             .replace("{{folio}}", folio)
             .replace("{{fecha}}", new Date(fecha).toLocaleDateString("es-MX"))
             .replace("{{monto}}", parseFloat(monto).toFixed(2))
             .replace("{{saldoInicial}}", parseFloat(saldoInicial).toFixed(2))
             .replace("{{saldoRestante}}", parseFloat(saldoRestante).toFixed(2))
             .replace("{{qrBase64}}", qrBase64);

  const file = { content: html };
  const options = { format: "A4" };
  const pdfBuffer = await pdf.generatePdf(file, options);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "raw",
      public_id: `recibos/Recibo_Abono_${abonoId}`,
      folder: "recibos",
      format: "pdf",
      overwrite: true
    }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });

    stream.end(pdfBuffer);
  });
}

module.exports = { generarReciboPDFconQR };
app.get("/abono/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const [abonos] = await db.query("SELECT recibo_url FROM abonos WHERE id = ?", [id]);
      if (!abonos.length) return res.status(404).json({ error: "Abono no encontrado." });
      res.json({ recibo_url: abonos[0].recibo_url });
  } catch (error) {
      res.status(500).json({ error: "Error al obtener el recibo del abono." });
  }
});


app.get("/generar-estado-cuenta/:cliente?", async (req, res) => {
    try {
        const { cliente } = req.params;
        let query;
        let params = [];

        if (cliente) {
            query = `
                SELECT cliente, folio, fecha, COALESCE(monto, 0) AS saldo_inicial,
                       COALESCE((monto - COALESCE((SELECT SUM(monto) FROM abonos WHERE abonos.venta_id = ventas.id), 0)), 0) AS saldo_pendiente
                FROM ventas WHERE cliente = ? ORDER BY fecha`;
            params.push(cliente);
        } else {
            query = `
                SELECT cliente, folio, fecha, COALESCE(monto, 0) AS saldo_inicial,
                       COALESCE((monto - COALESCE((SELECT SUM(monto) FROM abonos WHERE abonos.venta_id = ventas.id), 0)), 0) AS saldo_pendiente
                FROM ventas ORDER BY cliente, fecha`;
        }

        const [ventas] = await db.query(query, params);

        if (ventas.length === 0) {
            return res.status(404).json({ error: "No se encontraron ventas." });
        }

        const doc = new PDFDocument({ margin: 50 });
        const filePath = path.join(__dirname, `public/Estado_Cuenta_${cliente || 'Todos'}.pdf`);
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        let totalSaldoPendienteGeneral = 0;
        let totalSaldoInicialGeneral = 0;
        let clientesProcesados = new Set();

        ventas.forEach((venta, index) => {
            if (!clientesProcesados.has(venta.cliente)) {
                if (clientesProcesados.size > 0) {
                    doc.addPage();
                }
                clientesProcesados.add(venta.cliente);
                doc.image("public/logo.png", 50, 60, { width: 80 })
                   .fontSize(22)
                   .fillColor("#333")
                   .text("ESTADO DE CUENTA", 200, 100, { align: "center" })
                   .moveDown(2);

                doc.fontSize(14).fillColor("#000").text(venta.cliente.toUpperCase(), 400, 140, { align: "right" }).moveDown();

                doc.fillColor("#FFF").rect(50, 160, 500, 25).fill("#4CAF50").stroke();
                doc.fillColor("#FFF").fontSize(12);
                doc.text("Folio", 55, 167, { width: 80, align: "left" })
                   .text("Fecha", 150, 167, { width: 100, align: "center" })
                   .text("Saldo Inicial", 280, 167, { width: 110, align: "right" })
                   .text("Saldo Pendiente", 420, 167, { width: 100, align: "right" });
            }

            const saldoInicial = parseFloat(venta.saldo_inicial) || 0;
            const saldoPendiente = parseFloat(venta.saldo_pendiente) || 0;
            totalSaldoPendienteGeneral += saldoPendiente;
            totalSaldoInicialGeneral += saldoInicial;
            
            const fechaFormateada = new Date(venta.fecha).toISOString().split('T')[0].replace(/-/g, '/');

            let y = doc.y + 20;
            doc.fillColor("#000").fontSize(10);
            doc.text(venta.folio.toString(), 55, y, { width: 80, align: "left" })
               .text(fechaFormateada, 150, y, { width: 100, align: "center" })
               .text(`$${saldoInicial.toFixed(2)}`, 280, y, { width: 110, align: "right" })
               .text(`$${saldoPendiente.toFixed(2)}`, 420, y, { width: 100, align: "right" });
            doc.y = y + 10;
            
            if (index === ventas.length - 1 || ventas[index + 1].cliente !== venta.cliente) {
                doc.moveDown(1);
                doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
                doc.fontSize(12).fillColor("#4CAF50").text("TOTAL CLIENTE", 55, doc.y + 5, { width: 300, align: "left" })
                   .fillColor("#000").text(`$${totalSaldoInicialGeneral.toFixed(2)}`, 280, doc.y + 5, { width: 110, align: "right" })
                   .fillColor("#000").text(`$${totalSaldoPendienteGeneral.toFixed(2)}`, 420, doc.y + 5, { width: 100, align: "right" });
            }
        });

        doc.addPage();
        doc.moveTo(50, 100).lineTo(550, 100).stroke();
        doc.fontSize(12).fillColor("#4CAF50").text("TOTAL GENERAL", 55, 110, { width: 300, align: "left" })
           .fillColor("#000").text(`$${totalSaldoInicialGeneral.toFixed(2)}`, 280, 110, { width: 110, align: "right" })
           .fillColor("#000").text(`$${totalSaldoPendienteGeneral.toFixed(2)}`, 420, 110, { width: 100, align: "right" });

        doc.moveDown(3).fontSize(12).fillColor("#4CAF50").text("Gracias por su preferencia.", 200, 160, { align: "center" });

        doc.end();
        writeStream.on("finish", () => {
            res.download(filePath);
        });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.get('/clientes', async (req, res) => {
    try {
        const [clientes] = await db.query("SELECT DISTINCT cliente FROM ventas");
        res.json(clientes);
    } catch (error) {
        console.error("❌ Error al obtener clientes:", error);
        res.status(500).json({ error: "Error al obtener la lista de clientes." });
    }
});

app.get("/obtener-estado-cuenta/:cliente", async (req, res) => {
    try {
        const cliente = req.params.cliente;
        const query = `SELECT folio, fecha, monto AS saldo_inicial, 
                       (monto - COALESCE((SELECT SUM(monto) FROM abonos WHERE venta_id = ventas.id), 0)) 
                       AS saldo_pendiente FROM ventas WHERE cliente = ? HAVING saldo_pendiente > 0;`;
        const [ventas] = await db.query(query, [cliente]);

        if (!ventas.length) {
            return res.status(404).json({ error: `No hay ventas pendientes para ${cliente}.` });
        }

        const totalSaldoPendiente = ventas.reduce((acc, v) => acc + v.saldo_pendiente, 0);
        res.json({ ventas, totalSaldoPendiente });
    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({ error: "Error al obtener estado de cuenta" });
    }
});

app.get("/obtener-clientes", async (req, res) => {
    try {
        const query = "SELECT DISTINCT cliente FROM ventas";
        const [clientes] = await db.query(query);

        if (!clientes.length) {
            return res.status(404).json({ error: "No hay clientes disponibles." });
        }

        res.json(clientes.map(c => c.cliente));
    } catch (error) {
        console.error("❌ Error al obtener clientes:", error);
        res.status(500).json({ error: "Error al obtener la lista de clientes." });
    }
});

/////////////////////////////////FUNCIONES////////////////////////////////////
/////////////////////////////PARA PRODUCCION////////////////////////////////////7

// 📌 Ruta para validar QR y generar token
app.get("/login-qr", async (req, res) => {
    try {
        const { usuario } = req.query;
        if (!usuario) {
            return res.status(400).json({ error: "Usuario no proporcionado" });
        }

        const [rows] = await db.query("SELECT id, rol FROM usuarios WHERE usuario = ?", [usuario]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const user = rows[0];
        const token = jwt.sign({ id: user.id, usuario, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: "2h" });

        res.json({ token, usuario, rol: user.rol });
    } catch (error) {
        console.error("❌ Error en GET /login-qr:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ✅ Ruta para login
app.post("/login", async (req, res) => {
    try {
        const { usuario, password } = req.body;

        console.log("🔍 Datos recibidos en el backend:", { usuario, password });

        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
        if (usuarios.length === 0) {
            console.log("❌ Usuario no encontrado:", usuario);
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        const user = usuarios[0];
        console.log("🔍 Usuario encontrado en BD:", user);
        console.log("🔍 Contraseña ingresada:", password);
        console.log("🔍 Contraseña almacenada en BD:", user.password);

        const validPassword = await bcrypt.compare(password, user.password);
        console.log("🔍 Resultado de bcrypt.compare:", validPassword);

        if (!validPassword) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: "2h" });

        console.log("✅ Login exitoso, generando token:", token);

        res.json({ 
          acceso: true,
          token,
          rol: user.rol,
          id: user.id,           // ✅ nuevo: ID del usuario
          usuario: user.usuario  // opcional: el nombre
      });
      
    } catch (error) {
        console.error("❌ Error en POST /login:", error);
        res.status(500).json({ error: "Error en el servidor", detalle: error.message });
    }
    
});


app.get("/bitacora", verificarToken, async (req, res) => {
    try {
        const [registros] = await db.query("SELECT * FROM produccion ORDER BY fecha DESC");
        res.json(registros);
    } catch (error) {
        console.error("❌ Error al obtener bitácora:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});
//VALIDAR ENTRADA DEL CHECADOR
async function tieneTurnoActivo(usuarioId) {
    try {
        const [resultado] = await db.query(`
            SELECT fecha_hora FROM checador 
            WHERE usuario_id = ? AND tipo = 'entrada'
            ORDER BY fecha_hora DESC
            LIMIT 1
        `, [usuarioId]);

        if (!resultado.length) return false;

        const entrada = new Date(resultado[0].fecha_hora);
        const ahora = new Date();
        const horas = (ahora - entrada) / (1000 * 60 * 60);

        return horas <= 10;
    } catch (error) {
        console.error("❌ Error al verificar turno activo:", error);
        return false; // Por seguridad, asumimos que no tiene turno activo
    }
}

// 📌 Guardar producción
app.post("/produccion", verificarToken, async (req, res) => {
    try {
        const { usuario, turno, peso, medida, tipoPlastico } = req.body;

        if (!usuario || !turno || !peso || !medida || !tipoPlastico) {
            return res.status(400).json({ error: "Todos los campos son obligatorios" });
        }

        // Buscar ID del usuario
        const [usuarioData] = await db.query("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);
        if (!usuarioData.length) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const usuarioId = usuarioData[0].id;

        // 🛡️ Validar turno activo usando helper
        const activo = await tieneTurnoActivo(usuarioId);
        if (!activo) {
            return res.status(403).json({ error: "No tienes un turno activo. Registra tu entrada primero." });
        }

        // Guardar producción
        await db.query(
            "INSERT INTO produccion (usuario_id, turno, peso, medida, tipo_plastico, fecha_hora) VALUES (?, ?, ?, ?, ?, NOW())",
            [usuarioId, turno, peso, medida, tipoPlastico]
        );

        res.json({ message: "✅ Producción registrada con éxito" });
    } catch (error) {
        console.error("❌ Error en POST /produccion:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 📌 Obtener registros de producción
app.get("/produccion", verificarToken, async (req, res) => {
    const { id: usuarioId, rol } = req.usuario;

    try {
      let query = `
    SELECT 
        produccion.usuario_id,
        produccion.peso,
        produccion.medida,
        produccion.tipo_plastico AS tipoPlastico,
        produccion.fecha_hora AS fecha,
        usuarios.usuario
    FROM produccion
    JOIN usuarios ON produccion.usuario_id = usuarios.id
`;

  
        let params = [];

        if (rol === "produccion") {
            // 🔍 Buscar última entrada del usuario
            const [ultimaEntrada] = await db.query(`
                SELECT fecha_hora FROM checador 
                WHERE usuario_id = ? AND tipo = 'entrada'
                ORDER BY fecha_hora DESC
                LIMIT 1
            `, [usuarioId]);

            if (!ultimaEntrada.length) {
                return res.status(404).json({ error: "No se encontró una entrada registrada para este usuario." });
            }

            const entrada = new Date(ultimaEntrada[0].fecha_hora);
            const salidaEstimada = new Date(entrada.getTime() + 10 * 60 * 60 * 1000); // +10h

            query += ` WHERE produccion.usuario_id = ? AND produccion.fecha_hora BETWEEN ? AND ?`;
            params = [usuarioId, entrada, salidaEstimada];
        }

        // ✅ Ordenar por fecha más reciente primero
        query += ` ORDER BY produccion.fecha_hora DESC`;

        const [result] = await db.query(query, params);
        res.json(result);

    } catch (error) {
        console.error("❌ Error en GET /produccion:", error);
        res.status(500).json({ error: "Error al obtener datos de producción" });
    }
});
app.get("/resumen-activos", verificarToken, async (req, res) => {
    const { rol } = req.usuario;

    if (rol !== "admin") {
        return res.status(403).json({ error: "Acceso denegado" });
    }

    try {
        // Buscar usuarios con entrada activa
        const [entradasActivas] = await db.query(`
            SELECT c.usuario_id, u.usuario, c.fecha_hora AS entrada
            FROM checador c
            JOIN usuarios u ON u.id = c.usuario_id
            WHERE c.tipo = 'entrada'
              AND c.fecha_hora >= NOW() - INTERVAL 10 HOUR
              AND NOT EXISTS (
                  SELECT 1 FROM checador s
                  WHERE s.usuario_id = c.usuario_id
                    AND s.tipo = 'salida'
                    AND s.fecha_hora > c.fecha_hora
              )
        `);

        const resumen = [];

        for (const entrada of entradasActivas) {
            const desde = new Date(entrada.entrada);
            const hasta = new Date(desde.getTime() + 10 * 60 * 60 * 1000); // +10h

            const [produccion] = await db.query(`
                SELECT peso, medida
                FROM produccion
                WHERE usuario_id = ?
                  AND fecha_hora BETWEEN ? AND ?
            `, [entrada.usuario_id, desde, hasta]);

            const totalPaquetes = produccion.length;
            const totalKilos = produccion.reduce((acc, r) => acc + parseFloat(r.peso || 0), 0);
            const totalMetros = produccion.reduce((acc, r) => acc + (parseFloat(r.medida || 0) * 50), 0);
            const promedio = totalPaquetes ? totalKilos / totalPaquetes : 0;

            resumen.push({
                usuario: entrada.usuario,
                totalPaquetes,
                totalKilos,
                totalMetros,
                promedio
            });
        }

        res.json(resumen);
    } catch (err) {
        console.error("❌ Error en /resumen-activos:", err);
        res.status(500).json({ error: "Error al generar resumen de activos" });
    }
});
app.get("/produccion/rango", verificarToken, async (req, res) => {
  const { id: usuarioId, rol } = req.usuario;
  const { fecha } = req.query;

  if (!fecha) {
      return res.status(400).json({ error: "Falta la fecha." });
  }

  try {
      const idUsuarioFinal = rol === "admin" ? req.query.usuario_id : usuarioId;

      // Paso 1: obtener primer registro del día
      const [primerRegistro] = await db.query(`
          SELECT fecha_hora FROM produccion 
          WHERE usuario_id = ? AND DATE(fecha_hora) = ?
          ORDER BY fecha_hora ASC
          LIMIT 1
      `, [idUsuarioFinal, fecha]);

      if (primerRegistro.length === 0) {
          return res.status(404).json({ error: "No hay registros ese día para el usuario." });
      }

      const inicio = primerRegistro[0].fecha_hora;
      const fin = new Date(new Date(inicio).getTime() + 10 * 60 * 60 * 1000); // +10h

      // Paso 2: obtener registros en ese rango
      const [registros] = await db.query(`
          SELECT 
              produccion.usuario_id,
              produccion.peso,
              produccion.medida,
              produccion.tipo_plastico AS tipoPlastico,
              produccion.fecha_hora AS fecha,
              usuarios.usuario
          FROM produccion
          JOIN usuarios ON produccion.usuario_id = usuarios.id
          WHERE produccion.usuario_id = ? 
            AND produccion.fecha_hora BETWEEN ? AND ?
          ORDER BY produccion.fecha_hora ASC
      `, [idUsuarioFinal, inicio, fin]);

      res.json(registros);

  } catch (error) {
      console.error("❌ Error generando reporte por rango:", error);
      res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get('/produccion/reporte-pdf', async (req, res) => {
  try {
      const { usuario_id, desde, hasta } = req.query;
      if (!usuario_id || !desde || !hasta) {
          return res.status(400).json({ error: "Faltan parámetros" });
      }

      const [registros] = await db.query(`
          SELECT p.peso, p.medida, p.tipo_plastico, p.fecha_hora, u.nombre 
          FROM produccion p
          JOIN usuarios u ON p.usuario_id = u.id
          WHERE p.usuario_id = ? 
            AND p.fecha_hora BETWEEN ? AND ?
          ORDER BY p.fecha_hora ASC
      `, [usuario_id, desde, hasta]);

      if (registros.length === 0) {
          return res.status(404).json({ error: "No hay datos para ese usuario en ese rango" });
      }

      const PDFDocument = require("pdfkit");
      const moment = require("moment");

      const doc = new PDFDocument({ margin: 40 });
      const fechaReporte = moment(desde).format("YYYY-MM-DD");
      const horaInicio = moment(registros[0].fecha_hora).format("hh:mm A");
      const horaFin = moment(registros[registros.length - 1].fecha_hora).format("hh:mm A");
      const usuarioNombre = registros[0].nombre;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_produccion_${fechaReporte}.pdf"`);
      doc.pipe(res);

      // TÍTULO
      doc.fontSize(18).fillColor("#000").text("Reporte de Producción", { align: "center" }).moveDown(1);

      // DATOS GENERALES
      doc.fontSize(11).fillColor("#000");
      doc.text(`Usuario: ${usuarioNombre} (ID: ${usuario_id})`);
      doc.text(`Fecha: ${fechaReporte}`);
      doc.text(`Desde: ${horaInicio}   Hasta: ${horaFin}`);
      doc.moveDown(1);

      // RESUMEN
      const resumenMap = {};
      registros.forEach(r => {
          const key = `${r.tipo_plastico}_${r.medida}`;
          const peso = parseFloat(r.peso);
          if (!resumenMap[key]) {
              resumenMap[key] = {
                  tipo: r.tipo_plastico,
                  medida: r.medida,
                  kg: 0,
                  piezas: 0
              };
          }
          if (!isNaN(peso)) {
              resumenMap[key].kg += peso;
              resumenMap[key].piezas++;
          }
      });

      const resumen = Object.values(resumenMap);

      doc.fontSize(12).text("Resumen por tipo de plástico:");
      doc.moveDown(0.5);
      doc.font("Courier-Bold").fontSize(10);
      doc.text("Tipo      Medida (m)   Kg Total   Piezas");
      doc.font("Courier").fontSize(10);

      resumen.forEach(r => {
        const totalPiezas = r.piezas * 50;
        const row = `${r.tipo.padEnd(10)}${String(r.medida).padEnd(13)}${r.kg.toFixed(2).padEnd(11)}${String(totalPiezas)}`;
                  doc.text(row);
      });

      doc.moveDown(1.5);

      // DETALLE
      doc.fontSize(12).text("Detalle de registros:");
      doc.moveDown(0.5);
      doc.font("Courier-Bold").fontSize(10);
      doc.text("Hora      Tipo    Peso (kg)   Medida (m)");
      doc.font("Courier").fontSize(10);

      registros.forEach(r => {
          const hora = moment(r.fecha_hora).format("hh:mm A");
          const tipo = r.tipo_plastico;
          const peso = parseFloat(r.peso).toFixed(2);
          const medida = r.medida;
          const row = `${hora.padEnd(10)}${tipo.padEnd(8)}${peso.padEnd(12)}${String(medida)}`;
          doc.text(row);
      });

      // LEYENDA FINAL
      doc.moveDown(2);
      doc.fontSize(10).fillColor("#555").text("Este reporte fue generado automáticamente por el sistema de gestión de producción.", { align: "center" });

      doc.end();

  } catch (error) {
      console.error("❌ Error al generar reporte de producción:", error);
      res.status(500).json({ error: "Error al generar PDF" });
  }
});


app.get("/produccion/reporte", verificarToken, async (req, res) => {
    try {
        const { usuario, rol, turno, fechaInicio, fechaFin } = req.query;

        console.log("📡 Generando reporte para:", { usuario, rol, turno, fechaInicio, fechaFin });

        if (!usuario || !rol || !turno || !fechaInicio || !fechaFin) {
            return res.status(400).json({ error: "Faltan parámetros en la solicitud" });
        }

        let query = "SELECT peso, medida, tipo_plastico AS tipoPlastico, fecha_hora AS fecha FROM produccion";
        let params = [fechaInicio, fechaFin];

        if (rol !== "admin") {
            query += " WHERE usuario_id = (SELECT id FROM usuarios WHERE usuario = ?) AND fecha_hora BETWEEN ? AND ?";
            params.unshift(usuario); // Agregar usuario al inicio de los parámetros
        } else {
            query += " WHERE fecha_hora BETWEEN ? AND ?";
        }

        query += " ORDER BY fecha_hora DESC";

        console.log("📌 Ejecutando query:", query, "con parámetros:", params);

        const [registros] = await db.query(query, params);
        res.json(registros);

    } catch (error) {
        console.error("❌ Error en GET /produccion/reporte:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});


//RELOJ CHECADOR

app.post("/checador", async (req, res) => {
    try {
        console.log("📥 Datos recibidos en el backend:", req.body);

        const { usuario, turno, tipo, fechaHora, ubicacion } = req.body;

        if (!usuario || !turno || !tipo || !fechaHora || !ubicacion) {
            console.error("❌ Faltan datos en la solicitud:", { usuario, turno, tipo, fechaHora, ubicacion });
            return res.status(400).json({ error: "Faltan datos en la solicitud" });
        }

        // 📌 Verificar si `ubicacion` tiene latitud y longitud
        if (!ubicacion.lat || !ubicacion.lon) {
            console.error("❌ Ubicación incorrecta:", ubicacion);
            return res.status(400).json({ error: "Ubicación inválida" });
        }

        // 📡 Buscar ID del usuario en la base de datos
        const [userResult] = await db.query("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);

        if (userResult.length === 0) {
            console.error("❌ Usuario no encontrado:", usuario);
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const usuario_id = userResult[0].id;

        // 📌 Insertar la checada en la base de datos
        const fechaHoraMySQL = new Date(fechaHora).toISOString().slice(0, 19).replace("T", " ");

await db.query("INSERT INTO checador (usuario_id, turno, tipo, fecha_hora, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?)", 
    [usuario_id, turno, tipo, fechaHoraMySQL, ubicacion.lat, ubicacion.lon]);

        console.log("✅ Registro exitoso para", usuario, "en turno", turno);
        res.json({ mensaje: "Registro exitoso" });

    } catch (error) {
        console.error("❌ Error en el checador:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


/* ------------------ CLIENTES ------------------ */

// Obtener todos los clientes
app.get("/clientes2", async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM clientes");
      res.json(rows);
    } catch (err) {
      console.error("❌ Error en GET /clientes:", err);
      res.status(500).json({ error: "Error al obtener clientes desde tabla real" });
    }
  });
  
  app.get("/clientes/geo", async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT id, nombre, latitud, longitud 
        FROM clientes 
        WHERE latitud IS NOT NULL AND longitud IS NOT NULL
      `);
      res.json(rows);
    } catch (err) {
      console.error("❌ Error en GET /clientes/geo:", err);
      res.status(500).json({ error: "Error al obtener clientes con ubicación" });
    }
  });
  app.post("/importar-productos", async (req, res) => {
    const productos = req.body;
  
    if (!Array.isArray(productos)) {
      return res.status(400).json({ error: "Formato de datos inválido" });
    }
  
    try {
      const sql = "INSERT INTO productos (nombre, clave, categoria, precio, stock) VALUES ?";
      const valores = productos.map(p => [
        (p.nombre || '').substring(0, 100),
        (p.clave || '').substring(0, 50),
        (p.categoria || '').substring(0, 50),
        p.precio,
        p.stock
      ]);
      
      await db.query(sql, [valores]);
  
      res.json({ message: "Productos importados correctamente", cantidad: productos.length });
    } catch (err) {
      console.error("❌ Error al importar productos:", err);
      res.status(500).json({ error: "Error al insertar productos" });
    }
  });
    
  
  // Crear cliente
  app.post("/clientes", async (req, res) => {
    const { nombre, telefono, latitud, longitud } = req.body;
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
  
    try {
      const sql = "INSERT INTO clientes (nombre, telefono, latitud, longitud) VALUES (?, ?, ?, ?)";
      const [result] = await db.query(sql, [nombre, telefono, latitud, longitud]);
      res.json({ message: "Cliente agregado", id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Actualizar cliente
  app.put("/clientes/:id", async (req, res) => {
    const { nombre, telefono, latitud, longitud } = req.body;
    const id = req.params.id;
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
  
    try {
      const sql = "UPDATE clientes SET nombre=?, telefono=?, latitud=?, longitud=? WHERE id=?";
      await db.query(sql, [nombre, telefono, latitud, longitud, id]);
      res.json({ message: "Cliente actualizado con éxito" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Eliminar cliente
  app.delete("/clientes/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await db.query("DELETE FROM clientes WHERE id = ?", [id]);
      res.json({ message: "Cliente eliminado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  /* ------------------ PRODUCTOS ------------------ */
  
  // Obtener productos
  app.get("/productos", async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM productos ORDER BY nombre ASC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Crear producto
  app.post("/productos", async (req, res) => {
    const { nombre, precio, categoria, stock } = req.body;
    if (!nombre || precio == null) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }
  
    try {
      const sql = "INSERT INTO productos (nombre, precio, categoria, stock) VALUES (?, ?, ?, ?)";
      const [result] = await db.query(sql, [nombre, precio, categoria, stock || 0]);
      res.json({ message: "Producto agregado", id: result.insertId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Actualizar producto
  app.put("/productos/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, clave, precio, categoria, stock } = req.body;

  
    if (!nombre || isNaN(precio)) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }
  
    try {
        const sql = "UPDATE productos SET nombre = ?, clave = ?, precio = ?, categoria = ?, stock = ? WHERE id = ?";
        await db.query(sql, [nombre, clave, precio, categoria, stock, id]);
        
      res.json({ message: "Producto actualizado correctamente" });
    } catch (err) {
      console.error("❌ Error al actualizar producto:", err);
      res.status(500).json({ error: "Error al actualizar el producto" });
    }
  });
  
  
  // Eliminar producto
  app.delete("/productos/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await db.query("DELETE FROM productos WHERE id = ?", [id]);
      res.json({ message: "Producto eliminado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  /* ------------------ PRECIOS POR CLIENTE ------------------ */
  
  // Obtener precios con JOIN
  app.get("/precios", async (req, res) => {
    try {
      const query = `
        SELECT pc.id, pc.precio,
               c.nombre AS cliente_nombre,
               p.nombre AS producto_nombre
        FROM precios_cliente pc
        JOIN clientes c ON c.id = pc.cliente_id
        JOIN productos p ON p.id = pc.producto_id
        ORDER BY c.nombre, p.nombre
      `;
      const [rows] = await db.query(query);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Crear o actualizar precio
  app.post("/precios", async (req, res) => {
    const { cliente_id, producto_id, precio } = req.body;
  
    if (!cliente_id || !producto_id || precio == null) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
  
    try {
      const query = `
        INSERT INTO precios_cliente (cliente_id, producto_id, precio)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE precio = VALUES(precio)
      `;
      await db.query(query, [cliente_id, producto_id, precio]);
      res.json({ message: "Precio asignado correctamente" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Actualizar precio personalizado
  app.put("/precios/:id", async (req, res) => {
    const { precio } = req.body;
    const id = req.params.id;
  
    if (precio == null) return res.status(400).json({ error: "El precio es obligatorio" });
  
    try {
      await db.query("UPDATE precios_cliente SET precio = ? WHERE id = ?", [precio, id]);
      res.json({ message: "Precio actualizado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Eliminar precio personalizado
  app.delete("/precios/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await db.query("DELETE FROM precios_cliente WHERE id = ?", [id]);
      res.json({ message: "Precio eliminado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.get("/debug-db", async (req, res) => {
    try {
      const [datos] = await db.query("SELECT DATABASE() AS base, NOW() AS fecha, COUNT(*) as total FROM clientes");
      res.json(datos[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en ${process.env.SERVER_URL || "https://appgh-2z0e.onrender.com"}`);
});

