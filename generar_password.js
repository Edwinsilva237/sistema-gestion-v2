const bcrypt = require("bcryptjs");

async function generarPassword() {
    const password = "Ed452"; // Cambia esto si quieres otra contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Contraseña encriptada:", hashedPassword);
}

generarPassword();
