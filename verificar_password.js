const bcrypt = require("bcryptjs");

const passwordIngresada = "admin123";
const hashAlmacenado = "$2a$10$rRXhBpIzhLAw4e0pRKdAruv7FP7uu59TaA3/M8yWZ7EDT3mOFxp5y";

bcrypt.compare(passwordIngresada, hashAlmacenado, (err, result) => {
    if (result) {
        console.log("✅ La contraseña es correcta.");
    } else {
        console.log("❌ La contraseña es incorrecta.");
    }
});
