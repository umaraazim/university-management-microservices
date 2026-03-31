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

function validateStudentID(studentID) {
  const validPrefixes = ["IT", "EN", "BS"];
  if (!studentID || typeof studentID !== "string") {
    return { valid: false, message: "studentID is required and must be a string" };
  }
  
  const prefix = studentID.substring(0, 2).toUpperCase();
  if (!validPrefixes.includes(prefix)) {
    return { 
      valid: false, 
      message: `studentID must start with IT, EN, or BS (got: ${studentID})` 
    };
  }
  
  // Check that it has exactly 8 digits after the prefix
  const numericPart = studentID.substring(2);
  if (!/^\d{8}$/.test(numericPart)) {
    return { 
      valid: false, 
      message: `studentID must have exactly 8 digits after the prefix (e.g., IT12345678). Got: ${studentID}` 
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

function validateAge(age) {
  if (age === undefined || age === null) {
    return { valid: false, message: "Age is required" };
  }
  if (typeof age !== "number" || isNaN(age)) {
    return { valid: false, message: "Age must be a valid number" };
  }
  if (age < 16 || age > 100) {
    return { valid: false, message: "Age must be between 16 and 100" };
  }
  return { valid: true };
}

// ── In-memory store ──────────────────────────────────────────────────────────
let students = [
  { id: uuidv4(), studentID: "IT12345678", name: "Kamal Perera", email: "kamal@uni.lk", age: 22, department: "IT" },
  { id: uuidv4(), studentID: "EN87654321", name: "Nimal Silva",  email: "nimal@uni.lk", age: 23, department: "Engineering" },
  { id: uuidv4(), studentID: "BS11223344", name: "Saman Fernando", email: "saman@uni.lk", age: 21, department: "Business Studies" },
];

// ── Swagger config ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Student Service API",
      version: "1.0.0",
      description: "Microservice for managing university students. ID is auto-generated, studentID is user-provided.",
    },
    servers: [{ url: "http://localhost:3001", description: "Direct" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Students
 *   description: Student management endpoints
 */

/**
 * @swagger
 * /students:
 *   get:
 *     tags: [Students]
 *     summary: Get all students
 *     responses:
 *       200:
 *         description: List of all students
 */
app.get("/students", (req, res) => {
  res.json({ success: true, data: students });
});

/**
 * @swagger
 * /students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get a student by ID (auto-generated UUID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Auto-generated UUID
 *     responses:
 *       200:
 *         description: Student found
 *       404:
 *         description: Student not found
 */
app.get("/students/:id", (req, res) => {
  const student = students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, data: student });
});

/**
 * @swagger
 * /students/by-student-id/{studentID}:
 *   get:
 *     tags: [Students]
 *     summary: Get a student by studentID (user-provided, e.g., IT12345678)
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema:
 *           type: string
 *         description: User-provided studentID (IT/EN/BS + 8 digits)
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Student found
 *       404:
 *         description: Student not found
 */
app.get("/students/by-student-id/:studentID", (req, res) => {
  const student = students.find((s) => s.studentID === req.params.studentID);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, data: student });
});

/**
 * @swagger
 * /students:
 *   post:
 *     tags: [Students]
 *     summary: Create a new student
 *     description: |
 *       Creates a new student. ID is auto-generated (UUID). Validates:
 *       - studentID must be PREFIX + 8 digits (e.g., IT12345678, EN87654321, BS11223344)
 *       - Email must be valid format
 *       - Age must be between 16 and 100
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
 *                 description: Student ID (must be IT/EN/BS + 8 digits, e.g., IT12345678)
 *                 example: "IT99887766"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@uni.lk"
 *               age:
 *                 type: integer
 *                 minimum: 16
 *                 maximum: 100
 *                 example: 22
 *               department:
 *                 type: string
 *                 example: "IT"
 *     responses:
 *       201:
 *         description: Student created successfully
 *       400:
 *         description: Validation error
 */
app.post("/students", (req, res) => {
  const { studentID, name, email, age, department } = req.body;
  
  // Check required fields
  if (!studentID || !name || !email || age === undefined || !department) {
    return res.status(400).json({ 
      success: false, 
      message: "All fields required: studentID, name, email, age, department" 
    });
  }

  // Validate studentID format
  const idValidation = validateStudentID(studentID);
  if (!idValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: idValidation.message 
    });
  }

  // Check for duplicate studentID
  const existingStudent = students.find((s) => s.studentID === studentID);
  if (existingStudent) {
    return res.status(400).json({ 
      success: false, 
      message: `Student with studentID ${studentID} already exists` 
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
  const existingEmail = students.find((s) => s.email === email);
  if (existingEmail) {
    return res.status(400).json({ 
      success: false, 
      message: `Email ${email} is already registered` 
    });
  }

  // Validate age
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: ageValidation.message 
    });
  }

  const newStudent = { id: uuidv4(), studentID, name, email, age, department };
  students.push(newStudent);
  res.status(201).json({ success: true, data: newStudent });
});

/**
 * @swagger
 * /students/{id}:
 *   put:
 *     tags: [Students]
 *     summary: Update a student
 *     description: |
 *       Updates an existing student with validation:
 *       - Email must be valid format if provided
 *       - Age must be between 16 and 100 if provided
 *       - ID and studentID cannot be changed
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
 *               age:
 *                 type: integer
 *                 minimum: 16
 *                 maximum: 100
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Student updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Student not found
 */
app.put("/students/:id", (req, res) => {
  const idx = students.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Student not found" });
  }

  const { email, age, id, studentID } = req.body;

  // Prevent ID change
  if (id && id !== req.params.id) {
    return res.status(400).json({ 
      success: false, 
      message: "ID cannot be changed" 
    });
  }

  // Prevent studentID change
  if (studentID && studentID !== students[idx].studentID) {
    return res.status(400).json({ 
      success: false, 
      message: "studentID cannot be changed" 
    });
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
    
    // Check for duplicate email (excluding current student)
    const existingEmail = students.find((s) => s.email === email && s.id !== req.params.id);
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: `Email ${email} is already registered to another student` 
      });
    }
  }

  // Validate age if provided
  if (age !== undefined) {
    const ageValidation = validateAge(age);
    if (!ageValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: ageValidation.message 
      });
    }
  }

  students[idx] = { ...students[idx], ...req.body, id: req.params.id, studentID: students[idx].studentID };
  res.json({ success: true, data: students[idx] });
});

/**
 * @swagger
 * /students/{id}:
 *   delete:
 *     tags: [Students]
 *     summary: Delete a student
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student deleted
 *       404:
 *         description: Student not found
 */
app.delete("/students/:id", (req, res) => {
  const idx = students.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Student not found" });
  students.splice(idx, 1);
  res.json({ success: true, message: "Student deleted successfully" });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ service: "student-service", status: "UP", timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Student Service] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Student Service running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs:     http://localhost:${PORT}/api-docs`);
});
