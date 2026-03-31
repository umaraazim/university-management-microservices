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

function validateLecturerID(lecturerID) {
  const validPrefixes = ["IT", "EN", "BS"];
  if (!lecturerID || typeof lecturerID !== "string") {
    return { valid: false, message: "lecturerID is required and must be a string" };
  }
  
  const prefix = lecturerID.substring(0, 2).toUpperCase();
  if (!validPrefixes.includes(prefix)) {
    return { 
      valid: false, 
      message: `lecturerID must start with IT, EN, or BS (got: ${lecturerID})` 
    };
  }
  
  // Check that it has exactly 4 digits after the prefix
  const numericPart = lecturerID.substring(2);
  if (!/^\d{4}$/.test(numericPart)) {
    return { 
      valid: false, 
      message: `lecturerID must have exactly 4 digits after the prefix (e.g., IT1234). Got: ${lecturerID}` 
    };
  }
  
  return { valid: true };
}

function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email is required" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Invalid email format" };
  }
  return { valid: true };
}

function validateName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, message: "Name is required" };
  }
  if (name.trim().length < 2) {
    return { valid: false, message: "Name must be at least 2 characters" };
  }
  return { valid: true };
}

// ── In-memory store ──────────────────────────────────────────────────────────
let lecturers = [
  { id: uuidv4(), lecturerID: "IT1001", name: "Dr. Anjali Fernando", email: "anjali@uni.lk", specialization: "Cloud Computing",  department: "IT" },
  { id: uuidv4(), lecturerID: "EN2001", name: "Prof. Ravi Bandara",  email: "ravi@uni.lk",   specialization: "Machine Learning", department: "Engineering" },
  { id: uuidv4(), lecturerID: "BS3001", name: "Dr. Kumari Silva",    email: "kumari@uni.lk", specialization: "Finance", department: "Business Studies" },
];

// ── Swagger config ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Lecturer Service API",
      version: "1.0.0",
      description: "Microservice for managing university lecturers. ID is auto-generated (UUID), lecturerID is user-provided.",
    },
    servers: [{ url: "http://localhost:3003", description: "Direct" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Lecturers
 *   description: Lecturer management endpoints
 */

/**
 * @swagger
 * /lecturers:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get all lecturers
 *     responses:
 *       200:
 *         description: List of all lecturers
 */
app.get("/lecturers", (req, res) => {
  res.json({ success: true, data: lecturers });
});

/**
 * @swagger
 * /lecturers/{id}:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get a lecturer by ID (auto-generated UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Lecturer found
 *       404:
 *         description: Lecturer not found
 */
app.get("/lecturers/:id", (req, res) => {
  const lecturer = lecturers.find((l) => l.id === req.params.id);
  if (!lecturer) return res.status(404).json({ success: false, message: "Lecturer not found" });
  res.json({ success: true, data: lecturer });
});

/**
 * @swagger
 * /lecturers/by-lecturer-id/{lecturerID}:
 *   get:
 *     tags: [Lecturers]
 *     summary: Get a lecturer by lecturerID (user-provided, e.g., IT1234)
 *     parameters:
 *       - in: path
 *         name: lecturerID
 *         required: true
 *         schema:
 *           type: string
 *         description: User-provided lecturerID (IT/EN/BS + 4 digits)
 *         example: "IT1001"
 *     responses:
 *       200:
 *         description: Lecturer found
 *       404:
 *         description: Lecturer not found
 */
app.get("/lecturers/by-lecturer-id/:lecturerID", (req, res) => {
  const lecturer = lecturers.find((l) => l.lecturerID === req.params.lecturerID);
  if (!lecturer) return res.status(404).json({ success: false, message: "Lecturer not found" });
  res.json({ success: true, data: lecturer });
});

/**
 * @swagger
 * /lecturers:
 *   post:
 *     tags: [Lecturers]
 *     summary: Create a new lecturer
 *     description: |
 *       Creates a new lecturer. ID is auto-generated (UUID). Validates:
 *       - lecturerID must be PREFIX + 4 digits (e.g., IT1234, EN5678, BS9012)
 *       - Email must be valid format and unique
 *       - Name must be at least 2 characters
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
 *                 description: Lecturer ID (IT/EN/BS + 4 digits)
 *                 example: "IT1002"
 *               name:
 *                 type: string
 *                 example: "Dr. John Smith"
 *               email:
 *                 type: string
 *                 format: email
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
 *       400:
 *         description: Validation error
 */
app.post("/lecturers", (req, res) => {
  const { lecturerID, name, email, specialization, department } = req.body;
  
  // Check required fields
  if (!lecturerID || !name || !email || !specialization || !department) {
    return res.status(400).json({ 
      success: false, 
      message: "All fields required: lecturerID, name, email, specialization, department" 
    });
  }

  // Validate lecturerID format
  const lecturerIDValidation = validateLecturerID(lecturerID);
  if (!lecturerIDValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: lecturerIDValidation.message 
    });
  }

  // Check for duplicate lecturerID
  const existingLecturer = lecturers.find((l) => l.lecturerID === lecturerID);
  if (existingLecturer) {
    return res.status(400).json({ 
      success: false, 
      message: `Lecturer with lecturerID ${lecturerID} already exists` 
    });
  }

  // Validate name
  const nameValidation = validateName(name);
  if (!nameValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: nameValidation.message 
    });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: emailValidation.message 
    });
  }

  // Check for duplicate email
  const existingEmail = lecturers.find((l) => l.email === email);
  if (existingEmail) {
    return res.status(400).json({ 
      success: false, 
      message: `Email ${email} is already registered` 
    });
  }

  const newLecturer = { id: uuidv4(), lecturerID, name, email, specialization, department };
  lecturers.push(newLecturer);
  res.status(201).json({ success: true, data: newLecturer });
});

