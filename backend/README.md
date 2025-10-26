```markdown
# 🖥️ Collaborative Notes Backend

This is the backend API for the **Collaborative Notes App**, built with:

- **Node.js + Express + TypeScript**
- **MongoDB (Mongoose)**
- **Socket.IO** for real-time collaboration
- **JWT authentication**
- **PM2** for process management
- **GitHub Actions** for CI/CD deployment

---

## ⚙️ Features

- User authentication (`/api/auth/signup`, `/api/auth/login`)
- CRUD for notes (`/api/notes`)
- Real-time editing via Socket.IO
- Environment configuration via `.env`
- Automatic deployment using GitHub Actions

---

## 🧩 Project Structure

```

backend/
├── src/
│   ├── index.ts              # Server entry point
│   ├── config/db.ts          # MongoDB connection
│   ├── middleware/auth.ts    # JWT middleware
│   ├── models/
│   │   ├── User.ts
│   │   └── Note.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── notes.routes.ts
│   └── sockets/notes.socket.ts
├── .env
├── package.json
├── tsconfig.json
└── README.md

````

---

## ⚙️ Setup & Local Development

### 1️⃣ Install dependencies
```bash
cd backend
npm install
````

### 2️⃣ Environment variables

Create a `.env` file in the backend root:

```bash
PORT=4000
MONGO_URI=mongodb://localhost:27017/notesapp
JWT_SECRET=supersecret
```

### 3️⃣ Run locally (development)

```bash
npm run dev
```

Starts the TypeScript server with hot reload via `ts-node-dev`.

### 4️⃣ Build and run (production)

```bash
npm run build
npm start
```

---

## 🧱 API Endpoints

### Auth

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| POST   | `/api/auth/signup` | Register new user     |
| POST   | `/api/auth/login`  | Login and receive JWT |

### Notes

| Method | Endpoint         | Description                      |
| ------ | ---------------- | -------------------------------- |
| GET    | `/api/notes`     | Get all notes for logged-in user |
| GET    | `/api/notes/:id` | Get a single note                |
| POST   | `/api/notes`     | Create a new note                |
| PUT    | `/api/notes/:id` | Update an existing note          |
| DELETE | `/api/notes/:id` | Delete a note                    |

> All `/api/notes` routes require a valid JWT token in the `Authorization` header.

---

## ⚡ Real-time Collaboration

Socket.IO is enabled on the same server.
Clients connect via:

```ts
import io from "socket.io-client";

const socket = io("http://localhost:4000");
socket.emit("join", noteId);
socket.on("update", (data) => console.log("Received:", data));
```

### Events

| Event    | Direction       | Payload               | Description                                 |
| -------- | --------------- | --------------------- | ------------------------------------------- |
| `join`   | client → server | `noteId`              | Joins a specific note room                  |
| `edit`   | client → server | `{ id, title, html }` | Sends updates to other users                |
| `update` | server → client | `{ title, html }`     | Broadcasts changes to all users in the room |

---

## 🧰 PM2 Process Manager

Run the app in background on your production server:

```bash
npm run build
pm2 start dist/index.js --name notesapp
pm2 save
pm2 startup
```

Useful commands:

```bash
pm2 logs notesapp       # View logs
pm2 restart notesapp    # Restart server
pm2 list                # Show running apps
```

---

## 🌐 Deployment (CI/CD)

### GitHub Actions Workflow

Located in: `.github/workflows/ci-cd.yml`

Triggered automatically on every push to `main`:

1. Installs dependencies
2. Builds the TypeScript project
3. SSHs into your server
4. Pulls latest code
5. Restarts the app via PM2

### Required GitHub Secrets

| Secret           | Description                        |
| ---------------- | ---------------------------------- |
| `SERVER_HOST`    | Server IP or domain                |
| `SERVER_USER`    | SSH username (e.g. ubuntu)         |
| `SERVER_SSH_KEY` | Private SSH key for GitHub Actions |

---

## 🧠 Deployment Steps (Manual)

1. SSH into your instance:

   ```bash
   ssh ubuntu@your-server-ip
   ```
2. Clone repo and install:

   ```bash
   git clone https://github.com/<user>/<repo>.git
   cd <repo>/backend
   npm ci
   npm run build
   pm2 start dist/index.js --name notesapp
   ```
3. Configure `.env` in `/home/ubuntu/notesapp/backend/.env`

---

## 🧩 Tech Stack

| Layer           | Technology         |
| --------------- | ------------------ |
| Runtime         | Node.js (v20+)     |
| Framework       | Express.js         |
| Language        | TypeScript         |
| Database        | MongoDB (Mongoose) |
| Auth            | JWT                |
| Realtime        | Socket.IO          |
| Process Manager | PM2                |
| CI/CD           | GitHub Actions     |

---

## 🧪 Testing (Optional)

You can write unit tests using **Jest**:

```bash
npm install -D jest ts-jest @types/jest supertest
```

Initialize config:

```bash
npx ts-jest config:init
```

Run tests:

```bash
npm test
```

## 📜 License

MIT © 2025 [Juan Fernando Lozoya Valdez](https://github.com/jlozoya)

> *“Write once, sync everywhere — real-time collaboration made simple.”*

```
