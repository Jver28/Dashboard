// =================================================================
//                    SERVIDOR API PARA DATAREST (v3 - COMPLETO)
// =================================================================

// 1. IMPORTACIÓN DE MÓDULOS
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// 2. INICIALIZACIÓN Y MIDDLEWARE BÁSICO
const app = express();
app.use(cors()); // Permite que tu frontend (en otro dominio/puerto) haga peticiones a esta API
app.use(express.json()); // Permite al servidor entender peticiones con cuerpo en formato JSON

// 3. CONFIGURACIÓN CENTRAL
const PORT = 3000; // El puerto donde se ejecutará tu API
const JWT_SECRET = 'este-es-un-secreto-muy-largo-y-seguro-que-debes-cambiar'; // ¡IMPORTANTE! Cambia esto por una frase larga y aleatoria

// 4. CONEXIÓN A LA BASE DE DATOS MYSQL
const db = mysql.createConnection({
    host: 'localhost',      // O la IP de tu servidor de base de datos
    user: 'root',           // Tu usuario de MySQL
    password: '',           // Tu contraseña de MySQL
    database: 'restaurante_db'
});

db.connect(err => {
    if (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        return;
    }
    console.log('✅ Conectado a la base de datos MySQL.');
});

// 5. MIDDLEWARE DE AUTENTICACIÓN (El "Guardián" de las rutas)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // El formato es "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ message: 'Acceso denegado: No se proporcionó token.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Acceso denegado: El token es inválido o ha expirado.' });
        }
        req.user = user; // Guardamos la info del usuario (id, role) en el objeto de la petición
        next(); // El token es válido, la petición puede continuar
    });
}

// Middleware para requerir rol de admin
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: Se requiere rol de administrador.' });
    }
    next();
}


// =================================================================
//                       RUTAS DE LA API (ENDPOINTS)
// =================================================================

// RUTA PÚBLICA: Iniciar sesión
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y contraseña son requeridos.' });

    const query = 'SELECT * FROM usuarios WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor.' });
        if (results.length === 0) return res.status(401).json({ message: 'Credenciales inválidas.' });

        const user = results[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(401).json({ message: 'Credenciales inválidas.' });

        const apiToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token: apiToken });
    });
});


// --- RUTAS PROTEGIDAS (Requieren un token válido de un admin) ---

// RUTA PROTEGIDA: Obtener la lista de todos los usuarios
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    const query = 'SELECT id, email, role, created_at FROM usuarios';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor.' });
        res.json(results);
    });
});

// RUTA PROTEGIDA: Crear un nuevo usuario
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ message: 'Faltan campos requeridos.' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO usuarios (email, password, role) VALUES (?, ?, ?)';
    db.query(query, [email, hashedPassword, role], (err, results) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'El email ya está registrado.' });
            return res.status(500).json({ message: 'Error del servidor al crear usuario.' });
        }
        res.status(201).json({ message: 'Usuario creado con éxito.' });
    });
});

// RUTA PROTEGIDA: Actualizar un usuario (Editar)
app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { email, role } = req.body;

    if (!email || !role) return res.status(400).json({ message: 'Faltan campos requeridos.' });

    const query = 'UPDATE usuarios SET email = ?, role = ? WHERE id = ?';
    db.query(query, [email, role, userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor al actualizar.' });
        if (results.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
        res.json({ message: 'Usuario actualizado con éxito.' });
    });
});

// RUTA PROTEGIDA: Eliminar un usuario
app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const adminId = req.user.id;

    if (userId === adminId) {
        return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const query = 'DELETE FROM usuarios WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor al eliminar.' });
        if (results.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
        res.json({ message: 'Usuario eliminado con éxito.' });
    });
});

// RUTA PROTEGIDA: Resetear la contraseña de un usuario
app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'La nueva contraseña es requerida.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const query = 'UPDATE usuarios SET password = ? WHERE id = ?';
        db.query(query, [hashedPassword, userId], (err, results) => {
            if (err) return res.status(500).json({ message: 'Error del servidor al resetear la contraseña.' });
            if (results.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
            res.json({ message: 'Contraseña actualizada con éxito.' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al encriptar la nueva contraseña.' });
    }
});


// 6. INICIAR EL SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
});