import { useEffect, useState } from "react";
import "./App.css";

// =====================================================
// API CONFIGURATION
// =====================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

console.log("API URL:", API_URL);

// =====================================================
// RAZORPAY TEST ACCOUNT
// =====================================================

const RAZORPAY_TEST_PHONE =
  "6369879061";

const RAZORPAY_TEST_OTP =
  "000000";

const OTP_COOLDOWN_STORAGE_PREFIX =
  "cup-saucer-otp-cooldown:";

// =====================================================
// PRODUCTS
// =====================================================

const products = [
  {
    id: 1,

    name:
      "Sony ULT FIELD 1",

    model:
      "SRS-ULT10",

    brand:
      "Sony",

    price:
      9990,

    mrp:
      16990,

    image:
      "https://sony.scene7.com/is/image/sonyglobalsolutions/01-23?$large360ViewerImage$=",

    description:
      "Portable Bluetooth speaker with ULT POWER SOUND, up to 12 hours of battery life, IP67 water and dust resistance, Bluetooth 5.3 and hands-free calling.",

    specs: {
      battery:
        "Up to 12 hours",

      bluetooth:
        "5.3",

      protection:
        "IP67",

      frequency:
        "20 Hz – 20 kHz",

      weight:
        "Approx. 650 g",

      dimensions:
        "206 × 77 × 76 mm",

      codec:
        "SBC, AAC",

      charging:
        "USB Type-C",

      speaker:
        "1 Woofer + 1 Tweeter",

      app:
        "Sony | Music Center",
    },
  },

  {
    id: 2,

    name:
      "JBL Go 4",

    model:
      "GO 4",

    brand:
      "JBL",

    price:
      3499,

    mrp:
      5499,

    image:
      "https://in.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw96fc93ec/JBL_GO_4_HERO_BLACK_48156_x4.png?sh=535&sw=535",

    description:
      "Ultra-portable Bluetooth speaker with JBL Pro Sound, punchy bass, IP67 waterproof and dustproof protection, USB-C charging and up to 7 hours of playtime.",

    specs: {
      battery:
        "Up to 7 hours",

      playtimeBoost:
        "Up to 2 additional hours",

      bluetooth:
        "5.3",

      protection:
        "IP67",

      frequency:
        "90 Hz – 20 kHz",

      weight:
        "Approx. 190 g",

      dimensions:
        "94.3 × 75.7 × 42.2 mm",

      power:
        "4.2 W RMS",

      charging:
        "USB Type-C",

      connection:
        "Auracast",

      app:
        "JBL Portable",
    },
  },
];

// =====================================================
// APP
// =====================================================

