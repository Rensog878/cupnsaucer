import {
  useEffect,
  useRef,
  useState,
} from "react";

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

// =====================================================
// PRODUCTS
// =====================================================

const products = [
  {
    id: 1,
    name: "boAt Stone 350 Pro Plus",
    model: "Stone 350 Pro Plus",
    brand: "boAt",
    price: 1699,
    mrp: 4990,

    image:
      "https://fullspecs.net/images/products/8852_0_boat-stone-350-pro-9352fc9a341618579df1a368db356b6a.jpg",

    description:
      "16W Bluetooth speaker with TWS, RGB LED lights, hands-free calling, voice assistant support and up to 8 hours of playtime.",

    specs: {
      battery: "Up to 8 hours",
      bluetooth: "5.3",
      protection: "IPX5",
      frequency: "Not specified",
      weight: "Not specified",
      dimensions: "240 × 92 × 92 mm",
      codec: "Not specified",
      charging: "USB Type-C",
      speaker: "2 × 2-inch drivers",
      app: "Not specified",
    },
  },

  {
    id: 2,
    name: "Sony ULT FIELD 3",
    model: "SRS-ULT30",
    brand: "Sony",
    price: 17990,
    mrp: 24990,

    image:
      "https://cdn.ultra.md/images/webp/products/ffed899e-59e6-4b78-8a1b-b921c60e1678/images/2560321.webp",

    description:
      "Portable wireless speaker with ULT POWER SOUND, approximately 24 hours of battery life, IP67 protection, hands-free calling and a detachable shoulder strap.",

    specs: {
      battery: "Approx. 24 hours",
      bluetooth: "5.2",
      protection: "IP66 / IP67",
      frequency: "20 Hz – 20 kHz",
      weight: "Approx. 1.2 kg",
      dimensions: "256 × 113 × 79 mm",
      codec: "SBC, AAC",
      charging: "USB Type-C",
      speaker: "2-way speaker system",
      app: "Sony | Sound Connect",
    },
  },

  {
    id: 3,
    name: "Tribit XSound Go",
    model: "XSound Go",
    brand: "Tribit",
    price: 3900,
    mrp: 3900,

    image:
      "https://i.bolder.run/r/czozNTk5LGc6MTAwMHg/34576122/940722-TRIBIT0001.jpg",

    description:
      "Portable Bluetooth speaker with dual 8W drivers, Bluetooth 5.3, IPX7 waterproof protection and up to 24 hours of playback.",

    specs: {
      battery: "Up to 24 hours",
      bluetooth: "5.3",
      protection: "IPX7",
      frequency: "Not specified",
      weight: "Approx. 390 g",
      dimensions: "Not specified",
      codec: "SBC",
      charging: "USB-C",
      speaker: "2 × 8W drivers",
      app: "Tribit App",
    },
  },

  {
    id: 4,
    name: "Marshall Emberton III",
    model: "Emberton III",
    brand: "Marshall",
    price: 17999,
    mrp: 17999,

    image:
      "https://media.currys.biz/i/currysprod/10267026?%24l-large%24=&fmt=auto",

    description:
      "Portable Marshall speaker with True Stereophonic 360° sound, 32+ hours of playtime and IP67 dust and waterproof protection.",

    specs: {
      battery: "32+ hours",
      bluetooth: "5.3 LE",
      protection: "IP67",
      frequency: "65 Hz – 20 kHz",
      weight: "0.67 kg",
      dimensions: "160 × 68 × 76.9 mm",
      codec: "Not specified",
      charging: "USB-C",
      speaker: "2 × 10W full-range",
      app: "Marshall Bluetooth",
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
    useState(
      RAZORPAY_TEST_PHONE
    );

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
            if (current <= 1) {
              clearInterval(timer);

              try {
                const cleanPhone =
                  String(
                    phone || ""
                  ).replace(
                    /\D/g,
                    ""
                  );

                if (cleanPhone) {
                  localStorage.removeItem(
                    OTP_COOLDOWN_STORAGE_PREFIX +
                      cleanPhone
                  );
                }
              } catch {
                // Ignore storage errors.
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

  // =====================================================
  // ADD TO CART POPUP
  // =====================================================

  const [cartToast, setCartToast] =
    useState({
      visible: false,
      productName: "",
      quantity: 1,
    });

  const cartToastTimerRef =
    useRef(null);

  // =====================================================
  // PAYMENT STATE
  // =====================================================

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
        .replace(/\D/g, "");

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
              method: "GET",

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

          if (seconds > 0) {
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

            if (cleanPhone) {
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

      if (resendTimer > 0) {
        setLoginMessage(
          `Please wait ${resendTimer} seconds before requesting another OTP.`
        );

        return;
      }

      setLoginLoading(true);

      setLoginMessage("");

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
              method: "POST",

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
          setOtpSent(true);

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
        setLoginLoading(false);
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

      setLoginLoading(true);

      setLoginMessage("");

      try {
        const response =
          await fetch(
            `${API_URL}/api/verify-otp`,
            {
              method: "POST",

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
          setLoggedIn(true);

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
        setLoginLoading(false);
      }
    };

  // =====================================================
  // CHANGE NUMBER
  // =====================================================

  const changeNumber =
    async () => {
      setOtpSent(false);

      setOtp("");

      setLoginMessage("");

      await syncCooldownFromServer(
        phone
      );
    };

  // =====================================================
  // CLOSE CART POPUP
  // =====================================================

  const closeCartToast = () => {
    setCartToast({
      visible: false,
      productName: "",
      quantity: 1,
    });

    if (
      cartToastTimerRef.current
    ) {
      clearTimeout(
        cartToastTimerRef.current
      );

      cartToastTimerRef.current =
        null;
    }
  };

  // =====================================================
  // GO TO CART
  // =====================================================

  const goToCart = () => {
    const cartSection =
      document.querySelector(
        ".cart"
      );

    if (cartSection) {
      cartSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    closeCartToast();
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout =
    async () => {
      const currentPhone =
        phone;

      closeCartToast();

      setLoggedIn(false);

      setOtp("");

      setOtpSent(false);

      setLoginLoading(false);

      setLoginMessage("");

      setCart([]);

      setPaymentLoading(false);

      setPaymentStatus("");

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

      await syncCooldownFromServer(
        currentPhone
      );
    };

  // =====================================================
  // ADD TO CART
  // =====================================================

  const addToCart =
    (product) => {
      let updatedQuantity =
        1;

      setCart(
        (currentCart) => {
          const existing =
            currentCart.find(
              (item) =>
                item.id ===
                product.id
            );

          if (existing) {
            updatedQuantity =
              existing.quantity +
              1;

            return currentCart.map(
              (item) =>
                item.id ===
                product.id
                  ? {
                      ...item,

                      quantity:
                        updatedQuantity,
                    }
                  : item
            );
          }

          updatedQuantity = 1;

          return [
            ...currentCart,

            {
              ...product,
              quantity: 1,
            },
          ];
        }
      );

      // =================================================
      // SHOW / UPDATE POPUP
      // =================================================

      setCartToast({
        visible: true,

        productName:
          product.name,

        quantity:
          updatedQuantity,
      });

      // Reset existing timer.
      if (
        cartToastTimerRef.current
      ) {
        clearTimeout(
          cartToastTimerRef.current
        );
      }

      // Hide after 3 seconds.
      cartToastTimerRef.current =
        setTimeout(() => {
          setCartToast({
            visible: false,
            productName: "",
            quantity: 1,
          });

          cartToastTimerRef.current =
            null;
        }, 3000);
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
  // CLEANUP CART POPUP TIMER
  // =====================================================

  useEffect(() => {
    return () => {
      if (
        cartToastTimerRef.current
      ) {
        clearTimeout(
          cartToastTimerRef.current
        );
      }
    };
  }, []);

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
  // GET PRODUCT QUANTITY
  // =====================================================

  const getProductQuantity =
    (productId) => {
      const item =
        cart.find(
          (cartItem) =>
            cartItem.id ===
            productId
        );

      return item
        ? item.quantity
        : 0;
    };

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
            resolve(true);

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
                resolve(true)
            );

            existingScript.addEventListener(
              "error",
              () =>
                resolve(false)
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
              resolve(true);

          script.onerror =
            () =>
              resolve(false);

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

      setPaymentStatus("");

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
          ADD TO CART POPUP
      ================================================= */}

      {cartToast.visible && (
        <div
          className="cart-toast"
          role="status"
          aria-live="polite"
        >

          <div className="cart-toast-icon">
            ✓
          </div>

          <div className="cart-toast-content">

            <strong>
              Added to Cart
            </strong>

            <span>
              {cartToast.productName}
            </span>

            <small>
              Quantity:{" "}
              {cartToast.quantity}
            </small>

            <button
              type="button"
              onClick={
                goToCart
              }
            >
              Go to Cart →
            </button>

          </div>

          <button
            type="button"
            className="cart-toast-close"
            onClick={
              closeCartToast
            }
            aria-label="Close"
          >
            ×
          </button>

        </div>
      )}

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
              (product) => {

                const productQuantity =
                  getProductQuantity(
                    product.id
                  );

                const isAdded =
                  productQuantity >
                  0;

                return (
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
                        className="product-meta"
                      >

                        <span className="product-brand">
                          {
                            product.brand
                          }
                        </span>

                        <span className="product-model">
                          Model{" "}
                          {
                            product.model
                          }
                        </span>

                      </div>

                      <h3>
                        {product.name}
                      </h3>

                      <p className="product-description">
                        {
                          product.description
                        }
                      </p>

                      {/* =================================================
                          KEY SPECS
                      ================================================= */}

                      <div className="product-key-specs">

                        <div className="key-spec">
                          <span>
                            🔋
                          </span>

                          <strong>
                            {
                              product
                                .specs
                                .battery
                            }
                          </strong>
                        </div>

                        <div className="key-spec">
                          <span>
                            💧
                          </span>

                          <strong>
                            {
                              product
                                .specs
                                .protection
                            }
                          </strong>
                        </div>

                        <div className="key-spec">
                          <span>
                            📶
                          </span>

                          <strong>
                            BT{" "}
                            {
                              product
                                .specs
                                .bluetooth
                            }
                          </strong>
                        </div>

                      </div>

                      {/* =================================================
                          MORE SPECIFICATIONS
                      ================================================= */}

                      <div className="product-specs">

                        <div className="spec-row">
                          <span>
                            Frequency
                          </span>

                          <strong>
                            {
                              product
                                .specs
                                .frequency
                            }
                          </strong>
                        </div>

                        <div className="spec-row">
                          <span>
                            Weight
                          </span>

                          <strong>
                            {
                              product
                                .specs
                                .weight
                            }
                          </strong>
                        </div>

                        <div className="spec-row">
                          <span>
                            Charging
                          </span>

                          <strong>
                            {
                              product
                                .specs
                                .charging
                            }
                          </strong>
                        </div>

                      </div>

                      {/* =================================================
                          PRICE + ADD TO CART
                      ================================================= */}

                      <div className="product-bottom">

                        <div className="product-price-block">

                          <p className="price">
                            ₹
                            {product.price.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                          <p className="product-mrp">
                            M.R.P. ₹
                            {product.mrp.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                        </div>

                        <button
                          type="button"
                          className={
                            isAdded
                              ? "add-cart-button added"
                              : "add-cart-button"
                          }
                          onClick={() =>
                            addToCart(
                              product
                            )
                          }
                        >

                          {isAdded ? (
                            <>
                              ✓ Added •{" "}
                              {
                                productQuantity
                              }
                            </>
                          ) : (
                            "Add to Cart"
                          )}

                        </button>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>

        {/* =================================================
            SHOPPING CART
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

          {/* =================================================
              EMPTY CART
          ================================================= */}

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

              {/* =================================================
                  CART ITEMS
              ================================================= */}

              <div className="cart-list">

                {cart.map(
                  (item) => (
                    <div
                      className="cart-item"
                      key={
                        item.id
                      }
                    >

                      {/* PRODUCT */}

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

                      {/* QUANTITY */}

                      <div className="quantity">

                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
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
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() =>
                            increaseQuantity(
                              item.id
                            )
                          }
                        >
                          +
                        </button>

                      </div>

                      {/* ITEM TOTAL */}

                      <div className="item-total">
                        ₹
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </div>

                      {/* REMOVE */}

                      <button
                        type="button"
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
                  type="button"
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

          {/* =================================================
              PAYMENT STATUS
          ================================================= */}

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