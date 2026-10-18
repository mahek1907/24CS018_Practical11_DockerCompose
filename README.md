# Practical 11: Containerization with Docker and Docker Compose

**Course:** Advanced Web Development Frameworks (ITUE301)  
**Student ID:** 24CS018  
**Repository:** `24CS018_Practical11_DockerCompose`  
**Technology Stack:** Docker, Docker Compose, Node.js (v18), Express.js, React (Vite), Nginx Alpine, MongoDB (v6.0), Mongoose  

---

## 1. Aim and Objectives

### Aim
To containerize a full-stack Task Management application (comprising a React frontend, Node.js/Express backend with EventEmitter and node-cache, and a MongoDB database) using **Docker** and orchestrate multi-container deployment with **Docker Compose**.

### Objectives
1. Author an optimized `Dockerfile` for the Node.js/Express backend using the official `node:18-alpine` base image.
2. Author a high-performance **multi-stage build `Dockerfile`** for the React frontend, compiling with Node.js and serving statically via **Nginx Alpine**.
3. Create `docker-compose.yml` to orchestrate 3 interconnected services (`frontend`, `backend`, `mongodb`) on an isolated bridge network (`app-network`).
4. Ensure data persistence for MongoDB using a named volume (`task_manager_mongo_data`).
5. Configure inter-container DNS networking using Compose service names (`mongodb://mongodb:27017/taskmanager`).
6. Create comprehensive `.dockerignore` files to keep Docker build contexts lightweight and secure.
7. Preserve all features from previous practicals (Practical 9 caching and Practical 10 EventEmitter asynchronous processing).

---

## 2. Project Architecture & Multi-Container Network

```
                                  Client Browser
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼ (Port 5173)                           ▼ (Port 5000)
        ┌───────────────────────┐               ┌───────────────────────┐
        │   frontend Container  │               │   backend Container   │
        │     (Nginx Alpine)    │               │    (Node 18 Alpine)   │
        │      React App        │               │  Express REST API     │
        └───────────┬───────────┘               └───────────┬───────────┘
                    │                                       │
                    │         Internal Bridge Network       │
                    │              (app-network)            │
                    └───────────────────┬───────────────────┘
                                        │
                                        ▼ (Port 27017)
                            ┌───────────────────────┐
                            │   mongodb Container   │
                            │      (mongo:6.0)      │
                            └───────────┬───────────┘
                                        │
                                        ▼ (Persistent Storage)
                            ┌───────────────────────┐
                            │      Named Volume     │
                            │ (task_manager_mongo)  │
                            └───────────────────────┘
```

---

## 3. Directory Structure

```text
24CS018_Practical11_DockerCompose/
├── backend/
│   ├── config/
│   │   ├── cache.js              # Practical 9 In-memory cache
│   │   └── db.js                 # Database connection helper
│   ├── middleware/               # Auth, logger, validation, error handler
│   ├── models/                   # Task & User Mongoose models
│   ├── routes/                   # authRoutes.js & taskRoutes.js
│   ├── .dockerignore             # Excludes node_modules, .env, git
│   ├── .env.example              # Backend environment template
│   ├── Dockerfile                # Node 18 Alpine backend Dockerfile
│   ├── events.js                 # Practical 10 TaskEvents EventEmitter
│   ├── listeners.js              # Practical 10 Notification event listeners
│   ├── package.json              # Backend dependencies & scripts
│   ├── server.js                 # Application entrypoint
│   └── test_events.js            # Automated verification test suite
├── frontend/
│   ├── src/                      # React source code (App.jsx, main.jsx, App.css)
│   ├── .dockerignore             # Excludes node_modules, dist, git
│   ├── Dockerfile                # Multi-stage Dockerfile (Node -> Nginx)
│   ├── index.html                # HTML entrypoint
│   ├── nginx.conf                # Nginx production reverse proxy config
│   ├── package.json              # Frontend dependencies
│   └── vite.config.js            # Vite bundler configuration
├── docker-compose.yml            # Multi-service orchestration config
├── .dockerignore                 # Root ignore file
├── .env.example                  # Root environment template
├── .gitignore                    # Protects secrets and build artifacts
└── README.md                     # Practical documentation & viva guide
```

---

## 4. Dockerfiles & Build Strategy

### Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```
- **Layer Caching:** Copies `package*.json` before copying the rest of the source code. If only code changes, `npm install` is skipped during rebuilds.
- **Lightweight Image:** `node:18-alpine` reduces image size from ~1 GB to under 180 MB.

### Frontend Multi-Stage Dockerfile (`frontend/Dockerfile`)
```dockerfile
# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production serving stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
```
- **Why Multi-Stage?** The build tools, Vite compiler, and heavy `node_modules` stay in Stage 1 and are discarded. Stage 2 only contains Nginx and compiled HTML/CSS/JS assets (~25 MB total size).

---

## 5. Docker Compose Configuration (`docker-compose.yml`)

