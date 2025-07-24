// generar_hash.js
const bcrypt = require('bcryptjs');

const passwordPlana = 'admin';
const saltRounds = 10;

console.log(`Encriptando la contraseña: "${passwordPlana}"...`);

bcrypt.hash(passwordPlana, saltRounds, (err, hash) => {
    if (err) {
        console.error("Error al generar el hash:", err);
        return;
    }
    console.log("\n¡Hash generado con éxito!");
    console.log("Copia la siguiente línea completa y pégala en tu comando SQL:");
    console.log(hash);
});