# University Management System — Microservices

IT4020 Assignment 2 | Node.js + Express.js + Swagger

## Architecture

```
Client
  │
  └── API Gateway (port 3000)
        ├── /api/students  → Student Service  (port 3001)
        ├── /api/courses   → Course Service   (port 3002)
        ├── /api/lecturers → Lecturer Service (port 3003)
        └── /api/results   → Result Service   (port 3004)
```

## Folder Structure

```
university-ms/
├── api-gateway/         ← Single entry point for all services
│   ├── index.js
│   └── package.json
├── student-service/     ← Member 1
│   ├── index.js
│   └── package.json
├── course-service/      ← Member 2
│   ├── index.js
│   └── package.json
├── lecturer-service/    ← Member 3
│   ├── index.js
│   └── package.json
├── result-service/      ← Member 4
│   ├── index.js
│   └── package.json
├── payment-service/     ← Member 5 (or shared)
│   ├── index.js
│   └── package.json
└── README.md
```

## Setup & Run

Open **5 separate terminals** and run each command:

### Terminal 1 — Student Service
```bash
cd student-service
npm install
npm start
```

### Terminal 2 — Course Service
```bash
cd course-service
npm install
npm start
```

### Terminal 3 — Lecturer Service
```bash
cd lecturer-service
npm install
npm start
```

### Terminal 4 — Result Service
```bash
cd result-service
npm install
npm start
```

### Terminal 5 — API Gateway
```bash
cd api-gateway
npm install
npm start
```

## Swagger Documentation URLs

| Service | Direct Swagger URL | Via Gateway |
|---|---|---|
| Student | http://localhost:3001/api-docs | http://localhost:3000/api/students |
| Course | http://localhost:3002/api-docs | http://localhost:3000/api/courses |
| Lecturer | http://localhost:3003/api-docs | http://localhost:3000/api/lecturers |
| Result | http://localhost:3004/api-docs | http://localhost:3000/api/results |
| **Gateway** | **http://localhost:3000/api-docs** | — |

## API Endpoints

### Student Service (3001 / gateway: /api/students)
| Method | Endpoint | Description |
|---|---|---|
| GET | /students | Get all students |
| GET | /students/:id | Get student by ID |
| POST | /students | Create student |
| PUT | /students/:id | Update student |
| DELETE | /students/:id | Delete student |

### Course Service (3002 / gateway: /api/courses)
| Method | Endpoint | Description |
|---|---|---|
| GET | /courses | Get all courses |
| GET | /courses/:id | Get course by ID |
| POST | /courses | Create course |
| PUT | /courses/:id | Update course |
| DELETE | /courses/:id | Delete course |

### Lecturer Service (3003 / gateway: /api/lecturers)
| Method | Endpoint | Description |
|---|---|---|
| GET | /lecturers | Get all lecturers |
| GET | /lecturers/:id | Get lecturer by ID |
| POST | /lecturers | Create lecturer |
| PUT | /lecturers/:id | Update lecturer |
| DELETE | /lecturers/:id | Delete lecturer |

### Result Service (3004 / gateway: /api/results)
| Method | Endpoint | Description |
|---|---|---|
| GET | /results | Get all results |
| GET | /results/:id | Get result by ID |
| GET | /results/student/:studentId | Get results by student |
| POST | /results | Create result |
| PUT | /results/:id | Update result |
| DELETE | /results/:id | Delete result |