function App() {
  // =====================================================
  // LOGIN STATE
  // =====================================================

  const [phone, setPhone] =
    useState(RAZORPAY_TEST_PHONE);

  const [otp, setOtp] =
    useState("");

  const [otpSent, setOtpSent] =
    useState(false);

  const [loggedIn, setLoggedIn] =
    useState(false);

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginMessage, setLoginMessage] =
    useState("");

  // =====================================================
  // OTP RESEND TIMER
  // =====================================================

  /*
    IMPORTANT:
    We restore the timer from localStorage here,
    instead of calling setResendTimer() directly from
    a useEffect.

    This avoids the React hooks lint error:
    react-hooks/set-state-in-effect
  */

  const [resendTimer, setResendTimer] =
    useState(() => {
      try {
        const cleanPhone =
          String(
            RAZORPAY_TEST_PHONE || ""
          ).replace(/\D/g, "");

        const storedUntil =
          Number(
            localStorage.getItem(
              OTP_COOLDOWN_STORAGE_PREFIX +
                cleanPhone
            )
          ) || 0;

        const remaining =
          Math.max(
            0,
            Math.ceil(
              (storedUntil -
                Date.now()) /
                1000
            )
          );

        if (remaining === 0) {
          localStorage.removeItem(
            OTP_COOLDOWN_STORAGE_PREFIX +
              cleanPhone
          );
        }

        return remaining;
      } catch {
        return 0;
      }
    });

  // =====================================================
  // OTP COUNTDOWN
  // =====================================================

  useEffect(() => {
    if (resendTimer <= 0) {
      return;
    }

    const timer =
      setInterval(() => {
        setResendTimer(
          (current) => {
            if (
              current <= 1
            ) {
              clearInterval(
                timer
              );

              try {
                const cleanPhone =
                  String(
                    phone || ""
                  ).replace(
                    /\D/g,
                    ""
                  );

                if (
                  cleanPhone
                ) {
                  localStorage.removeItem(
                    OTP_COOLDOWN_STORAGE_PREFIX +
                      cleanPhone
                  );
                }
              } catch {
                // Ignore localStorage errors.
              }

              return 0;
            }

            return current - 1;
          }
        );
      }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [
    resendTimer,
    phone,
  ]);

  // =====================================================
  // CART STATE
  // =====================================================

  const [cart, setCart] =
    useState([]);

  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [paymentStatus, setPaymentStatus] =
    useState("");

  // =====================================================
  // PHONE NORMALIZATION
  // =====================================================

  const normalizedPhoneForStorage =
    (value) =>
      String(value || "")
        .replace(
          /\D/g,
          ""
        );

  // =====================================================
  // SAVE COOLDOWN
  // =====================================================

  const saveCooldown = (
    value,
    seconds
  ) => {
    const cleanPhone =
      normalizedPhoneForStorage(
        value
      );

    if (!cleanPhone) {
      return;
    }

    const numericSeconds =
      Math.max(
        0,
        Number(seconds) || 0
      );

    const until =
      Date.now() +
      numericSeconds *
        1000;

    try {
      localStorage.setItem(
        OTP_COOLDOWN_STORAGE_PREFIX +
          cleanPhone,
        String(until)
      );
    } catch (error) {
      console.error(
        "LOCAL STORAGE ERROR:",
        error
      );
    }

    setResendTimer(
      numericSeconds
    );
  };

  // =====================================================
  // GET BACKEND COOLDOWN
  // =====================================================

  const syncCooldownFromServer =
    async (value) => {
      try {
        if (
          !String(
            value || ""
          ).trim()
        ) {
          setResendTimer(0);
          return 0;
        }

        const response =
          await fetch(
            `${API_URL}/api/otp-status?phone=${encodeURIComponent(
              value
            )}`,
            {
              method:
                "GET",

              credentials:
                "include",
            }
          );

        const data =
          await response.json();

        if (
          response.ok &&
          data.success
        ) {
          const seconds =
            Math.max(
              0,
              Number(
                data.remainingSeconds
              ) || 0
            );

          if (
            seconds > 0
          ) {
            saveCooldown(
              value,
              seconds
            );
          } else {
            setResendTimer(0);

            const cleanPhone =
              normalizedPhoneForStorage(
                value
              );

            if (
              cleanPhone
            ) {
              try {
                localStorage.removeItem(
                  OTP_COOLDOWN_STORAGE_PREFIX +
                    cleanPhone
                );
              } catch {
                // Ignore.
              }
            }
          }

          return seconds;
        }
      } catch (error) {
        console.error(
          "OTP STATUS ERROR:",
          error
        );
      }

      return 0;
    };

  // =====================================================
  // SEND OTP
  // =====================================================

  const sendOTP =
    async () => {
      const cleanPhone =
        phone.trim();

      if (!cleanPhone) {
        setLoginMessage(
          "Please enter your WhatsApp number"
        );
        return;
      }

      // Frontend cooldown.
      if (
        resendTimer > 0
      ) {
        setLoginMessage(
          `Please wait ${resendTimer} seconds before requesting another OTP.`
        );
        return;
      }

      setLoginLoading(
        true
      );

      setLoginMessage(
        ""
      );

      try {
        console.log(
          "Sending OTP..."
        );

        console.log(
          "API:",
          API_URL
        );

        const response =
          await fetch(
            `${API_URL}/api/send-otp`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({
                  phone:
                    cleanPhone,
                }),
            }
          );

        const data =
          await response.json();

        console.log(
          "Send OTP response:",
          data
        );

        // =================================================
        // BACKEND 30 SECOND COOLDOWN
        // =================================================

        if (
          response.status ===
          429
        ) {
          const remaining =
            Math.max(
              1,
              Number(
                data.remainingSeconds
              ) || 30
            );

          saveCooldown(
            cleanPhone,
            remaining
          );

          setLoginMessage(
            data.message ||
              `Please wait ${remaining} seconds before requesting another OTP.`
          );

          return;
        }

        // =================================================
        // SUCCESS
        // =================================================

        if (
          response.ok &&
          data.success
        ) {
          setOtpSent(
            true
          );

          const cooldownSeconds =
            Math.max(
              0,
              Number(
                data.cooldownSeconds
              ) || 30
            );

          saveCooldown(
            cleanPhone,
            cooldownSeconds
          );

          // =================================================
          // RAZORPAY TEST ACCOUNT
          // =================================================

          if (
            normalizedPhoneForStorage(
              cleanPhone
            ) ===
            normalizedPhoneForStorage(
              RAZORPAY_TEST_PHONE
            )
          ) {
            setOtp(
              RAZORPAY_TEST_OTP
            );

            setLoginMessage(
              "Test OTP ready: 000000"
            );
          } else {
            setOtp("");

            setLoginMessage(
              "OTP sent to your WhatsApp"
            );
          }
        } else {
          setLoginMessage(
            data.message ||
              data.error ||
              "Failed to send OTP"
          );
        }
      } catch (error) {
        console.error(
          "SEND OTP FRONTEND ERROR:",
          error
        );

        setLoginMessage(
          "Cannot connect to server"
        );
      } finally {
        setLoginLoading(
          false
        );
      }
    };

  // =====================================================
  // VERIFY OTP
  // =====================================================

  const verifyOTP =
    async () => {
      const cleanOtp =
        otp.trim();

      if (!cleanOtp) {
        setLoginMessage(
          "Please enter the OTP"
        );
        return;
      }

      if (
        !/^\d{6}$/.test(
          cleanOtp
        )
      ) {
        setLoginMessage(
          "Please enter a valid 6-digit OTP"
        );
        return;
      }

      setLoginLoading(
        true
      );

      setLoginMessage(
        ""
      );

      try {
        console.log(
          "Verifying OTP..."
        );

        const response =
          await fetch(
            `${API_URL}/api/verify-otp`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({
                  phone:
                    phone.trim(),

                  otp:
                    cleanOtp,
                }),
            }
          );

        const data =
          await response.json();

        console.log(
          "Verify OTP response:",
          data
        );

        if (
          response.ok &&
          data.success
        ) {
          setLoggedIn(
            true
          );

          setLoginMessage(
            "Login successful!"
          );
        } else {
          setLoginMessage(
            data.message ||
              "Invalid OTP"
          );
        }
      } catch (error) {
        console.error(
          "VERIFY OTP FRONTEND ERROR:",
          error
        );

        setLoginMessage(
          "Cannot connect to server"
        );
      } finally {
        setLoginLoading(
          false
        );
      }
    };

  // =====================================================
  // CHANGE NUMBER
  // =====================================================

  const changeNumber =
    async () => {
      setOtpSent(
        false
      );

      setOtp("");

      setLoginMessage(
        ""
      );

      // Backend remains the authority.
      await syncCooldownFromServer(
        phone
      );
    };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout =
    async () => {
      const currentPhone =
        phone;

      setLoggedIn(
        false
      );

      setOtp("");

      setOtpSent(
        false
      );

      setLoginLoading(
        false
      );

      setLoginMessage(
        ""
      );

      setCart([]);

      setPaymentLoading(
        false
      );

      setPaymentStatus(
        ""
      );

      // Keep current phone so the user can immediately
      // attempt login again with the same account.
      setPhone(
        currentPhone
      );

      try {
        await fetch(
          `${API_URL}/api/logout`,
          {
            method:
              "POST",

            credentials:
              "include",
          }
        );
      } catch (error) {
        console.error(
          "LOGOUT ERROR:",
          error
        );
      }

      // Logout does not cancel backend cooldown.
      await syncCooldownFromServer(
        currentPhone
      );
    };

  // =====================================================
  // ADD TO CART
  // =====================================================

  const addToCart =
    (product) => {
      setCart(
        (currentCart) => {
          const existing =
            currentCart.find(
              (item) =>
                item.id ===
                product.id
            );

          if (
            existing
          ) {
            return currentCart.map(
              (item) =>
                item.id ===
                product.id
                  ? {
                      ...item,

                      quantity:
                        item.quantity +
                        1,
                    }
                  : item
            );
          }

          return [
            ...currentCart,

            {
              ...product,
              quantity: 1,
            },
          ];
        }
      );
    };

  // =====================================================
  // REMOVE FROM CART
  // =====================================================

  const removeFromCart =
    (id) => {
      setCart(
        (currentCart) =>
          currentCart.filter(
            (item) =>
              item.id !== id
          )
      );
    };

  // =====================================================
  // INCREASE QUANTITY
  // =====================================================

  const increaseQuantity =
    (id) => {
      setCart(
        (currentCart) =>
          currentCart.map(
            (item) =>
              item.id === id
                ? {
                    ...item,

                    quantity:
                      item.quantity +
                      1,
                  }
                : item
          )
      );
    };

  // =====================================================
  // DECREASE QUANTITY
  // =====================================================

  const decreaseQuantity =
    (id) => {
      setCart(
        (currentCart) =>
          currentCart
            .map(
              (item) =>
                item.id === id
                  ? {
                      ...item,

                      quantity:
                        item.quantity -
                        1,
                    }
                  : item
            )
            .filter(
              (item) =>
                item.quantity >
                0
            )
      );
    };

  // =====================================================
  // CART TOTAL
  // =====================================================

  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        item.price *
          item.quantity,
      0
    );

  // =====================================================
  // LOAD RAZORPAY
  // =====================================================

  const loadRazorpay =
    () => {
      return new Promise(
        (resolve) => {
          if (
            window.Razorpay
          ) {
            resolve(
              true
            );

            return;
          }

          const existingScript =
            document.querySelector(
              'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
            );

          if (
            existingScript
          ) {
            existingScript.addEventListener(
              "load",
              () =>
                resolve(
                  true
                )
            );

            existingScript.addEventListener(
              "error",
              () =>
                resolve(
                  false
                )
            );

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            "https://checkout.razorpay.com/v1/checkout.js";

          script.onload =
            () =>
              resolve(
                true
              );

          script.onerror =
            () =>
              resolve(
                false
              );

          document.body.appendChild(
            script
          );
        }
      );
    };

  // =====================================================
  // PAYMENT
  // =====================================================

  const handlePayment =
    async () => {
      if (!loggedIn) {
        alert(
          "Please login first"
        );

        return;
      }

      if (
        cart.length ===
        0
      ) {
        alert(
          "Please add a product"
        );

        return;
      }

      setPaymentLoading(
        true
      );

      setPaymentStatus(
        ""
      );

      try {
        // =================================================
        // LOAD RAZORPAY
        // =================================================

        const razorpayLoaded =
          await loadRazorpay();

        if (
          !razorpayLoaded
        ) {
          setPaymentStatus(
            "Razorpay SDK failed to load"
          );

          setPaymentLoading(
            false
          );

          return;
        }

        // =================================================
        // CREATE ORDER
        // =================================================

        const response =
          await fetch(
            `${API_URL}/api/create-order`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({
                  amount:
                    total,

                  phone:
                    phone,

                  items:
                    cart.map(
                      (item) => ({
                        id:
                          item.id,

                        name:
                          item.name,

                        price:
                          item.price,

                        quantity:
                          item.quantity,
                      })
                    ),
                }),
            }
          );

        const data =
          await response.json();

        console.log(
          "Create order response:",
          data
        );

        if (
          !response.ok ||
          !data.success ||
          !data.order ||
          !data.key
        ) {
          setPaymentStatus(
            data.message ||
              data.error ||
              "Unable to create Razorpay order"
          );

          setPaymentLoading(
            false
          );

          return;
        }

        const order =
          data.order;

        // =================================================
        // RAZORPAY OPTIONS
        // =================================================

        const options = {
          key:
            data.key,

          amount:
            order.amount,

          currency:
            order.currency,

          name:
            "My MERN Store",

          description:
            "Bluetooth Speaker Purchase",

          order_id:
            order.id,

          prefill: {
            contact:
              phone,
          },

          notes: {
            phone:
              phone,

            products:
              cart
                .map(
                  (item) =>
                    `${item.name} x${item.quantity}`
                )
                .join(
                  ", "
                ),
          },

          theme: {
            color:
              "#7c3aed",
          },

          // =================================================
          // PAYMENT SUCCESS
          // =================================================

          handler:
            async function (
              razorpayResponse
            ) {
              try {
                console.log(
                  "Razorpay payment response:",
                  razorpayResponse
                );

                const verifyResponse =
                  await fetch(
                    `${API_URL}/api/verify-payment`,
                    {
                      method:
                        "POST",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      credentials:
                        "include",

                      body:
                        JSON.stringify(
                          razorpayResponse
                        ),
                    }
                  );

                const verifyData =
                  await verifyResponse.json();

                console.log(
                  "Payment verification response:",
                  verifyData
                );

                if (
                  verifyResponse.ok &&
                  verifyData.success
                ) {
                  setPaymentStatus(
                    `Payment successful! Payment ID: ${verifyData.paymentId}`
                  );

                  setCart([]);
                } else {
                  setPaymentStatus(
                    verifyData.message ||
                      "Payment verification failed"
                  );
                }
              } catch (error) {
                console.error(
                  "PAYMENT VERIFY FRONTEND ERROR:",
                  error
                );

                setPaymentStatus(
                  "Payment verification failed"
                );
              } finally {
                setPaymentLoading(
                  false
                );
              }
            },

          // =================================================
          // CHECKOUT CLOSED
          // =================================================

          modal: {
            ondismiss:
              function () {
                console.log(
                  "Razorpay checkout closed"
                );

                setPaymentLoading(
                  false
                );
              },
          },
        };

        // =================================================
        // OPEN RAZORPAY
        // =================================================

        const razorpay =
          new window.Razorpay(
            options
          );

        // =================================================
        // PAYMENT FAILED
        // =================================================

        razorpay.on(
          "payment.failed",
          function (
            response
          ) {
            console.error(
              "Razorpay payment failed:",
              response.error
            );

            setPaymentStatus(
              response.error
                ?.description ||
                "Payment failed"
            );

            setPaymentLoading(
              false
            );
          }
        );

        razorpay.open();
      } catch (error) {
        console.error(
          "PAYMENT ERROR:",
          error
        );

        setPaymentStatus(
          "Something went wrong while starting payment"
        );

        setPaymentLoading(
          false
        );
      }
    };

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="login-page">

        <div className="login-card">

          <div className="login-logo">
            M
          </div>

          <h2>
            WhatsApp Login
          </h2>

          <p>
            Login securely using
            your WhatsApp number
          </p>

          {!otpSent ? (
            <>
              <div className="input-label">
                WhatsApp Number
              </div>

              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                value={
                  phone
                }
                onChange={(e) => {
                  const value =
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        15
                      );

                  setPhone(
                    value
                  );

                  setLoginMessage(
                    ""
                  );
                }}
                onBlur={() => {
                  syncCooldownFromServer(
                    phone
                  );
                }}
              />

              {normalizedPhoneForStorage(
                phone
              ) ===
                normalizedPhoneForStorage(
                  RAZORPAY_TEST_PHONE
                ) && (
                <p className="test-account-hint">
                  Razorpay test account · OTP: 000000
                </p>
              )}

              <button
                onClick={
                  sendOTP
                }
                disabled={
                  loginLoading ||
                  resendTimer >
                    0
                }
              >
                {loginLoading
                  ? "Sending..."
                  : resendTimer >
                    0
                  ? `Wait ${resendTimer}s`
                  : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <div className="otp-info">

                <span>
                  OTP sent to
                </span>

                <strong>
                  {phone}
                </strong>

              </div>

              <div className="input-label">
                Enter OTP
              </div>

              {normalizedPhoneForStorage(
                phone
              ) ===
                normalizedPhoneForStorage(
                  RAZORPAY_TEST_PHONE
                ) && (
                <div className="test-otp-hint">
                  🔐 Razorpay test OTP:{" "}
                  <strong>
                    000000
                  </strong>
                </div>
              )}

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength="6"
                placeholder="Enter 6-digit OTP"
                value={
                  otp
                }
                onChange={(e) =>
                  setOtp(
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        6
                      )
                  )
                }
              />

              <button
                onClick={
                  verifyOTP
                }
                disabled={
                  loginLoading
                }
              >
                {loginLoading
                  ? "Verifying..."
                  : "Verify & Login"}
              </button>

              <button
                className="secondary-button"
                onClick={
                  sendOTP
                }
                disabled={
                  loginLoading ||
                  resendTimer >
                    0
                }
              >
                {resendTimer >
                0
                  ? `Resend OTP in ${resendTimer}s`
                  : "Resend OTP"}
              </button>

              <button
                className="secondary-button"
                onClick={
                  changeNumber
                }
                disabled={
                  loginLoading
                }
              >
                Change Number
              </button>
            </>
          )}

          {loginMessage && (
            <p className="message">
              {loginMessage}
            </p>
          )}

          <div className="login-footer">
            Secure WhatsApp authentication
          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // STORE PAGE
  // =====================================================

  return (
    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="header">

        <div className="header-brand">

          <div className="header-logo">
            M
          </div>

          <div>

            <h1>
              My MERN Store
            </h1>

            <p>
              Logged in with{" "}
              {phone}
            </p>

          </div>

        </div>

        <div className="header-actions">

          <div className="cart-count">
            🛒 Cart{" "}
            <span>
              {cart.reduce(
                (sum, item) =>
                  sum +
                  item.quantity,
                0
              )}
            </span>
          </div>

          <button
            className="logout-button"
            onClick={
              handleLogout
            }
          >
            Logout
          </button>

        </div>

      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main>

        {/* =================================================
            PRODUCTS
        ================================================= */}

        <section className="products">

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                PREMIUM AUDIO
              </span>

              <h2>
                Bluetooth Speakers
              </h2>

              <p>
                Shop genuine audio products with clear
                pricing and product specifications.
              </p>

            </div>

          </div>

          <div className="product-grid">

            {products.map(
              (product) => (
                <div
                  className="product-card"
                  key={
                    product.id
                  }
                >

                  {/* =================================================
                      PRODUCT IMAGE
                  ================================================= */}

                  <div className="product-image-wrapper">

                    <img
                      src={
                        product.image
                      }
                      alt={
                        product.name
                      }
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />

                    <span className="product-badge">
                      ORIGINAL
                    </span>

                  </div>

                  {/* =================================================
                      PRODUCT CONTENT
                  ================================================= */}

                  <div className="product-content">

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap:
                          "10px",
                        marginTop:
                          "12px",
                        marginBottom:
                          "5px",
                      }}
                    >
                      <span
                        style={{
                          color:
                            "#7c3aed",
                          fontSize:
                            "12px",
                          fontWeight:
                            "900",
                          letterSpacing:
                            "0.8px",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {
                          product.brand
                        }
                      </span>

                      <span
                        style={{
                          color:
                            "#81758e",
                          fontSize:
                            "11px",
                          fontWeight:
                            "700",
                        }}
                      >
                        Model{" "}
                        {
                          product.model
                        }
                      </span>
                    </div>

                    <h3>
                      {product.name}
                    </h3>

                    <p
                      style={{
                        margin:
                          "8px 0 0",
                        color:
                          "#756b80",
                        fontSize:
                          "13px",
                        lineHeight:
                          "1.55",
                      }}
                    >
                      {
                        product.description
                      }
                    </p>

                    {/* =================================================
                        KEY SPECS
                    ================================================= */}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(3, minmax(0, 1fr))",
                        gap:
                          "8px",
                        marginTop:
                          "15px",
                      }}
                    >

                      <div
                        style={{
                          padding:
                            "9px 8px",
                          borderRadius:
                            "11px",
                          background:
                            "#f5efff",
                          color:
                            "#67417e",
                          fontSize:
                            "11px",
                          fontWeight:
                            "800",
                          textAlign:
                            "center",
                        }}
                      >
                        🔋
                        <br />
                        {
                          product
                            .specs
                            .battery
                        }
                      </div>

                      <div
                        style={{
                          padding:
                            "9px 8px",
                          borderRadius:
                            "11px",
                          background:
                            "#eef9ff",
                          color:
                            "#25607b",
                          fontSize:
                            "11px",
                          fontWeight:
                            "800",
                          textAlign:
                            "center",
                        }}
                      >
                        💧
                        <br />
                        {
                          product
                            .specs
                            .protection
                        }
                      </div>

                      <div
                        style={{
                          padding:
                            "9px 8px",
                          borderRadius:
                            "11px",
                          background:
                            "#fff2f8",
                          color:
                            "#92405f",
                          fontSize:
                            "11px",
                          fontWeight:
                            "800",
                          textAlign:
                            "center",
                        }}
                      >
                        📶
                        <br />
                        BT{" "}
                        {
                          product
                            .specs
                            .bluetooth
                        }
                      </div>

                    </div>

                    {/* =================================================
                        MORE SPECIFICATIONS
                    ================================================= */}

                    <div
                      style={{
                        marginTop:
                          "14px",
                        padding:
                          "12px",
                        borderRadius:
                          "13px",
                        background:
                          "#faf8fd",
                        border:
                          "1px solid #eee7f5",
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap:
                            "10px",
                          padding:
                            "5px 0",
                          borderBottom:
                            "1px solid #eee8f3",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "#8a7f94",
                            fontSize:
                              "11px",
                          }}
                        >
                          Frequency
                        </span>

                        <strong
                          style={{
                            color:
                              "#493950",
                            fontSize:
                              "11px",
                          }}
                        >
                          {
                            product
                              .specs
                              .frequency
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap:
                            "10px",
                          padding:
                            "5px 0",
                          borderBottom:
                            "1px solid #eee8f3",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "#8a7f94",
                            fontSize:
                              "11px",
                          }}
                        >
                          Weight
                        </span>

                        <strong
                          style={{
                            color:
                              "#493950",
                            fontSize:
                              "11px",
                          }}
                        >
                          {
                            product
                              .specs
                              .weight
                          }
                        </strong>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap:
                            "10px",
                          padding:
                            "5px 0",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "#8a7f94",
                            fontSize:
                              "11px",
                          }}
                        >
                          Charging
                        </span>

                        <strong
                          style={{
                            color:
                              "#493950",
                            fontSize:
                              "11px",
                          }}
                        >
                          {
                            product
                              .specs
                              .charging
                          }
                        </strong>
                      </div>

                    </div>

                    {/* =================================================
                        PRICE
                    ================================================= */}

                    <div className="product-bottom">

                      <div>

                        <p className="price">
                          ₹
                          {product.price.toLocaleString(
                            "en-IN"
                          )}
                        </p>

                        <p
                          style={{
                            margin:
                              "3px 0 0",
                            color:
                              "#95899f",
                            fontSize:
                              "11px",
                          }}
                        >
                          M.R.P. ₹
                          {product.mrp.toLocaleString(
                            "en-IN"
                          )}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          addToCart(
                            product
                          )
                        }
                      >
                        Add to Cart
                      </button>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* =================================================
            CART
        ================================================= */}

        <section className="cart">

          <div className="cart-heading">

            <div>

              <span className="eyebrow">
                YOUR ORDER
              </span>

              <h2>
                Shopping Cart
              </h2>

            </div>

            {cart.length >
              0 && (
              <span className="cart-items-label">

                {cart.reduce(
                  (sum, item) =>
                    sum +
                    item.quantity,
                  0
                )}{" "}
                items

              </span>
            )}

          </div>

          {cart.length ===
          0 ? (
            <div className="empty-cart">

              <div className="empty-cart-icon">
                🛒
              </div>

              <h3>
                Your cart is empty
              </h3>

              <p>
                Add a product above
                to start shopping.
              </p>

            </div>
          ) : (
            <>

              <div className="cart-list">

                {cart.map(
                  (item) => (
                    <div
                      className="cart-item"
                      key={
                        item.id
                      }
                    >

                      {/* =================================================
                          CART PRODUCT
                      ================================================= */}

                      <div className="cart-product">

                        <img
                          src={
                            item.image
                          }
                          alt={
                            item.name
                          }
                        />

                        <div>

                          <strong>
                            {
                              item.name
                            }
                          </strong>

                          <p>
                            {item.brand}{" "}
                            •{" "}
                            {item.model}
                          </p>

                          <p>
                            ₹
                            {item.price.toLocaleString(
                              "en-IN"
                            )}{" "}
                            each
                          </p>

                        </div>

                      </div>

                      {/* =================================================
                          QUANTITY
                      ================================================= */}

                      <div className="quantity">

                        <button
                          onClick={() =>
                            decreaseQuantity(
                              item.id
                            )
                          }
                        >
                          −
                        </button>

                        <span>
                          {
                            item.quantity
                          }
                        </span>

                        <button
                          onClick={() =>
                            increaseQuantity(
                              item.id
                            )
                          }
                        >
                          +
                        </button>

                      </div>

                      {/* =================================================
                          ITEM TOTAL
                      ================================================= */}

                      <div className="item-total">
                        ₹
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </div>

                      {/* =================================================
                          REMOVE
                      ================================================= */}

                      <button
                        className="remove"
                        onClick={() =>
                          removeFromCart(
                            item.id
                          )
                        }
                      >
                        Remove
                      </button>

                    </div>
                  )
                )}

              </div>

              {/* =================================================
                  CHECKOUT
              ================================================= */}

              <div className="checkout">

                <div className="total">

                  <span>
                    Total
                  </span>

                  <strong>
                    ₹
                    {total.toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                </div>

                <button
                  className="pay-button"
                  onClick={
                    handlePayment
                  }
                  disabled={
                    paymentLoading
                  }
                >
                  {paymentLoading
                    ? "Processing..."
                    : `Pay ₹${total.toLocaleString(
                        "en-IN"
                      )} with Razorpay`}
                </button>

                <p className="secure-payment">
                  🔒 Secure payment powered
                  by Razorpay
                </p>

              </div>

            </>
          )}

          {paymentStatus && (
            <div className="status">
              {paymentStatus}
            </div>
          )}

        </section>

      </main>

    </div>
  );
}

export default App;