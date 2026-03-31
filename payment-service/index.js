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

// ── CORS Configuration ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_STATUSES = ["Paid", "Pending", "Overdue"];

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

function validateAmount(amount) {
  if (amount === undefined || amount === null) {
    return { valid: false, message: "Amount is required" };
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, message: "Amount must be a valid number" };
  }
  if (amount <= 0) {
    return { valid: false, message: "Amount must be greater than 0" };
  }
  return { valid: true };
}

function validateStatus(status) {
  if (!status || typeof status !== "string") {
    return { valid: false, message: "Status is required" };
  }
  
  // Case-insensitive check but return normalized value
  const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  if (!VALID_STATUSES.includes(statusCapitalized)) {
    return { 
      valid: false, 
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")} (case-insensitive). Got: ${status}` 
    };
  }
  
  return { valid: true, normalized: statusCapitalized };
}

function validatePaidDate(paidDate, status) {
  if (status === "Paid" && !paidDate) {
    return { valid: false, message: "paidDate is required when status is 'Paid'" };
  }
  if (paidDate) {
    const date = new Date(paidDate);
    if (isNaN(date.getTime())) {
      return { valid: false, message: "paidDate must be a valid date format (e.g., 2026-01-15)" };
    }
  }
  return { valid: true };
}

function validateSemester(semester) {
  if (!semester || typeof semester !== "string") {
    return { valid: false, message: "Semester is required" };
  }
  // Semester format: YYYY/S1 or YYYY/S2
  if (!/^\d{4}\/S[12]$/.test(semester)) {
    return { 
      valid: false, 
      message: `Semester must be in format YYYY/S1 or YYYY/S2 (e.g., 2026/S1). Got: ${semester}` 
    };
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
    console.error(`[Payment Service] Error validating student: ${error.message}`);
    return { exists: false, error: "Unable to validate student" };
  }
}

// ── In-memory store ──────────────────────────────────────────────────────────
let payments = [
  { id: uuidv4(), studentID: "IT12345678", amount: 75000.00, status: "Paid",    semester: "2026/S1", paidDate: "2026-01-15", description: "Semester Fee" },
  { id: uuidv4(), studentID: "EN87654321", amount: 75000.00, status: "Pending", semester: "2026/S1", paidDate: null,         description: "Semester Fee" },
  { id: uuidv4(), studentID: "BS11223344", amount: 50000.00, status: "Overdue", semester: "2025/S2", paidDate: null,         description: "Library Fee" },
];

// ── Swagger config ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Payment Service API",
      version: "1.0.0",
      description: "Microservice for managing university student payments",
    },
    servers: [{ url: "http://localhost:3005", description: "Direct" }],
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management endpoints
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments
 *     responses:
 *       200:
 *         description: List of all payments
 */
app.get("/payments", (req, res) => {
  res.json({ success: true, data: payments });
});

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get a payment by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment found
 *       404:
 *         description: Payment not found
 */
app.get("/payments/:id", (req, res) => {
  const payment = payments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
  res.json({ success: true, data: payment });
});

/**
 * @swagger
 * /payments/student/{studentID}:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments for a student
 *     parameters:
 *       - in: path
 *         name: studentID
 *         required: true
 *         schema:
 *           type: string
 *         example: "IT12345678"
 *     responses:
 *       200:
 *         description: Payments for the student
 */
app.get("/payments/student/:studentID", (req, res) => {
  const studentPayments = payments.filter((p) => p.studentID === req.params.studentID);
  res.json({ success: true, data: studentPayments });
});

/**
 * @swagger
 * /payments/status/{status}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payments by status (Paid / Pending / Overdue)
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
app.get("/payments/status/:status", (req, res) => {
  const filtered = payments.filter(
    (p) => p.status.toLowerCase() === req.params.status.toLowerCase()
  );
  res.json({ success: true, data: filtered });
});

/**
 * @swagger
 * /payments:
 *   post:
 *     tags: [Payments]
 *     summary: Create a new payment record
 *     description: |
 *       Creates a new payment record. Validates:
 *       - studentID must be PREFIX + 8 digits (e.g., IT12345678)
 *       - Amount must be greater than 0
 *       - Status must be Paid, Pending, or Overdue
 *       - paidDate is required when status is "Paid"
 *       - Semester format: YYYY/S1 or YYYY/S2
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
 *                 description: Must exist in Student Service
 *                 example: "IT12345678"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
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
 *                 nullable: true
 *                 description: Required if status is "Paid"
 *                 example: "2026-01-15"
 *               description:
 *                 type: string
 *                 example: "Semester Fee"
 *     responses:
 *       201:
 *         description: Payment created
 *       400:
 *         description: Validation error
 */
