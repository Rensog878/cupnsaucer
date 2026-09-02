const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// =====================================================
// OTP SETTINGS
// =====================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

// -----------------------------------------------------
// OTP resend cooldown
// -----------------------------------------------------
// Stores the last successful OTP send time for each
// normalized phone number.
//
// IMPORTANT:
// This is suitable for your current single Render
// backend instance. For a multi-instance production
// setup, move this cooldown to MongoDB/Redis.
// -----------------------------------------------------

const otpCooldowns = new Map();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =====================================================
// RAZORPAY
// =====================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =====================================================
// BASIC ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WhatsApp OTP + Razorpay API is running",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
  });
});

// =====================================================
// HELPER: NORMALIZE PHONE NUMBER
// =====================================================

function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  let number = String(phone).trim();

  // Remove spaces, -, brackets, +, etc.
  number = number.replace(/\D/g, "");

  // India:
  // 6369879061 -> 916369879061
  if (number.length === 10) {
    number = "91" + number;
  }

  // 0916369879061 -> 916369879061
  if (number.startsWith("0")) {
    number = number.substring(1);
  }

  // Already starts with 91
  if (
    number.startsWith("91") &&
    number.length === 12
  ) {
    return "+" + number;
  }

  // General international number
  if (
    number.length >= 11 &&
    number.length <= 15
  ) {
    return "+" + number;
  }

  return null;
}

// =====================================================
// OTP COOLDOWN HELPERS
// =====================================================

function getRemainingCooldown(phone) {
  const lastSentAt = otpCooldowns.get(phone);

  if (!lastSentAt) {
    return 0;
  }

  const elapsed = Date.now() - lastSentAt;

  if (elapsed >= OTP_RESEND_COOLDOWN_MS) {
    otpCooldowns.delete(phone);
    return 0;
  }

  return OTP_RESEND_COOLDOWN_MS - elapsed;
}

