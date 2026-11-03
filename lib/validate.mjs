// Registration form validation. Name, email and phone are required; designation is optional.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateRegistration(input = {}) {
  const errors = {};
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  const email = String(input.email || "").trim().toLowerCase();
  const phoneRaw = String(input.phone || "").replace(/[\s()-]/g, "");
  const phone = phoneRaw.replace(/^\+?91(?=\d{10}$)/, "");
  const designation = String(input.designation || "").trim().replace(/\s+/g, " ");

  if (!name) errors.name = "Please enter your name.";
  else if (name.length > 100) errors.name = "Name is too long.";

  if (!email) errors.email = "Please enter your email address.";
  else if (!EMAIL.test(email) || email.length > 120) errors.email = "Please enter a valid email address.";

  if (!phoneRaw) errors.phone = "Please enter your phone number.";
  else if (!/^\d{10}$/.test(phone)) errors.phone = "Enter exactly 10 digits (no country code needed).";

  if (designation.length > 100) errors.designation = "Designation is too long.";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name, email, phone, designation },
  };
}
