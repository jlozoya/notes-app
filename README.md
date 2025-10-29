# 📱🖥️ Collaborative Notes App

A full-stack **collaborative note-taking app** built with:
- **React Native (Expo)** for the mobile client  
- **Node.js + Express + TypeScript** for the backend  
- **MongoDB** as the database  
- **Socket.IO** for real-time collaboration  
- **GitHub Actions** for CI/CD automation  
- **Apache (Lightsail)** as a **reverse proxy** for secure HTTPS routing  

---

## 🚀 Deployment Overview

This project uses **two independent pipelines** managed via GitHub Actions:

| Component | Stack | Deployment Target |
|------------|--------|-------------------|
| **Backend API** | Node.js + Express + MongoDB | AWS Lightsail / EC2 instance |
| **Hybrid Client** | React Native + Expo + EAS | Expo Cloud (EAS Build & OTA Updates) |

---

## 🧱 Project Structure

```

.
├── backend/                # Node.js + Express + Socket.IO server
│   ├── src/
│   ├── package.json
│   └── .github/workflows/ci-cd.yml
│
├── client/                 # React Native + Expo app
│   ├── src/
│   ├── package.json
│   └── .github/workflows/react-native-ci.yml
│
└── README.md

````

---

## ⚙️ Backend Setup (Node.js Server)

### 🔧 1. Environment variables (`backend/.env`)

```bash
PORT=4040
MONGO_URI=mongodb://<user>:<pass>@127.0.0.1:27017/notesapp?authSource=notesapp
JWT_SECRET=supersecret
````

### 🧩 2. Local backend development

```bash
cd backend
npm install
npm run dev
```