function getRemainingSeconds(phone) {
  const remainingMs = getRemainingCooldown(phone);

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

// =====================================================
// OTP TOKEN HELPERS
// =====================================================
//
// No database is used for OTP verification.
//
// The OTP is stored inside a signed HttpOnly cookie.
// This works better for the current Render deployment
// than relying only on a server memory Map.
//

function createOtpToken(phone, otp, expiresAt) {
  const payload = `${phone}.${otp}.${expiresAt}`;

  const secret =
    process.env.OTP_SECRET ||
    process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new Error(
      "OTP_SECRET or RAZORPAY_KEY_SECRET is required"
    );
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

function verifyOtpToken(token) {
  try {
    if (!token) {
      return null;
    }

    const parts = token.split(".");

    if (parts.length !== 4) {
      return null;
    }

    const [
      phone,
      otp,
      expiresAtString,
      receivedSignature,
    ] = parts;

    const expiresAt = Number(expiresAtString);

    if (!phone || !otp || !expiresAt) {
      return null;
    }

    // OTP expired
    if (Date.now() > expiresAt) {
      return null;
    }

    const secret =
      process.env.OTP_SECRET ||
      process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return null;
    }

    const payload =
      `${phone}.${otp}.${expiresAt}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const expectedBuffer =
      Buffer.from(expectedSignature, "utf8");

    const receivedBuffer =
      Buffer.from(receivedSignature, "utf8");

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return null;
    }

    const valid = crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );

    if (!valid) {
      return null;
    }

    return {
      phone,
      otp,
      expiresAt,
    };
  } catch (error) {
    console.error("OTP TOKEN ERROR:", error);

    return null;
  }
}

// =====================================================
// COOKIE HELPERS
// =====================================================

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = cookie
      .substring(0, separatorIndex)
      .trim();

    const value = cookie
      .substring(separatorIndex + 1)
      .trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

// =====================================================
// SEND OTP
// =====================================================

app.post("/api/send-otp", async (req, res) => {
  try {
    console.log("================================");
    console.log("SEND OTP REQUEST");
    console.log("================================");

    const { phone } = req.body;

    // -------------------------------------------------
    // Validate phone
    // -------------------------------------------------

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp number is required",
      });
    }

    const whatsappNumber =
      normalizePhone(phone);

    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid WhatsApp number. Enter a valid number.",
      });
    }

    console.log(
      "Normalized WhatsApp number:",
      whatsappNumber
    );

    // -------------------------------------------------
    // CHECK 30 SECOND COOLDOWN
    // -------------------------------------------------

    const remainingSeconds =
      getRemainingSeconds(whatsappNumber);

    if (remainingSeconds > 0) {
      console.log(
        `OTP cooldown active for ${whatsappNumber}: ${remainingSeconds}s`
      );

      return res.status(429).json({
        success: false,
        cooldown: true,
        remainingSeconds,
        message:
          `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      });
    }

    // -------------------------------------------------
    // Check Wasender API key
    // -------------------------------------------------

    if (!process.env.WASENDER_API_KEY) {
      console.error(
        "WASENDER_API_KEY is missing"
      );

      return res.status(500).json({
        success: false,
        message:
          "WasenderAPI configuration is missing",
      });
    }

    // -------------------------------------------------
    // Check OTP secret
    // -------------------------------------------------

    if (
      !process.env.OTP_SECRET &&
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      console.error(
        "OTP_SECRET and RAZORPAY_KEY_SECRET are missing"
      );

      return res.status(500).json({
        success: false,
        message:
          "OTP security configuration is missing",
      });
    }

    // -------------------------------------------------
    // Generate 6 digit OTP
    // -------------------------------------------------

    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    console.log(
      "OTP generated for:",
      whatsappNumber
    );

    // -------------------------------------------------
    // OTP valid for 5 minutes
    // -------------------------------------------------

    const expiresAt =
      Date.now() + OTP_EXPIRY_MS;

    // -------------------------------------------------
    // Create signed OTP token
    // -------------------------------------------------

    const otpToken = createOtpToken(
      whatsappNumber,
      otp,
      expiresAt
    );

    // -------------------------------------------------
    // PROFESSIONAL WHATSAPP OTP MESSAGE
    // -------------------------------------------------

    const message =
      `🔐 Cup & Saucer Login\n\n` +
      `Your verification code is *${otp}*.\n\n` +
      `This code expires in 5 minutes.\n` +
      `Please do not share this code with anyone.`;

    // -------------------------------------------------
    // Send OTP through WasenderAPI
    // -------------------------------------------------

    const wasenderResponse = await fetch(
      "https://www.wasenderapi.com/api/send-message",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.WASENDER_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          to: whatsappNumber,
          text: message,
        }),
      }
    );

    // -------------------------------------------------
    // Read Wasender response safely
    // -------------------------------------------------

    const responseText =
      await wasenderResponse.text();

    let wasenderData = null;

    try {
      wasenderData =
        responseText
          ? JSON.parse(responseText)
          : null;
    } catch {
      wasenderData = {
        raw: responseText,
      };
    }

    console.log(
      "Wasender status:",
      wasenderResponse.status
    );

    console.log(
      "Wasender response:",
      wasenderData
    );

    // -------------------------------------------------
    // Wasender failed
    // -------------------------------------------------

    if (!wasenderResponse.ok) {
      console.error(
        "WasenderAPI failed to send OTP"
      );

      // IMPORTANT:
      // Do NOT start cooldown if WhatsApp sending failed.

      return res.status(500).json({
        success: false,
        message:
          "WasenderAPI failed to send OTP",
        error:
          wasenderData?.message ||
          wasenderData?.error ||
          "Unknown WasenderAPI error",
      });
    }

    // -------------------------------------------------
    // START 30 SECOND COOLDOWN
    // -------------------------------------------------
    //
    // We only start the cooldown AFTER Wasender
    // successfully accepts the OTP request.
    //

    otpCooldowns.set(
      whatsappNumber,
      Date.now()
    );

    // -------------------------------------------------
    // Store OTP in secure HttpOnly cookie
    // -------------------------------------------------

    const cookieParts = [
      `otp_token=${encodeURIComponent(
        otpToken
      )}`,
      "HttpOnly",
      "Path=/",
      "SameSite=None",
      "Max-Age=300",
    ];

    // Cross-site frontend (Vercel) -> backend (Render)
    // requires Secure + SameSite=None in production.

    if (
      process.env.NODE_ENV === "production"
    ) {
      cookieParts.push("Secure");
    }

    res.setHeader(
      "Set-Cookie",
      cookieParts.join("; ")
    );

    // -------------------------------------------------
    // Success
    // -------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "OTP sent successfully to WhatsApp",
      cooldownSeconds: 30,
    });
  } catch (error) {
    console.error(
      "================================"
    );

    console.error(
      "SEND OTP ERROR:",
      error
    );

    console.error(
      "================================"
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
});

// =====================================================
// VERIFY OTP
// =====================================================

