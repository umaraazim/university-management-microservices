require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { v4: uuidv4 } = require("uuid");

const app = express();

// ── Service URLs for cross-validation ─────────────────────────────────────────
const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || "http://localhost:3001";
const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || "http://localhost:3002";

// ── CORS Configuration ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
const VALID_SEMESTERS = ["y1s1", "y1s2", "y2s1", "y2s2", "y3s1", "y3s2", "y4s1", "y4s2"];

// Grade calculation based on marks (as specified by user)
function calculateGradeFromMarks(marks) {
  if (marks >= 90 && marks <= 100) return "A+";
  if (marks >= 80 && marks <= 89) return "A";
  if (marks >= 75 && marks <= 79) return "A-";
  if (marks >= 70 && marks <= 74) return "B+";
  if (marks >= 65 && marks <= 69) return "B";
  if (marks >= 60 && marks <= 64) return "B-";
  if (marks >= 55 && marks <= 59) return "C+";
  if (marks >= 45 && marks <= 54) return "C";
  if (marks >= 0 && marks < 45) return "C-";
  return null;
}

function validateStudentID(studentID) {
  const validPrefixes = ["IT", "EN", "BS"];
  if (!studentID || typeof studentID !== "string") {
    return { valid: false, message: "studentID is required" };
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

function validateCourseID(courseID) {
  const validPrefixes = ["IT", "EN", "BS"];
  if (!courseID || typeof courseID !== "string") {
    return { valid: false, message: "courseID is required" };
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

function validateSemester(semester) {
  if (!semester || typeof semester !== "string") {
    return { valid: false, message: "Semester is required" };
  }
  
  const semesterLower = semester.toLowerCase();
  if (!VALID_SEMESTERS.includes(semesterLower)) {
    return { 
      valid: false, 
      message: `Invalid semester. Must be one of: ${VALID_SEMESTERS.join(", ")} (case-insensitive). Got: ${semester}` 
    };
  }
  
  return { valid: true, normalized: semesterLower };
}

function validateMarks(marks) {
  if (marks === undefined || marks === null) {
    return { valid: false, message: "Marks are required" };
  }
  if (typeof marks !== "number" || isNaN(marks)) {
    return { valid: false, message: "Marks must be a valid number" };
  }
  if (marks < 0) {
    return { valid: false, message: "Marks cannot be negative (must be 0-100)" };
  }
  if (marks > 100) {
    return { valid: false, message: "Marks cannot exceed 100 (must be 0-100)" };
  }
  return { valid: true };
}

// ── Cross-service validation helpers ──────────────────────────────────────────
async function validateStudentExists(studentID) {
  try {
    const response = await axios.get(`${STUDENT_SERVICE_URL}/students/by-student-id/${studentID}`);
    return { exists: response.data.success, data: response.data.data };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { exists: false };
    }
    console.error(`[Result Service] Error validating student: ${error.message}`);
    return { exists: false, error: "Unable to validate student" };
  }
}

async function validateCourseExists(courseID) {
  try {
    const response = await axios.get(`${COURSE_SERVICE_URL}/courses/by-course-id/${courseID}`);
    return { exists: response.data.success, data: response.data.data };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { exists: false };
    }
    console.error(`[Result Service] Error validating course: ${error.message}`);
    return { exists: false, error: "Unable to validate course" };
  }
}

// ── In-memory store ──────────────────────────────────────────────────────────
let results = [
  { id: uuidv4(), studentID: "IT12345678", courseID: "IT4020", grade: "A",  marks: 85, semester: "y1s1" },
  { id: uuidv4(), studentID: "EN87654321", courseID: "EN3010", grade: "A-", marks: 76, semester: "y1s2" },
];

// ── Swagger config ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Result Service API",
      version: "1.0.0",
      description: "Microservice for managing student exam results. Grade is auto-calculated from marks.",
    },
    servers: [{ url: "http://localhost:3004", description: "Direct" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Results
 *   description: Result management endpoints
 */

/**
 * @swagger
 * /results:
 *   get:
 *     tags: [Results]
 *     summary: Get all results
 *     responses:
 *       200:
 *         description: List of all results
 */
app.get("/results", (req, res) => {
  res.json({ success: true, data: results });
});

/**
 * @swagger
 * /results/{id}:
 *   get:
 *     tags: [Results]
 *     summary: Get a result by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Result found
 *       404:
 *         description: Result not found
 */
app.get("/results/:id", (req, res) => {
  const result = results.find((r) => r.id === req.params.id);
  if (!result) return res.status(404).json({ success: false, message: "Result not found" });
  res.json({ success: true, data: result });
});

/**
 * @swagger
 * /results/student/{studentID}:
 *   get:
 *     tags: [Results]
 *     summary: Get all results for a student
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema:
 *           type: string
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Results for the student
 */
app.get("/results/student/:studentID", (req, res) => {
  const studentResults = results.filter((r) => r.studentID === req.params.studentID);
  res.json({ success: true, data: studentResults });
});

/**
 * @swagger
 * /results/calculate-grade/{marks}:
 *   get:
 *     tags: [Results]
 *     summary: Calculate grade from marks
 *     description: |
 *       Returns the grade that corresponds to given marks based on the grading scale:
 *       - A+: 90-100
 *       - A: 80-89
 *       - A-: 75-79
 *       - B+: 70-74
 *       - B: 65-69
 *       - B-: 60-64
 *       - C+: 55-59
 *       - C: 45-54
 *       - C-: 0-44
 *     parameters:
 *       - in: path
 *         name: marks
 *         required: true
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Grade calculated successfully
 *       400:
 *         description: Invalid marks value
 */
app.get("/results/calculate-grade/:marks", (req, res) => {
  const marks = parseFloat(req.params.marks);
  
  const marksValidation = validateMarks(marks);
  if (!marksValidation.valid) {
    return res.status(400).json({ 
      success: false, 
      message: marksValidation.message 
    });
  }

  const grade = calculateGradeFromMarks(marks);
  res.json({ 
    success: true, 
    data: { 
      marks, 
      grade,
      scale: {
        "A+": "90-100",
        "A": "80-89",
        "A-": "75-79",
        "B+": "70-74",
        "B": "65-69",
        "B-": "60-64",
        "C+": "55-59",
        "C": "45-54",
        "C-": "below 45"
      }
    } 
  });
});

/**
 * @swagger
 * /results:
 *   post:
 *     tags: [Results]
 *     summary: Create a new result
 *     description: |
 *       Creates a new result. Grade is AUTO-CALCULATED from marks:
 *       - A+: 90-100
 *       - A: 80-89
 *       - A-: 75-79
 *       - B+: 70-74
 *       - B: 65-69
 *       - B-: 60-64
 *       - C+: 55-59
 *       - C: 45-54
 *       - C-: below 45
 *       
 *       Validates:
 *       - studentID must be PREFIX + 8 digits (e.g., IT12345678)
 *       - courseID must be PREFIX + 4 digits (e.g., IT1234)
 *       - Semester must be y1s1, y1s2, y2s1, y2s2, y3s1, y3s2, y4s1, or y4s2
 *       - Marks must be 0-100
 *       - No duplicate results for same student + course combination
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
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Grade will be auto-calculated
 *                 example: 85
 *               semester:
 *                 type: string
 *                 enum: [y1s1, y1s2, y2s1, y2s2, y3s1, y3s2, y4s1, y4s2]
 *                 example: "y1s1"
 *     responses:
 *       201:
 *         description: Result created successfully with auto-calculated grade
 *       400:
 *         description: Validation error
 */
app.post("/results", async (req, res) => {
  try {
    const { studentID, courseID, marks, semester } = req.body;
    
    // Check required fields (grade is NOT required - it's auto-calculated)
    if (!studentID || !courseID || marks === undefined || !semester) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields required: studentID, courseID, marks, semester (grade is auto-calculated)" 
      });
    }

    // Validate studentID format
    const studentIDValidation = validateStudentID(studentID);
    if (!studentIDValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: studentIDValidation.message 
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

    // Validate semester
    const semesterValidation = validateSemester(semester);
    if (!semesterValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: semesterValidation.message 
      });
    }

    // Validate marks
    const marksValidation = validateMarks(marks);
    if (!marksValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: marksValidation.message 
      });
    }

    // Cross-service validation: Check if student exists
    const studentCheck = await validateStudentExists(studentID);
    if (studentCheck.error) {
      return res.status(503).json({ 
        success: false, 
        message: `Cannot validate student: ${studentCheck.error}. Please ensure student-service is running.` 
      });
    }
    if (!studentCheck.exists) {
      return res.status(400).json({ 
        success: false, 
        message: `Student with ID ${studentID} does not exist in the system. Please create the student first.` 
      });
    }

    // Cross-service validation: Check if course exists
    const courseCheck = await validateCourseExists(courseID);
    if (courseCheck.error) {
      return res.status(503).json({ 
        success: false, 
        message: `Cannot validate course: ${courseCheck.error}. Please ensure course-service is running.` 
      });
    }
    if (!courseCheck.exists) {
      return res.status(400).json({ 
        success: false, 
        message: `Course with ID ${courseID} does not exist in the system. Please create the course first.` 
      });
    }

    // Auto-calculate grade from marks
    const grade = calculateGradeFromMarks(marks);

    // Check for duplicate result (same student + course)
    const duplicate = results.find(
      r => r.studentID === studentID && r.courseID === courseID
    );
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Student ${studentID} already has a result for course ${courseID}. A student can only have one result per course.`
      });
    }

    const newResult = { id: uuidv4(), studentID, courseID, grade, marks, semester: semesterValidation.normalized };
    results.push(newResult);
    res.status(201).json({ success: true, data: newResult });
  } catch (error) {
    console.error(`[Result Service] POST /results error: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @swagger
 * /results/{id}:
 *   put:
 *     tags: [Results]
 *     summary: Update a result
 *     description: |
 *       Updates an existing result. If marks are updated, grade is auto-recalculated.
 *       - Marks must be 0-100
 *       - studentID and courseID cannot be changed
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marks:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Grade will be auto-recalculated if marks change
 *               semester:
 *                 type: string
 *                 enum: [y1s1, y1s2, y2s1, y2s2, y3s1, y3s2, y4s1, y4s2]
 *     responses:
 *       200:
 *         description: Result updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Result not found
 */