Runs with live reload using **ts-node-dev** on [http://localhost:4000](http://localhost:4000)

---

### 🌐 3. Production server setup (Lightsail / EC2)

SSH into your instance:

```bash
sudo apt update
sudo apt install -y git nodejs npm
sudo npm i -g pm2
```

Then deploy manually for the first time:

```bash
git clone https://github.com/<youruser>/<yourrepo>.git
cd <yourrepo>/backend
npm ci
npm run build
pm2 start dist/index.js --name notesapp
```

---

### ⚙️ 4. CI/CD (Automatic Deployment)

#### Workflow file:

📄 `.github/workflows/ci-cd.yml`

**Triggered on every push to `main`**:

1. Installs dependencies
2. Builds TypeScript
3. Deploys via SSH
4. Restarts the app with PM2

#### Required GitHub Secrets:

| Secret              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `SERVER_HOST`       | Server IP address                                |
| `SERVER_USER`       | SSH username (e.g. ubuntu / bitnami)             |
| `SERVER_SSH_KEY`    | Private SSH key for deployment                   |
| `EXPO_TOKEN`        | Authentication token from expo to build on movil |
| `EAS_ANDROID_READY` | Expo/EAS variable                                |


Your backend redeploys automatically after each push to `main`.

---

## 🌍 Reverse Proxy (Apache on AWS Lightsail)

The backend runs on **port 4040**, while **Apache** handles HTTPS requests on port **443** and proxies them internally to the Node server.

This ensures:

* Secure SSL termination
* A single unified domain (`https://notesapp.lozoya.org`) for both frontend and backend
* Proper Socket.IO WebSocket upgrades

---

### 🔁 Apache VirtualHost Configuration (example)

📄 `/opt/bitnami/apache/conf/vhosts/notesapp.lozoya.org.conf`

```apache
<VirtualHost *:80>
  ServerName notesapp.lozoya.org
  RewriteEngine On
  RewriteRule ^/(.*)$ https://notesapp.lozoya.org/$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
  ServerName notesapp.lozoya.org

  SSLEngine on
  SSLCertificateFile      "/opt/bitnami/apache/conf/notesapp.lozoya.org.crt"
  SSLCertificateKeyFile   "/opt/bitnami/apache/conf/notesapp.lozoya.org.key"

  # Static web app (Expo web build)
  DocumentRoot "/home/bitnami/notesapp/frontend/dist"
  <Directory "/home/bitnami/notesapp/frontend/dist">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteCond %{REQUEST_URI} !^/socket\.io/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
  </Directory>

  # Proxy WebSocket (Socket.IO)
  ProxyPass        /socket.io/  ws://127.0.0.1:4040/socket.io/ retry=0 timeout=30
  ProxyPassReverse /socket.io/  ws://127.0.0.1:4040/socket.io/
  ProxyPass        /socket.io/  http://127.0.0.1:4040/socket.io/
  ProxyPassReverse /socket.io/  http://127.0.0.1:4040/socket.io/

  # Proxy REST API
  ProxyPass        /api/        http://127.0.0.1:4040/api/ connectiontimeout=5 timeout=60 keepalive=On
  ProxyPassReverse /api/        http://127.0.0.1:4040/api/

  # Optional: health check
  ProxyPass        /health     http://127.0.0.1:4040/health
  ProxyPassReverse /health     http://127.0.0.1:4040/health

  RequestHeader set X-Forwarded-Proto "https"
  RequestHeader set X-Forwarded-Host  "notesapp.lozoya.org"
  RequestHeader set X-Forwarded-Port  "443"

  ErrorLog  "/opt/bitnami/apache/logs/notesapp-error.log"
  CustomLog "/opt/bitnami/apache/logs/notesapp-access.log" combined
</VirtualHost>
```

✅ This configuration:

* Redirects HTTP → HTTPS
* Serves your frontend from `/home/bitnami/notesapp/frontend/dist`
* Proxies `/api/*` and `/socket.io/*` requests to your Node backend on `127.0.0.1:4040`
* Supports real-time WebSocket connections

---

## 📱 React Native Client (Expo)

### ⚙️ 1. Local Development

```bash
cd client
npm install
npm start
```

Start the Expo dev server and scan the QR code with Expo Go (Android/iOS).

---

### 🔐 2. Expo / EAS configuration

Ensure `EXPO_PUBLIC_API_URL` points to the production domain:

```bash
EXPO_PUBLIC_API_URL=https://notesapp.lozoya.org
```

This makes all API and WebSocket calls go through Apache’s secure proxy.

---

### ☁️ 3. CI/CD with GitHub Actions

Workflow:
📄 `.github/workflows/react-native-ci.yml`

Triggered on push to `main`:

1. Installs dependencies
2. Logs into Expo
3. Builds via **EAS Build**
4. Publishes OTA updates

---

## 🔄 Combined CI/CD Workflow

| Service                 | Deployment                 | Technology                           |
| ----------------------- | -------------------------- | ------------------------------------ |
| **Backend**             | AWS Lightsail              | Node.js + PM2 + Apache reverse proxy |
| **Frontend (Expo Web)** | Apache (served statically) | Expo export + GitHub Actions rsync   |
| **Mobile (Expo EAS)**   | Expo Cloud                 | OTA + App Store builds               |

---

## 🧠 Maintenance Tips

* Use `pm2 logs notesapp` to monitor backend logs.
* Rotate your SSH key and tokens regularly.
* Check Apache logs at `/opt/bitnami/apache/logs/notesapp-error.log`.
* Restart Apache with `sudo /opt/bitnami/ctlscript.sh restart apache` if mount using apache.
* Visit [https://notesapp.lozoya.org/health](https://notesapp.lozoya.org/health) to verify backend health.

---

## 🧩 Tech Stack Summary

| Layer       | Technology                                 |
| ----------- | ------------------------------------------ |
| Frontend    | React Native (Expo), NativeWind (Tailwind) |
| Web Hosting | Apache (Lightsail)                         |
| Backend     | Node.js, Express, Socket.IO                |
| Database    | MongoDB (Atlas)                            |
| Auth        | JWT                                        |
| Realtime    | Socket.IO                                  |
| Deployment  | GitHub Actions + PM2 + Apache + Expo EAS   |

---

## 📧 Support / Contributors

**Author:** [Juan Fernando Lozoya Valdez](https://github.com/jlozoya)
**License:** MIT

---

> *“Write once, sync everywhere — notes that stay live in real time.”*
