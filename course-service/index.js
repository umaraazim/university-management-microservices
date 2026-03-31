require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { v4: uuidv4 } = require("uuid");

const app = express();

// ── CORS Configuration ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Validation helpers ───────────────────────────────────────────────────────

function validateCourseID(courseID) {
  const validPrefixes = ["IT", "EN", "BS"];
  if (!courseID || typeof courseID !== "string") {
    return { valid: false, message: "courseID is required and must be a string" };
  }
  
  const prefix = courseID.substring(0, 2).toUpperCase();
  if (!validPrefixes.includes(prefix)) {
    return { 
      valid: false, 
      message: `courseID must start with IT, EN, or BS (got: ${courseID})` 
    };
  }
  
  // Check that it has exactly 4 digits after the prefix
  const numericPart = courseID.substring(2);
  if (!/^\d{4}$/.test(numericPart)) {
    return { 
      valid: false, 
      message: `courseID must have exactly 4 digits after the prefix (e.g., IT1234). Got: ${courseID}` 
    };
  }
  
  return { valid: true };
}

function validateCredits(credits) {
  if (credits === undefined || credits === null) {
    return { valid: false, message: "Credits is required" };
  }
  if (typeof credits !== "number" || isNaN(credits) || !Number.isInteger(credits)) {
    return { valid: false, message: "Credits must be a valid integer" };
  }
  if (credits < 1 || credits > 6) {
    return { valid: false, message: "Credits must be between 1 and 6" };
  }
  return { valid: true };
}

// ── In-memory store ──────────────────────────────────────────────────────────
let courses = [
  { id: uuidv4(), courseID: "IT4020", title: "Modern Topics in IT", credits: 3, department: "IT" },
  { id: uuidv4(), courseID: "EN3010", title: "Data Structures",     credits: 4, department: "Engineering" },
  { id: uuidv4(), courseID: "BS2001", title: "Business Analytics",  credits: 3, department: "Business Studies" },
];

// ── Swagger config ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Course Service API",
      version: "1.0.0",
      description: "Microservice for managing university courses. ID is auto-generated (UUID), courseID is user-provided.",
    },
    servers: [{ url: "http://localhost:3002", description: "Direct" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course management endpoints
 */

/**
 * @swagger
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: Get all courses
 *     responses:
 *       200:
 *         description: List of all courses
 */
app.get("/courses", (req, res) => {
  res.json({ success: true, data: courses });
});

/**
 * @swagger
 * /courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by ID (auto-generated UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Course found
 *       404:
 *         description: Course not found
 */
app.get("/courses/:id", (req, res) => {
  const course = courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });
  res.json({ success: true, data: course });
});

/**
 * @swagger
 * /courses/by-course-id/{courseID}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by courseID (user-provided, e.g., IT1234)
 *     parameters:
 *       - in: path
 *         name: courseID
 *         required: true
 *         schema:
 *           type: string
 *         description: User-provided courseID (IT/EN/BS + 4 digits)
 *         example: "IT4020"
 *     responses:
 *       200:
 *         description: Course found
 *       404:
 *         description: Course not found
 */
app.get("/courses/by-course-id/:courseID", (req, res) => {
  const course = courses.find((c) => c.courseID === req.params.courseID);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });
  res.json({ success: true, data: course });
});

/**
 * @swagger
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a new course
 *     description: |
 *       Creates a new course. ID is auto-generated (UUID). Validates:
 *       - courseID must be PREFIX + 4 digits (e.g., IT1234, EN5678, BS9012)
 *       - Credits must be between 1 and 6
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
 *                 description: Course ID (IT/EN/BS + 4 digits)
 *                 example: "IT4021"
 *               title:
 *                 type: string
 *                 example: "Advanced Programming"
 *               credits:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 6
 *                 example: 3
 *               department:
 *                 type: string
 *                 example: "IT"
 *     responses:
 *       201:
 *         description: Course created
 *       400:
 *         description: Validation error
 */
app.post("/courses", (req, res) => {
  const { courseID, title, credits, department } = req.body;
  
  // Check required fields
  if (!courseID || !title || credits === undefined || !department) {
    return res.status(400).json({ 
      success: false, 
      message: "All fields required: courseID, title, credits, department" 
    });
  }

  // Validate courseID format
  const courseIDValidation = validateCourseID(courseID);
  if (!courseIDValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: courseIDValidation.message 
    });
  }

  // Check for duplicate courseID
  const existingCourse = courses.find((c) => c.courseID === courseID);
  if (existingCourse) {
    return res.status(400).json({ 
      success: false, 
      message: `Course with courseID ${courseID} already exists` 
    });
  }

  // Validate credits
  const creditsValidation = validateCredits(credits);
  if (!creditsValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: creditsValidation.message 
    });
  }

  const newCourse = { id: uuidv4(), courseID, title, credits, department };
  courses.push(newCourse);
  res.status(201).json({ success: true, data: newCourse });
});

/**
 * @swagger
 * /courses/{id}:
 *   put:
 *     tags: [Courses]
 *     summary: Update a course
 *     description: |
 *       Updates an existing course. Validates:
 *       - ID and courseID cannot be changed
 *       - Credits must be between 1 and 6 if provided
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               credits:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 6
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Course updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 */
app.put("/courses/:id", (req, res) => {
  const idx = courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Course not found" });

  const { id, courseID, credits } = req.body;

  // Prevent ID change
  if (id && id !== req.params.id) {
    return res.status(400).json({ 
      success: false, 
      message: "ID cannot be changed" 
    });
  }

  // Prevent courseID change
  if (courseID && courseID !== courses[idx].courseID) {
    return res.status(400).json({ 
      success: false, 
      message: "courseID cannot be changed" 
    });
  }

  // Validate credits if provided
  if (credits !== undefined) {
    const creditsValidation = validateCredits(credits);
    if (!creditsValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: creditsValidation.message 
      });
    }
  }

  courses[idx] = { ...courses[idx], ...req.body, id: req.params.id, courseID: courses[idx].courseID };
  res.json({ success: true, data: courses[idx] });
});

/**
 * @swagger
 * /courses/{id}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Course deleted
 *       404:
 *         description: Course not found
 */
app.delete("/courses/:id", (req, res) => {
  const idx = courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Course not found" });
  courses.splice(idx, 1);
  res.json({ success: true, message: "Course deleted successfully" });
});

app.get("/health", (req, res) => res.json({ service: "course-service", status: "UP", timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Course Service] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Course Service running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs:     http://localhost:${PORT}/api-docs`);
});