The complete stack is defined declaratively:
- **`mongodb`**: Runs `mongo:6.0` with a health check testing `mongosh --eval "db.adminCommand('ping')"`. Mounts `mongo_data` to `/data/db`.
- **`backend`**: Built from `./backend`, depends on `mongodb` being healthy (`condition: service_healthy`), connects via `MONGO_URI: mongodb://mongodb:27017/taskmanager`.
- **`frontend`**: Built from `./frontend`, maps host port `5173:5173`, serves React assets via Nginx.
- **`app-network`**: User-defined bridge network providing automatic internal DNS service discovery.
- **`mongo_data`**: Named Docker volume guaranteeing data persists across container destruction or restarts.

---

## 6. How to Run the Application

### Prerequisites
- Install **Docker Desktop** on Windows (ensuring WSL 2 backend is enabled).

### Step 1: Clone the Repository
```powershell
git clone https://github.com/mahek1907/24CS018_Practical11_DockerCompose.git
cd 24CS018_Practical11_DockerCompose
```

### Step 2: Build and Start Containers
Run the one-command orchestration:
```powershell
docker compose up --build
```
*(To run detached in background, add `-d`: `docker compose up -d --build`)*

### Step 3: Verify Running Containers
```powershell
docker ps
```
**Expected Output:**
```text
CONTAINER ID   IMAGE                                COMMAND                  PORTS                      NAMES
a1b2c3d4e5f6   24cs018_practical11_frontend         "/docker-entrypoint.…"   0.0.0.0:5173->5173/tcp     task_manager_frontend
b2c3d4e5f6a1   24cs018_practical11_backend          "docker-entrypoint.s…"   0.0.0.0:5000->5000/tcp     task_manager_backend
c3d4e5f6a1b2   mongo:6.0                            "docker-entrypoint.s…"   0.0.0.0:27017->27017/tcp   task_manager_mongodb
```

### Step 4: Access the Application
- **Frontend Web UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API Status:** [http://localhost:5000/](http://localhost:5000/)
- **Cache Debug Metrics:** [http://localhost:5000/debug/cache-stats](http://localhost:5000/debug/cache-stats)

### Step 5: Stop Containers
```powershell
docker compose down
```
*(To stop and remove named volumes: `docker compose down -v`)*

---

## 7. Data Persistence Verification

1. Start containers: `docker compose up -d`
2. Open [http://localhost:5173](http://localhost:5173), register, and create 3 tasks.
3. Stop containers completely:
   ```powershell
   docker compose down
   ```
4. Restart containers:
   ```powershell
   docker compose up -d
   ```
5. Refresh [http://localhost:5173](http://localhost:5173) and log in. All created tasks remain preserved because MongoDB stored them in the `task_manager_mongo_data` named volume rather than the ephemeral container filesystem.

---

## 8. Viva Questions & Model Answers

### Q1: What is Docker and what problem does it solve?
**Answer:** Docker is an open-source platform that containerizes applications by packaging code alongside its entire runtime environment, libraries, and system dependencies. It eliminates the classic "it works on my machine" problem by ensuring uniform behavior across development, staging, and production.

### Q2: What is the difference between a Docker Image and a Docker Container?
**Answer:** An **image** is a read-only, immutable template or blueprint (defined by a `Dockerfile`). A **container** is a runnable, isolated instance of an image with a thin read-write layer on top.

### Q3: Why use a multi-stage Dockerfile for the frontend?
**Answer:** To separate the build environment from the runtime environment. A build environment requires Node.js, npm, compilers, and dependencies (hundreds of megabytes). A runtime environment only needs a lightweight web server like Nginx (~25 MB) to serve pre-compiled static HTML/JS files, resulting in smaller, faster, and more secure images.

### Q4: What is the difference between `EXPOSE` and Compose `ports`?
**Answer:** 
- `EXPOSE 5000`: Pure documentation inside the Dockerfile indicating that the container listens on port 5000. It does not publish the port to the host machine.
- `ports: - "5000:5000"`: A Docker Compose directive that maps host port 5000 to container port 5000, allowing outside traffic to reach the service.

### Q5: Why is MongoDB accessed using `mongodb://mongodb:27017` instead of `localhost`?
**Answer:** In Docker, each container has its own isolated network namespace and its own `localhost` loopback interface. If the backend tried to connect to `localhost:27017`, it would search inside its own container and fail. Docker's built-in DNS resolves service names (e.g., `mongodb`) to the container's IP address on the shared user-defined network (`app-network`).

### Q6: Why should `node_modules` be excluded via `.dockerignore`?
**Answer:** 
1. Prevents transferring massive local folders into the Docker build context (speeding up builds).
2. Avoids binary incompatibilities (e.g., packages compiled for Windows x64 failing inside a Linux Alpine container). Dependencies should always be cleanly installed inside the container via `npm install`.

### Q7: What is the purpose of Docker Volumes?
**Answer:** Container filesystems are ephemeral—when a container is deleted or recreated, all internal state is lost. Named volumes persist outside container lifecycles on the host storage, ensuring database data survives restarts and updates.

### Q8: What does `depends_on` with `condition: service_healthy` do?
**Answer:** Standard `depends_on` only waits until the dependent container starts running, not until the database is ready to accept connections. Using `condition: service_healthy` ensures the backend does not start until MongoDB's ping check returns success, preventing startup crash loops.

---

## 9. Conclusion
Practical 11 successfully containerized the Task Management system into a production-ready, multi-container microservice architecture. The entire stack boots deterministically in one command with isolated networking and persistent storage.
