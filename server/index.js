import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp({
  dbPath: process.env.DB_PATH || 'data/app.db',
  uploadDir: process.env.UPLOAD_DIR || 'data/uploads',
});

app.listen(port, () => console.log(`Painting app running at http://localhost:${port}`));
