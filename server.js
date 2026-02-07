const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Crea la cartella uploads se non esiste
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Crea il file posts.json se non esiste
if (!fs.existsSync('./posts.json')) {
    fs.writeFileSync('./posts.json', JSON.stringify([]));
}

// Configurazione Multer per l'upload dei file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limite
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo immagini e video sono permessi!'));
        }
    }
});

// Funzioni helper per leggere/scrivere posts
function readPosts() {
    const data = fs.readFileSync('./posts.json', 'utf8');
    return JSON.parse(data);
}

function writePosts(posts) {
    fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2));
}

// ROUTES

// GET - Ottieni tutti i post
app.get('/api/posts', (req, res) => {
    try {
        const posts = readPosts();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel recupero dei post' });
    }
});

// GET - Ottieni un singolo post
app.get('/api/posts/:id', (req, res) => {
    try {
        const posts = readPosts();
        const post = posts.find(p => p.id === parseInt(req.params.id));
        
        if (!post) {
            return res.status(404).json({ error: 'Post non trovato' });
        }
        
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel recupero del post' });
    }
});

// POST - Crea un nuovo post con upload file
app.post('/api/posts', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File non caricato' });
        }

        const { title, description, date, tags, externalLink } = req.body;

        if (!title || !description) {
            // Elimina il file caricato se mancano dati
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Titolo e descrizione sono obbligatori' });
        }

        const posts = readPosts();
        
        // Determina il tipo di file
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        
        // Crea il nuovo post
        const newPost = {
            id: Date.now(),
            type: fileType,
            url: `/uploads/${req.file.filename}`,
            title: title,
            description: description,
            date: date || new Date().toISOString().split('T')[0],
            tags: tags ? JSON.parse(tags) : [],
            externalLink: externalLink && externalLink.trim() ? externalLink.trim() : null
        };

        // Aggiungi il post all'inizio dell'array
        posts.unshift(newPost);
        
        // Salva nel file
        writePosts(posts);

        res.status(201).json(newPost);
    } catch (error) {
        console.error('Errore nel creare il post:', error);
        res.status(500).json({ error: 'Errore nel creare il post' });
    }
});

// DELETE - Elimina un post
app.delete('/api/posts/:id', (req, res) => {
    try {
        const posts = readPosts();
        const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id));
        
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post non trovato' });
        }

        const post = posts[postIndex];
        
        // Elimina il file associato
        const filePath = path.join(__dirname, post.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Rimuovi il post dall'array
        posts.splice(postIndex, 1);
        
        // Salva le modifiche
        writePosts(posts);

        res.json({ message: 'Post eliminato con successo' });
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'eliminare il post' });
    }
});

// PUT - Aggiorna un post
app.put('/api/posts/:id', (req, res) => {
    try {
        const posts = readPosts();
        const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id));
        
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post non trovato' });
        }

        const { title, description, date, tags, externalLink } = req.body;
        
        // Aggiorna solo i campi forniti
        if (title) posts[postIndex].title = title;
        if (description) posts[postIndex].description = description;
        if (date) posts[postIndex].date = date;
        if (tags) posts[postIndex].tags = tags;
        if (externalLink !== undefined) posts[postIndex].externalLink = externalLink && externalLink.trim() ? externalLink.trim() : null;

        writePosts(posts);

        res.json(posts[postIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Errore nell\'aggiornare il post' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`🚀 Server in esecuzione su http://localhost:${PORT}`);
    console.log(`📁 File statici serviti da: public/`);
    console.log(`🖼️  Upload serviti da: uploads/`);
});
