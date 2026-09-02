const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

require("dotenv").config();

const app = express();

// =====================================================
// CONFIGURATION
// =====================================================

const PORT =
  process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://www.kqphfa.store";

// =====================================================
// MIDDLEWARE
// =====================================================

const allowedOrigins = [
  "https://kqphfa.store",
  "https://www.kqphfa.store",
  FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server requests / tools
      if (!origin) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin
      );

      return callback(
        new Error(
          "Not allowed by CORS"
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json());

// =====================================================
// BASIC ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "MIDDLEWARE ERROR:",
      err
    );

    if (
      err &&
      err.message ===
        "Not allowed by CORS"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "CORS origin not allowed",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
);

// =====================================================
// ENVIRONMENT VALIDATION
// =====================================================

console.log(
  "=========================================="
);

console.log(
  "SERVER ENVIRONMENT CHECK"
);

console.log(
  "RAZORPAY_KEY_ID:",
  !!process.env.RAZORPAY_KEY_ID
);

console.log(
  "RAZORPAY_KEY_SECRET:",
  !!process.env.RAZORPAY_KEY_SECRET
);

console.log(
  "WASENDER_API_KEY:",
  !!process.env.WASENDER_API_KEY
);

console.log(
  "OTP_SECRET:",
  !!process.env.OTP_SECRET
);

console.log(
  "FRONTEND_URL:",
  FRONTEND_URL
);

console.log(
  "=========================================="
);

// =====================================================
// RAZORPAY
// =====================================================

let razorpay = null;

if (
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
) {
  razorpay =
    new Razorpay({
      key_id:
        process.env.RAZORPAY_KEY_ID,

      key_secret:
        process.env
          .RAZORPAY_KEY_SECRET,
    });
}

// =====================================================
// BASIC ROUTE
// =====================================================

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      success: true,

      message:
        "WhatsApp OTP + Razorpay API is running",

      environment:
        process.env.NODE_ENV ||
        "development",
    });
  }
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      message:
        "API is healthy",
    });
  }
);

// =====================================================
// NORMALIZE PHONE NUMBER
// =====================================================

function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  let number =
    String(phone).trim();

  // Remove spaces,
  // brackets, +, -, etc.
  number =
    number.replace(
      /\D/g,
      ""
    );

  // =================================================
  // INDIA 10 DIGIT NUMBER
  // =================================================

  // 6369879061
  // ->
  // 916369879061

  if (
    number.length === 10
  ) {
    number =
      "91" + number;
  }

  // =================================================
  // 0 + NUMBER
  // =================================================

  // 0916369879061
  // ->
  // 916369879061

  if (
    number.startsWith("0")
  ) {
    number =
      number.substring(1);
  }

  // =================================================
  // INDIA E.164
  // =================================================

  if (
    number.startsWith("91") &&
    number.length === 12
  ) {
    return "+" + number;
  }

  // =================================================
  // GENERAL INTERNATIONAL E.164
  // =================================================

  if (
    number.length >= 11 &&
    number.length <= 15
  ) {
    return "+" + number;
  }

  return null;
}

// =====================================================
// OTP SECRET
// =====================================================

function getOtpSecret() {
  if (
    !process.env.OTP_SECRET
  ) {
    throw new Error(
      "OTP_SECRET environment variable is missing"
    );
  }

  return process.env.OTP_SECRET;
}

// =====================================================
// CREATE OTP TOKEN
// =====================================================

function createOtpToken(
  phone,
  otp,
  expiresAt
) {
  const secret =
    getOtpSecret();

  const payload =
    `${phone}.${otp}.${expiresAt}`;

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("hex");

  return (
    `${payload}.${signature}`
  );
}

// =====================================================
// VERIFY OTP TOKEN
// =====================================================

