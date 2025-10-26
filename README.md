```markdown
# 📱🖥️ Collaborative Notes App

A full-stack **collaborative note-taking app** built with:
- **React Native (Expo)** for the mobile client  
- **Node.js + Express + TypeScript** for the backend  
- **MongoDB** as the database  
- **Socket.IO** for real-time collaboration  
- **GitHub Actions** for CI/CD automation  

---

## 🚀 Deployment Overview

This project uses **two independent pipelines** managed via GitHub Actions:

| Component | Stack | Deployment Target |
|------------|--------|-------------------|
| **Backend API** | Node.js + Express + MongoDB | AWS Lightsail / EC2 instance |
| **Mobile Client** | React Native + Expo + EAS | Expo Cloud (EAS Build & OTA Updates) |

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
│   ├── App.tsx
│   ├── package.json
│   └── .github/workflows/react-native-ci.yml
│
└── README.md

````

---

## ⚙️ Backend Setup (Node.js Server)

### 🔧 1. Environment variables (`backend/.env`)
```bash
PORT=4000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/notesapp
JWT_SECRET=supersecret
````

### 🧩 2. Local development

```bash
cd backend
npm install
npm run dev
```

Runs with live reload using **ts-node-dev** on [http://localhost:4000](http://localhost:4000)

---

### 🐳 Optional: Docker (local)

```bash
docker build -t notes-backend .
docker run -p 4000:4000 --env-file .env notes-backend
```

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

| Secret           | Description                          |
| ---------------- | ------------------------------------ |
| `SERVER_HOST`    | Server IP address                    |
| `SERVER_USER`    | SSH username (e.g. ubuntu)           |
| `SERVER_SSH_KEY` | Private SSH key (for GitHub Actions) |

Your backend redeploys automatically after each push to `main`.

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

Make sure you have an `eas.json` in `client/`:

```json
{
  "build": {
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "simulator": false },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

Log in locally:

```bash
eas login
```

---

### ☁️ 3. CI/CD with GitHub Actions

Workflow:
📄 `.github/workflows/react-native-ci.yml`

Triggered on push to `main`:

1. Installs dependencies
2. Runs Jest tests
3. Logs into Expo using secrets
4. Builds the app via **EAS Build**
5. Publishes Over-The-Air (OTA) updates automatically

#### Required GitHub Secrets:

| Secret                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `EXPO_USERNAME`          | Your Expo account email                       |
| `EXPO_PASSWORD`          | Expo account password or access token         |
| *(optional)* `EAS_TOKEN` | Personal EAS token for non-interactive builds |

---

### 🚀 4. Build commands

#### Android / iOS release builds:

```bash
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

#### OTA (Over-The-Air) update:

```bash
npx expo publish
```

---

## 🔄 Combined CI/CD Workflow

Both pipelines can run in parallel under a single GitHub workflow:

* **Backend** → SSH deploy via PM2
* **Client** → Expo build & publish via EAS

All automatic on push to `main`.

---

## 🧠 Tips & Maintenance

* Run `pm2 save` and `pm2 startup` to keep backend running after reboot.
* Use `pm2 logs notesapp` to monitor logs.
* Check Expo build status at [https://expo.dev/accounts](https://expo.dev/accounts).
* Rotate your `SERVER_SSH_KEY` and Expo tokens regularly for security.

---

## 🧩 Tech Stack Summary

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Frontend   | React Native (Expo), NativeWind (Tailwind) |
| Backend    | Node.js, Express, Socket.IO                |
| Database   | MongoDB (Atlas)                            |
| Auth       | JWT                                        |
| Realtime   | Socket.IO                                  |
| Deployment | GitHub Actions + PM2 + Expo EAS            |

---

## 🏁 End-to-End Flow

1. Developer commits → pushes to `main`
2. GitHub Actions builds backend + client
3. Backend deploys automatically to Lightsail
4. Client publishes via Expo (OTA or app store builds)
5. All users instantly get updated versions

---

## 📧 Support / Contributors

**Author:** [Juan Fernando Lozoya Valdez](https://github.com/jlozoya)
**Email:** [juan@lozoya.org](mailto:juan@lozoya.org)
**License:** MIT

---

> *“Write once, sync everywhere — notes that stay live in real time.”*

```