app.post("/payments", async (req, res) => {
  try {
    const { studentID, amount, status, semester, paidDate, description } = req.body;
    
    // Check required fields
    if (!studentID || amount === undefined || !status || !semester || !description) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields required: studentID, amount, status, semester, description" 
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

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: amountValidation.message 
      });
    }

    // Validate status
    const statusValidation = validateStatus(status);
    if (!statusValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: statusValidation.message 
      });
    }

    // Validate semester format
    const semesterValidation = validateSemester(semester);
    if (!semesterValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: semesterValidation.message 
      });
    }

    // Validate paidDate
    const paidDateValidation = validatePaidDate(paidDate, statusValidation.normalized);
    if (!paidDateValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: paidDateValidation.message 
      });
    }

    const newPayment = { 
      id: uuidv4(), 
      studentID, 
      amount, 
      status: statusValidation.normalized, 
      semester, 
      paidDate: paidDate || null, 
      description 
    };
    payments.push(newPayment);
    res.status(201).json({ success: true, data: newPayment });
  } catch (error) {
    console.error(`[Payment Service] POST /payments error: ${error.message}`);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @swagger
 * /payments/{id}:
 *   put:
 *     tags: [Payments]
 *     summary: Update a payment (e.g. mark as Paid)
 *     description: |
 *       Updates an existing payment. Validates:
 *       - Amount must be greater than 0 if provided
 *       - Status must be Paid, Pending, or Overdue if provided
 *       - paidDate is required when changing status to "Paid"
 *       - studentID cannot be changed
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
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               status:
 *                 type: string
 *                 enum: [Paid, Pending, Overdue]
 *               paidDate:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Payment not found
 */
app.put("/payments/:id", (req, res) => {
  const idx = payments.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Payment not found" });

  const { studentID, amount, status, paidDate } = req.body;
  const updatedPayment = { ...payments[idx] };

  // Prevent studentID change
  if (studentID && studentID !== payments[idx].studentID) {
    return res.status(400).json({ 
      success: false, 
      message: "studentID cannot be changed" 
    });
  }

  // Validate amount if provided
  if (amount !== undefined) {
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: amountValidation.message 
      });
    }
    updatedPayment.amount = amount;
  }

  // Validate status if provided
  if (status !== undefined) {
    const statusValidation = validateStatus(status);
    if (!statusValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: statusValidation.message 
      });
    }
    updatedPayment.status = statusValidation.normalized;
  }

  // Update paidDate if provided
  if (paidDate !== undefined) {
    if (paidDate) {
      const date = new Date(paidDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "paidDate must be a valid date format (e.g., 2026-01-15)" 
        });
      }
    }
    updatedPayment.paidDate = paidDate || null;
  }

  // Validate paidDate requirement if status is Paid
  if (updatedPayment.status === "Paid" && !updatedPayment.paidDate) {
    return res.status(400).json({ 
      success: false, 
      message: "paidDate is required when status is 'Paid'" 
    });
  }

  // Apply other updates
  if (req.body.description !== undefined) {
    updatedPayment.description = req.body.description;
  }

  payments[idx] = updatedPayment;
  res.json({ success: true, data: payments[idx] });
});

/**
 * @swagger
 * /payments/{id}:
 *   delete:
 *     tags: [Payments]
 *     summary: Delete a payment record
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment deleted
 *       404:
 *         description: Payment not found
 */
app.delete("/payments/:id", (req, res) => {
  const idx = payments.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Payment not found" });
  payments.splice(idx, 1);
  res.json({ success: true, message: "Payment deleted successfully" });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ service: "payment-service", status: "UP", timestamp: new Date().toISOString() }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Payment Service] Error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`✅ Payment Service running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs:     http://localhost:${PORT}/api-docs`);
});
