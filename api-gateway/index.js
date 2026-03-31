require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

// ── CORS Configuration ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Service URLs (from environment or defaults) ───────────────────────────────
const SERVICES = {
  student:  process.env.STUDENT_SERVICE_URL || "http://localhost:3001",
  course:   process.env.COURSE_SERVICE_URL || "http://localhost:3002",
  lecturer: process.env.LECTURER_SERVICE_URL || "http://localhost:3003",
  result:   process.env.RESULT_SERVICE_URL || "http://localhost:3004",
  payment:  process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
};

// Proxy timeout configuration (in milliseconds)
const PROXY_TIMEOUT = parseInt(process.env.PROXY_TIMEOUT) || 30000;

// ── Proxy error handler ───────────────────────────────────────────────────────
const onProxyError = (err, req, res) => {
  console.error(`[Gateway] Proxy error: ${err.message} for ${req.method} ${req.originalUrl}`);
  res.status(503).json({
    success: false,
    message: "Service temporarily unavailable",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

// ── Proxy options factory ─────────────────────────────────────────────────────
const createProxyOptions = (target, pathRewriteKey, pathRewriteValue) => ({
  target,
  changeOrigin: true,
  timeout: PROXY_TIMEOUT,
  proxyTimeout: PROXY_TIMEOUT,
  pathRewrite: { [pathRewriteKey]: pathRewriteValue },
  onError: onProxyError,
});

// ── Request logger middleware ─────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[Gateway] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// ── Proxy routes ─────────────────────────────────────────────────────────────
app.use("/api/students",  createProxyMiddleware(createProxyOptions(SERVICES.student, "^/api/students", "/students")));
app.use("/api/courses",   createProxyMiddleware(createProxyOptions(SERVICES.course, "^/api/courses", "/courses")));
app.use("/api/lecturers", createProxyMiddleware(createProxyOptions(SERVICES.lecturer, "^/api/lecturers", "/lecturers")));
app.use("/api/results",   createProxyMiddleware(createProxyOptions(SERVICES.result, "^/api/results", "/results")));
app.use("/api/payments",  createProxyMiddleware(createProxyOptions(SERVICES.payment, "^/api/payments", "/payments")));

// ── Swagger config for Gateway ────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "University Management System — API Gateway",
      version: "1.0.0",
      description:
        "Central API Gateway exposing all microservices on a single port (3000). " +
        "Each service has its own ID (auto-generated UUID) and user-provided IDs (studentID, courseID, lecturerID). " +
        "Start each service manually with 'npm start' in their respective folders.",
    },
    servers: [{ url: "http://localhost:3000", description: "API Gateway" }],
    tags: [
      { name: "Students",  description: "Student Service (port 3001) - studentID: IT/EN/BS + 8 digits" },
      { name: "Courses",   description: "Course Service (port 3002) - courseID: IT/EN/BS + 4 digits" },
      { name: "Lecturers", description: "Lecturer Service (port 3003) - lecturerID: IT/EN/BS + 4 digits" },
      { name: "Results",   description: "Result Service (port 3004) - Grade auto-calculated from marks" },
      { name: "Payments",  description: "Payment Service (port 3005) - Status: Paid/Pending/Overdue" },
    ],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Swagger route definitions (documentation only — actual routing via proxy) ─

/**
 * @swagger
 * /api/students:
 *   get:
 *     tags: [Students]
 *     summary: Get all students
 *     responses:
 *       200:
 *         description: List of students
 *   post:
 *     tags: [Students]
 *     summary: Create a student
 *     description: |
 *       ID is auto-generated (UUID). studentID must be IT/EN/BS + 8 digits.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentID, name, email, age, department]
 *             properties:
 *               studentID:
 *                 type: string
 *                 description: IT/EN/BS + 8 digits
 *                 example: "IT99887766"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john@uni.lk"
 *               age:
 *                 type: integer
 *                 example: 22
 *               department:
 *                 type: string
 *                 example: "IT"
 *     responses:
 *       201:
 *         description: Student created
 */

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get student by ID (UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Student found
 *   put:
 *     tags: [Students]
 *     summary: Update student
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               age: { type: integer }
 *               department: { type: string }
 *     responses:
 *       200:
 *         description: Student updated
 *   delete:
 *     tags: [Students]
 *     summary: Delete student
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Student deleted
 */

/**
 * @swagger
 * /api/students/by-student-id/{studentID}:
 *   get:
 *     tags: [Students]
 *     summary: Get student by studentID (user-provided)
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema: { type: string }
 *         description: IT/EN/BS + 8 digits
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Student found
 */

/**
 * @swagger
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get all courses
 *     responses:
 *       200:
 *         description: List of courses
 *   post:
 *     tags: [Courses]
 *     summary: Create a course
 *     description: |
 *       ID is auto-generated (UUID). courseID must be IT/EN/BS + 4 digits.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseID, title, credits, department]
 *             properties:
 *               courseID:
 *                 type: string
 *                 description: IT/EN/BS + 4 digits
 *                 example: "IT4021"
 *               title:
 *                 type: string
 *                 example: "Advanced Programming"
 *               credits:
 *                 type: integer
 *                 example: 3
 *               department:
 *                 type: string
 *                 example: "IT"
 *     responses:
 *       201:
 *         description: Course created
 */

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course by ID (UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course found
 *   put:
 *     tags: [Courses]
 *     summary: Update course
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               credits: { type: integer }
 *               department: { type: string }
 *     responses:
 *       200:
 *         description: Course updated
 *   delete:
 *     tags: [Courses]
 *     summary: Delete course
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course deleted
 */

/**
 * @swagger
 * /api/courses/by-course-id/{courseID}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course by courseID (user-provided)
 *     parameters:
 *       - in: path
 *         name: courseID
 *         required: true
 *         schema: { type: string }
 *         description: IT/EN/BS + 4 digits
 *         example: "IT4020"
 *     responses:
 *       200:
 *         description: Course found
 */

/**
 * @swagger
 * /api/lecturers:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get all lecturers
 *     responses:
 *       200:
 *         description: List of lecturers
 *   post:
 *     tags: [Lecturers]
 *     summary: Create a lecturer
 *     description: |
 *       ID is auto-generated (UUID). lecturerID must be IT/EN/BS + 4 digits.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lecturerID, name, email, specialization, department]
 *             properties:
 *               lecturerID:
 *                 type: string
 *                 description: IT/EN/BS + 4 digits
 *                 example: "IT1002"
 *               name:
 *                 type: string
 *                 example: "Dr. John Smith"
 *               email:
 *                 type: string
 *                 example: "john@uni.lk"
 *               specialization:
 *                 type: string
 *                 example: "Artificial Intelligence"
 *               department:
 *                 type: string
 *                 example: "IT"
 *     responses:
 *       201:
 *         description: Lecturer created
 */

/**
 * @swagger
 * /api/lecturers/{id}:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get lecturer by ID (UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lecturer found
 *   put:
 *     tags: [Lecturers]
 *     summary: Update lecturer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               specialization: { type: string }
 *               department: { type: string }
 *     responses:
 *       200:
 *         description: Lecturer updated
 *   delete:
 *     tags: [Lecturers]
 *     summary: Delete lecturer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lecturer deleted
 */

/**
 * @swagger
 * /api/lecturers/by-lecturer-id/{lecturerID}:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get lecturer by lecturerID (user-provided)
 *     parameters:
 *       - in: path
 *         name: lecturerID
 *         required: true
 *         schema: { type: string }
 *         description: IT/EN/BS + 4 digits
 *         example: "IT1001"
 *     responses:
 *       200:
 *         description: Lecturer found
 */

/**
 * @swagger
 * /api/results:
 *   get:
 *     tags: [Results]
 *     summary: Get all results
 *     responses:
 *       200:
 *         description: List of results
 *   post:
 *     tags: [Results]
 *     summary: Create a result
 *     description: |
 *       Grade is AUTO-CALCULATED from marks:
 *       - A+: 90-100, A: 80-89, A-: 75-79
 *       - B+: 70-74, B: 65-69, B-: 60-64
 *       - C+: 55-59, C: 45-54, C-: below 45
 *       
 *       studentID and courseID must already exist in their respective services.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentID, courseID, marks, semester]
 *             properties:
 *               studentID:
 *                 type: string
 *                 description: Must exist in Student Service
 *                 example: "IT12345678"
 *               courseID:
 *                 type: string
 *                 description: Must exist in Course Service
 *                 example: "IT4020"
 *               marks:
 *                 type: number
 *                 description: 0-100, grade auto-calculated
 *                 example: 85
 *               semester:
 *                 type: string
 *                 enum: [y1s1, y1s2, y2s1, y2s2, y3s1, y3s2, y4s1, y4s2]
 *                 example: "y1s1"
 *     responses:
 *       201:
 *         description: Result created with auto-calculated grade
 */

/**
 * @swagger
 * /api/results/{id}:
 *   get:
 *     tags: [Results]
 *     summary: Get result by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Result found
 *   put:
 *     tags: [Results]
 *     summary: Update result (grade auto-recalculated if marks change)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marks:
 *                 type: number
 *                 description: Grade will be auto-recalculated
 *               semester: { type: string }
 *     responses:
 *       200:
 *         description: Result updated
 *   delete:
 *     tags: [Results]
 *     summary: Delete result
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Result deleted
 */

/**
 * @swagger
 * /api/results/student/{studentID}:
 *   get:
 *     tags: [Results]
 *     summary: Get all results for a student
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema: { type: string }
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Student results
 */

/**
 * @swagger
 * /api/results/calculate-grade/{marks}:
 *   get:
 *     tags: [Results]
 *     summary: Calculate grade from marks (utility endpoint)
 *     parameters:
 *       - in: path
 *         name: marks
 *         required: true
 *         schema: { type: number }
 *         example: 85
 *     responses:
 *       200:
 *         description: Calculated grade with grading scale
 */

/**
 * @swagger
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments
 *     responses:
 *       200:
 *         description: List of payments
 *   post:
 *     tags: [Payments]
 *     summary: Create a payment record
 *     description: |
 *       Status must be Paid, Pending, or Overdue.
 *       paidDate is required when status is "Paid".
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentID, amount, status, semester, description]
 *             properties:
 *               studentID:
 *                 type: string
 *                 example: "IT12345678"
 *               amount:
 *                 type: number
 *                 example: 75000.00
 *               status:
 *                 type: string
 *                 enum: [Paid, Pending, Overdue]
 *                 example: "Pending"
 *               semester:
 *                 type: string
 *                 description: Format YYYY/S1 or YYYY/S2
 *                 example: "2026/S1"
 *               paidDate:
 *                 type: string
 *                 description: Required if status is "Paid"
 *                 example: "2026-01-15"
 *               description:
 *                 type: string
 *                 example: "Semester Fee"
 *     responses:
 *       201:
 *         description: Payment created
 */

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment found
 *   put:
 *     tags: [Payments]
 *     summary: Update payment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               status:
 *                 type: string
 *                 enum: [Paid, Pending, Overdue]
 *               paidDate: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Payment updated
 *   delete:
 *     tags: [Payments]
 *     summary: Delete payment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment deleted
 */

/**
 * @swagger
 * /api/payments/student/{studentID}:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments for a student
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema: { type: string }
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Student payments
 */

/**
 * @swagger
 * /api/payments/status/{status}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payments by status
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Paid, Pending, Overdue]
 *     responses:
 *       200:
 *         description: Payments filtered by status
 */

// ── Gateway info ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "University Management System — API Gateway",
    version: "1.0.0",
    description: "Start each service manually with 'npm start' in their folders",
    routes: {
      students:  "/api/students  → http://localhost:3001 (studentID: IT/EN/BS + 8 digits)",
      courses:   "/api/courses   → http://localhost:3002 (courseID: IT/EN/BS + 4 digits)",
      lecturers: "/api/lecturers → http://localhost:3003 (lecturerID: IT/EN/BS + 4 digits)",
      results:   "/api/results   → http://localhost:3004 (grade auto-calculated from marks)",
      payments:  "/api/payments  → http://localhost:3005 (status: Paid/Pending/Overdue)",
    },
    swagger: "http://localhost:3000/api-docs",
    startup: {
      step1: "cd student-service && npm start",
      step2: "cd course-service && npm start",
      step3: "cd lecturer-service && npm start",
      step4: "cd result-service && npm start",
      step5: "cd payment-service && npm start",
      step6: "cd api-gateway && npm start",
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ service: "api-gateway", status: "UP", timestamp: new Date().toISOString() });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Gateway] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on http://localhost:${PORT}`);
  console.log(`📄 Gateway Swagger:  http://localhost:${PORT}/api-docs`);
  console.log(`\n📡 Routing table:`);
  console.log(`   /api/students  → Student Service  (${SERVICES.student})`);
  console.log(`   /api/courses   → Course Service   (${SERVICES.course})`);
  console.log(`   /api/lecturers → Lecturer Service (${SERVICES.lecturer})`);
  console.log(`   /api/results   → Result Service   (${SERVICES.result})`);
  console.log(`   /api/payments  → Payment Service  (${SERVICES.payment})`);
  console.log(`\n🚀 Start each service manually with 'npm start' in their folders`);
});