app.post("/api/verify-otp", (req, res) => {
  try {
    console.log("VERIFY OTP REQUEST");

    const { phone, otp } = req.body;

    // -------------------------------------------------
    // Validate request
    // -------------------------------------------------

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number and OTP are required",
      });
    }

    const whatsappNumber =
      normalizePhone(phone);

    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    // -------------------------------------------------
    // Get OTP cookie
    // -------------------------------------------------

    const otpToken =
      getCookie(req, "otp_token");

    if (!otpToken) {
      return res.status(400).json({
        success: false,
        message:
          "OTP session not found. Please request a new OTP.",
      });
    }

    // -------------------------------------------------
    // Verify signed token
    // -------------------------------------------------

    const tokenData =
      verifyOtpToken(otpToken);

    if (!tokenData) {
      return res.status(400).json({
        success: false,
        message:
          "OTP expired. Please request a new OTP.",
      });
    }

    // -------------------------------------------------
    // Check phone
    // -------------------------------------------------

    if (
      tokenData.phone !==
      whatsappNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number does not match OTP request",
      });
    }

    // -------------------------------------------------
    // Check OTP
    // -------------------------------------------------

    if (
      String(otp).trim() !==
      String(tokenData.otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // -------------------------------------------------
    // Clear OTP cookie
    // -------------------------------------------------

    res.setHeader(
      "Set-Cookie",
      [
        "otp_token=",
        "HttpOnly",
        "Path=/",
        "Max-Age=0",
        "SameSite=None",
        process.env.NODE_ENV === "production"
          ? "Secure"
          : "",
      ]
        .filter(Boolean)
        .join("; ")
    );

    // -------------------------------------------------
    // LOGIN SUCCESS
    // -------------------------------------------------

    console.log(
      "OTP verification successful:",
      whatsappNumber
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      phone: whatsappNumber,
    });
  } catch (error) {
    console.error(
      "VERIFY OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
});

// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

app.post(
  "/api/create-order",
  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "RAZORPAY CREATE ORDER"
      );

      console.log(
        "Amount received:",
        req.body.amount
      );

      console.log(
        "Key exists:",
        !!process.env.RAZORPAY_KEY_ID
      );

      console.log(
        "Secret exists:",
        !!process.env.RAZORPAY_KEY_SECRET
      );

      console.log(
        "================================"
      );

      const { amount } = req.body;

      // -------------------------------------------------
      // Validate amount
      // -------------------------------------------------

      if (
        amount === undefined ||
        amount === null ||
        Number.isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount",
        });
      }

      // -------------------------------------------------
      // Check Razorpay credentials
      // -------------------------------------------------

      if (
        !process.env.RAZORPAY_KEY_ID ||
        !process.env.RAZORPAY_KEY_SECRET
      ) {
        console.error(
          "Razorpay environment variables missing"
        );

        return res.status(500).json({
          success: false,
          message:
            "Razorpay configuration is missing",
        });
      }

      // -------------------------------------------------
      // INR -> Paise
      // -------------------------------------------------

      const amountInPaise =
        Math.round(
          Number(amount) * 100
        );

      // -------------------------------------------------
      // Create Razorpay order
      // -------------------------------------------------

      const order =
        await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt:
            "receipt_" +
            Date.now(),
        });

      console.log(
        "Razorpay order created:",
        order.id
      );

      return res.status(200).json({
        success: true,

        order: order,

        // Public key can safely be sent
        // to frontend
        key:
          process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "RAZORPAY CREATE ORDER ERROR:"
      );

      console.error(error);

      console.error(
        "================================"
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to create Razorpay order",
        error: error.message,
      });
    }
  }
);

// =====================================================
// VERIFY RAZORPAY PAYMENT
// =====================================================

app.post(
  "/api/verify-payment",
  (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      // -------------------------------------------------
      // Validate fields
      // -------------------------------------------------

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing Razorpay payment details",
        });
      }

      // -------------------------------------------------
      // Check Razorpay secret
      // -------------------------------------------------

      if (
        !process.env.RAZORPAY_KEY_SECRET
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Razorpay secret is missing",
        });
      }

      // -------------------------------------------------
      // Generate Razorpay signature
      // -------------------------------------------------

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env
              .RAZORPAY_KEY_SECRET
          )
          .update(
            razorpay_order_id +
              "|" +
              razorpay_payment_id
          )
          .digest("hex");

      // -------------------------------------------------
      // Compare signatures safely
      // -------------------------------------------------

      const generatedBuffer =
        Buffer.from(
          generatedSignature,
          "utf8"
        );

      const receivedBuffer =
        Buffer.from(
          razorpay_signature,
          "utf8"
        );

      if (
        generatedBuffer.length !==
        receivedBuffer.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed",
        });
      }

      const isValid =
        crypto.timingSafeEqual(
          generatedBuffer,
          receivedBuffer
        );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed",
        });
      }

      // -------------------------------------------------
      // PAYMENT VERIFIED
      // -------------------------------------------------

      console.log(
        "Payment verified:",
        razorpay_payment_id
      );

      return res.status(200).json({
        success: true,

        message:
          "Payment verified successfully",

        paymentId:
          razorpay_payment_id,

        orderId:
          razorpay_order_id,
      });
    } catch (error) {
      console.error(
        "RAZORPAY VERIFY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Payment verification error",
      });
    }
  }
);

// =====================================================
// LOCAL DEVELOPMENT
// =====================================================

if (require.main === module) {
  const PORT =
    process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(
      "=========================================="
    );

    console.log(
      " WhatsApp OTP + Razorpay Server"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Server running on http://localhost:${PORT}`
    );

    console.log(
      "=========================================="
    );
  });
}

// =====================================================
// VERCEL / SERVER EXPORT
// =====================================================

module.exports = app;