/**
 * @swagger
 * /lecturers/{id}:
 *   put:
 *     tags: [Lecturers]
 *     summary: Update a lecturer
 *     description: |
 *       Updates an existing lecturer. Validates:
 *       - ID and lecturerID cannot be changed
 *       - Email must be valid format if provided
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               specialization:
 *                 type: string
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lecturer updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Lecturer not found
 */
app.put("/lecturers/:id", (req, res) => {
  const idx = lecturers.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Lecturer not found" });

  const { id, lecturerID, email, name } = req.body;

  // Prevent ID change
  if (id && id !== req.params.id) {
    return res.status(400).json({ 
      success: false, 
      message: "ID cannot be changed" 
    });
  }

  // Prevent lecturerID change
  if (lecturerID && lecturerID !== lecturers[idx].lecturerID) {
    return res.status(400).json({ 
      success: false, 
      message: "lecturerID cannot be changed" 
    });
  }

  // Validate name if provided
  if (name !== undefined) {
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: nameValidation.message 
      });
    }
  }

  // Validate email if provided
  if (email !== undefined) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: emailValidation.message 
      });
    }

    // Check for duplicate email (excluding current lecturer)
    const existingEmail = lecturers.find((l) => l.email === email && l.id !== req.params.id);
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: `Email ${email} is already registered to another lecturer` 
      });
    }
  }

  lecturers[idx] = { ...lecturers[idx], ...req.body, id: req.params.id, lecturerID: lecturers[idx].lecturerID };
  res.json({ success: true, data: lecturers[idx] });
});

/**
 * @swagger
 * /lecturers/{id}:
 *   delete:
 *     tags: [Lecturers]
 *     summary: Delete a lecturer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Lecturer deleted
 *       404:
 *         description: Lecturer not found
 */
app.delete("/lecturers/:id", (req, res) => {
  const idx = lecturers.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Lecturer not found" });
  lecturers.splice(idx, 1);
  res.json({ success: true, message: "Lecturer deleted successfully" });
});

app.get("/health", (req, res) => res.json({ service: "lecturer-service", status: "UP", timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Lecturer Service] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`✅ Lecturer Service running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs:     http://localhost:${PORT}/api-docs`);
});