app.put("/results/:id", (req, res) => {
  const idx = results.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Result not found" });
  }

  const { marks, semester, studentID, courseID } = req.body;
  const updatedResult = { ...results[idx] };

  // Prevent studentID change
  if (studentID && studentID !== results[idx].studentID) {
    return res.status(400).json({ 
      success: false, 
      message: "studentID cannot be changed" 
    });
  }

  // Prevent courseID change
  if (courseID && courseID !== results[idx].courseID) {
    return res.status(400).json({ 
      success: false, 
      message: "courseID cannot be changed" 
    });
  }

  // Validate and update marks if provided, then auto-calculate grade
  if (marks !== undefined) {
    const marksValidation = validateMarks(marks);
    if (!marksValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: marksValidation.message 
      });
    }
    updatedResult.marks = marks;
    updatedResult.grade = calculateGradeFromMarks(marks);
  }

  // Update semester if provided
  if (semester !== undefined) {
    const semesterValidation = validateSemester(semester);
    if (!semesterValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: semesterValidation.message 
      });
    }
    updatedResult.semester = semesterValidation.normalized;
  }

  results[idx] = updatedResult;
  res.json({ success: true, data: results[idx] });
});

/**
 * @swagger
 * /results/{id}:
 *   delete:
 *     tags: [Results]
 *     summary: Delete a result
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Result deleted
 *       404:
 *         description: Result not found
 */
app.delete("/results/:id", (req, res) => {
  const idx = results.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Result not found" });
  results.splice(idx, 1);
  res.json({ success: true, message: "Result deleted successfully" });
});

app.get("/health", (req, res) => res.json({ service: "result-service", status: "UP", timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Result Service] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`✅ Result Service running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs:     http://localhost:${PORT}/api-docs`);
});
