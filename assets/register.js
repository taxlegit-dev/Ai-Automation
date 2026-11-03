// Registration form. Client checks are for convenience only; the server validates again.
(function () {
  const form = document.getElementById("reg");
  const submit = document.getElementById("submit");
  const formError = document.getElementById("formError");
  const TOKEN_KEY = "flowiq_token";

  const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const show = (field, msg) => {
    const el = form.querySelector(`.err[data-for="${field}"]`);
    if (el) el.textContent = msg || "";
    const input = document.getElementById(field);
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
  };

  function clientCheck(v) {
    const errors = {};
    if (!v.name.trim()) errors.name = "Please enter your name.";
    if (!v.email.trim()) errors.email = "Please enter your email address.";
    else if (!EMAIL.test(v.email.trim())) errors.email = "Please enter a valid email address.";
    const digits = v.phone.replace(/[\s()-]/g, "").replace(/^\+?91(?=\d{10}$)/, "");
    if (!v.phone.trim()) errors.phone = "Please enter your phone number.";
    else if (!/^\d{10}$/.test(digits)) errors.phone = "Enter exactly 10 digits (no country code needed).";
    if (!v.consent) errors.consent = "Please confirm consent to continue.";
    return errors;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;
    const v = {
      name: form.name.value, email: form.email.value, phone: form.phone.value,
      designation: form.designation.value, consent: form.consent.checked,
    };
    ["name", "email", "phone", "designation", "consent"].forEach((f) => show(f, ""));
    const errors = clientCheck(v);
    Object.entries(errors).forEach(([k, msg]) => show(k, msg));
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      const el = document.getElementById(first);
      if (el) el.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Saving your registration...";
    try {
      const res = await fetch("api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name, email: v.email, phone: v.phone, designation: v.designation, consent: v.consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.errors) Object.entries(data.errors).forEach(([k, msg]) => show(k, msg));
        formError.textContent = data.error || "Registration could not be saved. Please try again.";
        formError.hidden = false;
        return;
      }
      try { localStorage.setItem(TOKEN_KEY, data.token); } catch (_) { /* private mode: token kept in memory only */ }
      window.location.href = "desktop.html";
    } catch (_) {
      formError.textContent = "Network problem. Please check your connection and try again.";
      formError.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Register and open the workshop desktop";
    }
  });
})();