function verifyOtpToken(
  token
) {
  try {
    if (!token) {
      return null;
    }

    const parts =
      token.split(".");

    if (
      parts.length !== 4
    ) {
      return null;
    }

    const [
      phone,
      otp,
      expiresAtString,
      receivedSignature,
    ] = parts;

    const expiresAt =
      Number(
        expiresAtString
      );

    if (
      !phone ||
      !otp ||
      !expiresAt ||
      !receivedSignature
    ) {
      return null;
    }

    // =================================================
    // EXPIRY
    // =================================================

    if (
      Date.now() >
      expiresAt
    ) {
      return null;
    }

    const secret =
      getOtpSecret();

    const payload =
      `${phone}.${otp}.${expiresAt}`;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(payload)
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return null;
    }

    const valid =
      crypto.timingSafeEqual(
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
    console.error(
      "OTP TOKEN ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// COOKIE HELPER
// =====================================================

function getCookie(
  req,
  name
) {
  const cookieHeader =
    req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader
      .split(";")
      .map(
        (cookie) =>
          cookie.trim()
      );

  for (
    const cookie of cookies
  ) {
    const separatorIndex =
      cookie.indexOf("=");

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const key =
      cookie
        .substring(
          0,
          separatorIndex
        )
        .trim();

    const value =
      cookie
        .substring(
          separatorIndex + 1
        )
        .trim();

    if (
      key === name
    ) {
      return decodeURIComponent(
        value
      );
    }
  }

  return null;
}

// =====================================================
// SET OTP COOKIE
// =====================================================

function setOtpCookie(
  res,
  token
) {
  const cookieParts = [
    `otp_token=${encodeURIComponent(
      token
    )}`,

    "HttpOnly",

    "Path=/",

    "SameSite=Lax",

    "Max-Age=300",
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookieParts.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookieParts.join("; ")
  );
}

// =====================================================
// CLEAR OTP COOKIE
// =====================================================

function clearOtpCookie(
  res
) {
  const cookieParts = [
    "otp_token=",
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookieParts.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookieParts.join("; ")
  );
}

// =====================================================
// SEND OTP
// =====================================================

app.post(
  "/api/send-otp",
  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "SEND OTP REQUEST"
      );

      console.log(
        "================================"
      );

      const {
        phone,
      } = req.body || {};

      // =================================================
      // VALIDATE PHONE
      // =================================================

      if (!phone) {
        return res.status(400).json({
          success: false,

          message:
            "WhatsApp number is required",
        });
      }

      const whatsappNumber =
        normalizePhone(phone);

      console.log(
        "Normalized phone:",
        whatsappNumber
      );

      if (
        !whatsappNumber
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid WhatsApp number. Enter a valid number.",
        });
      }

      // =================================================
      // WASENDER KEY
      // =================================================

      if (
        !process.env
          .WASENDER_API_KEY
      ) {
        console.error(
          "WASENDER_API_KEY is missing"
        );

        return res.status(500).json({
          success: false,

          message:
            "WasenderAPI configuration is missing",
        });
      }

      // =================================================
      // OTP SECRET
      // =================================================

      if (
        !process.env.OTP_SECRET
      ) {
        console.error(
          "OTP_SECRET is missing"
        );

        return res.status(500).json({
          success: false,

          message:
            "OTP configuration is missing",
        });
      }

      // =================================================
      // GENERATE OTP
      // =================================================

      const otp =
        crypto
          .randomInt(
            100000,
            1000000
          )
          .toString();

      // OTP valid for 5 minutes
      const expiresAt =
        Date.now() +
        5 * 60 * 1000;

      console.log(
        "OTP generated successfully"
      );

      // =================================================
      // CREATE SIGNED OTP TOKEN
      // =================================================

      const otpToken =
        createOtpToken(
          whatsappNumber,
          otp,
          expiresAt
        );

      // =================================================
      // WASENDER REQUEST
      // =================================================

      console.log(
        "Calling WasenderAPI..."
      );

      const wasenderResponse =
        await fetch(
          "https://www.wasenderapi.com/api/send-message",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${process.env.WASENDER_API_KEY}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              to:
                whatsappNumber,

              text:
                `Your login OTP is ${otp}.\n\n` +
                `This OTP is valid for 5 minutes.\n\n` +
                `Do not share this OTP with anyone.`,
            }),
          }
        );

      // =================================================
      // READ RESPONSE
      // =================================================

      const responseText =
        await wasenderResponse.text();

      let wasenderData =
        null;

      try {
        wasenderData =
          responseText
            ? JSON.parse(
                responseText
              )
            : null;
      } catch {
        wasenderData = {
          raw:
            responseText,
        };
      }

      console.log(
        "Wasender HTTP status:",
        wasenderResponse.status
      );

      console.log(
        "Wasender response:",
        wasenderData
      );

      // =================================================
      // HTTP ERROR
      // =================================================

      if (
        !wasenderResponse.ok
      ) {
        return res.status(502).json({
          success: false,

          message:
            "WasenderAPI failed to send OTP",

          error:
            wasenderData?.message ||
            wasenderData?.error ||
            `Wasender returned HTTP ${wasenderResponse.status}`,

          wasenderStatus:
            wasenderResponse.status,
        });
      }

      // =================================================
      // API-LEVEL ERROR
      // =================================================

      if (
        wasenderData &&
        wasenderData.success ===
          false
      ) {
        return res.status(502).json({
          success: false,

          message:
            "WasenderAPI rejected the OTP request",

          error:
            wasenderData?.message ||
            wasenderData?.error ||
            "WasenderAPI returned success=false",
        });
      }

      // =================================================
      // STORE OTP COOKIE
      // =================================================

      setOtpCookie(
        res,
        otpToken
      );

      // =================================================
      // SUCCESS
      // =================================================

      console.log(
        "OTP sent successfully"
      );

      return res.status(200).json({
        success: true,

        message:
          "OTP sent successfully to WhatsApp",
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

        message:
          "Failed to send OTP",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// VERIFY OTP
// =====================================================

app.post(
  "/api/verify-otp",
  (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "VERIFY OTP REQUEST"
      );

      console.log(
        "================================"
      );

      const {
        phone,
        otp,
      } = req.body || {};

      // =================================================
      // VALIDATE
      // =================================================

      if (
        !phone ||
        !otp
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Phone number and OTP are required",
        });
      }

      const whatsappNumber =
        normalizePhone(phone);

      if (
        !whatsappNumber
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid phone number",
        });
      }

      // =================================================
      // GET COOKIE
      // =================================================

      const otpToken =
        getCookie(
          req,
          "otp_token"
        );

      if (!otpToken) {
        return res.status(400).json({
          success: false,

          message:
            "OTP session not found. Please request a new OTP.",
        });
      }

      // =================================================
      // VERIFY SIGNATURE
      // =================================================

      const tokenData =
        verifyOtpToken(
          otpToken
        );

      if (!tokenData) {
        clearOtpCookie(res);

        return res.status(400).json({
          success: false,

          message:
            "OTP expired or invalid. Please request a new OTP.",
        });
      }

      // =================================================
      // PHONE CHECK
      // =================================================

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

      // =================================================
      // OTP CHECK
      // =================================================

      if (
        String(otp).trim() !==
        String(
          tokenData.otp
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid OTP",
        });
      }

      // =================================================
      // CLEAR OTP COOKIE
      // =================================================

      clearOtpCookie(res);

      // =================================================
      // LOGIN SUCCESS
      // =================================================

      console.log(
        "OTP verified successfully"
      );

      return res.status(200).json({
        success: true,

        message:
          "Login successful",

        phone:
          whatsappNumber,
      });
    } catch (error) {
      console.error(
        "VERIFY OTP ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "OTP verification failed",

        error:
          error.message,
      });
    }
  }
);

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
        "================================"
      );

      const {
        amount,
        phone,
        items,
      } = req.body || {};

      console.log(
        "Amount received:",
        amount
      );

      console.log(
        "Phone received:",
        phone
      );

      console.log(
        "Items:",
        items
      );

      // =================================================
      // RAZORPAY CONFIG
      // =================================================

      if (!razorpay) {
        return res.status(500).json({
          success: false,

          message:
            "Razorpay configuration is missing",
        });
      }

      // =================================================
      // VALIDATE AMOUNT
      // =================================================

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid amount",
        });
      }

      // =================================================
      // INR TO PAISE
      // =================================================

      const amountInPaise =
        Math.round(
          numericAmount * 100
        );

      // =================================================
      // CREATE ORDER
      // =================================================

      const order =
        await razorpay.orders.create(
          {
            amount:
              amountInPaise,

            currency:
              "INR",

            receipt:
              "receipt_" +
              Date.now(),
          }
        );

      console.log(
        "Razorpay order created:",
        order.id
      );

      // =================================================
      // SUCCESS
      // =================================================

      return res.status(200).json({
        success: true,

        order,

        // Public key only.
        // NEVER send secret.
        key:
          process.env
            .RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "RAZORPAY CREATE ORDER ERROR:",
        error
      );

      console.error(
        "================================"
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to create Razorpay order",

        error:
          error.message,
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
      console.log(
        "================================"
      );

      console.log(
        "RAZORPAY VERIFY PAYMENT"
      );

      console.log(
        "================================"
      );

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};

      // =================================================
      // VALIDATE
      // =================================================

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

      if (
        !process.env
          .RAZORPAY_KEY_SECRET
      ) {
        return res.status(500).json({
          success: false,

          message:
            "Razorpay secret is missing",
        });
      }

      // =================================================
      // GENERATE SIGNATURE
      // =================================================

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

      // =================================================
      // SAFE COMPARISON
      // =================================================

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

      // =================================================
      // VERIFIED
      // =================================================

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

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// LOCAL DEVELOPMENT
// =====================================================

if (
  require.main === module
) {
  app.listen(
    PORT,
    () => {
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
    }
  );
}

// =====================================================
// VERCEL / SERVERLESS
// =====================================================

module.exports = app;