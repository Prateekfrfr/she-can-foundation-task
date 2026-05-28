const form = document.querySelector("#contactForm");
const statusMessage = document.querySelector("#formStatus");
const submissionList = document.querySelector("#submissionList");
const submitButton = form.querySelector("button[type='submit']");
const storageKey = "sheCanFoundationMessages";
let hasTriedSubmit = false;

const fields = {
  name: document.querySelector("#name"),
  email: document.querySelector("#email"),
  phone: document.querySelector("#phone"),
  interest: document.querySelector("#interest"),
  message: document.querySelector("#message"),
  consent: document.querySelector("#consent")
};

const errors = {
  name: document.querySelector("#nameError"),
  email: document.querySelector("#emailError"),
  phone: document.querySelector("#phoneError"),
  interest: document.querySelector("#interestError"),
  message: document.querySelector("#messageError"),
  consent: document.querySelector("#consentError")
};

const metrics = {
  total: document.querySelector("#totalMessages"),
  volunteers: document.querySelector("#volunteerLeads"),
  donations: document.querySelector("#donationLeads")
};

function getLocalMessages() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function setLocalMessages(messages) {
  localStorage.setItem(storageKey, JSON.stringify(messages));
}

function getFormValues() {
  return {
    name: fields.name.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim(),
    interest: fields.interest.value,
    message: fields.message.value.trim(),
    consent: fields.consent.checked
  };
}

function validateForm(values) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\d{10}$/;
  const validationErrors = {};

  if (values.name.length < 2) {
    validationErrors.name = "Please enter at least 2 characters.";
  }

  if (!emailPattern.test(values.email)) {
    validationErrors.email = "Please enter a valid email address.";
  }

  if (!phonePattern.test(values.phone)) {
    validationErrors.phone = "Please enter a 10 digit phone number.";
  }

  if (!values.interest) {
    validationErrors.interest = "Please select one option.";
  }

  if (values.message.length < 10) {
    validationErrors.message = "Please write a message of at least 10 characters.";
  }

  if (!values.consent) {
    validationErrors.consent = "Please confirm permission to contact you.";
  }

  return validationErrors;
}

function showErrors(validationErrors) {
  Object.keys(fields).forEach(field => {
    const fieldWrapper = fields[field].closest(".field-group");
    const message = validationErrors[field] || "";

    errors[field].textContent = message;

    if (fieldWrapper) {
      fieldWrapper.classList.toggle("has-error", Boolean(message));
    }
  });
}

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `form-status ${type || ""}`.trim();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateMetrics(messages) {
  metrics.total.textContent = messages.length;
  metrics.volunteers.textContent = messages.filter(message => message.interest === "Volunteer").length;
  metrics.donations.textContent = messages.filter(message => message.interest === "Donate").length;
}

function renderSubmissions(messages) {
  updateMetrics(messages);

  if (!messages.length) {
    submissionList.innerHTML = '<p class="empty-state">No messages submitted yet.</p>';
    return;
  }

  submissionList.innerHTML = messages
    .slice(0, 6)
    .map(
      message => `
        <article class="submission-item">
          <div>
            <strong>${escapeHtml(message.name)}</strong>
            <span>${escapeHtml(message.email)} | ${escapeHtml(message.phone)}</span>
          </div>
          <span class="submission-tag">${escapeHtml(message.interest)}</span>
          <time datetime="${message.createdAt}">${formatDate(message.createdAt)}</time>
          <p>${escapeHtml(message.message)}</p>
        </article>
      `
    )
    .join("");
}

async function loadSubmissions() {
  try {
    const response = await fetch("/api/submissions");
    if (!response.ok) {
      throw new Error("Backend unavailable");
    }

    const data = await response.json();
    renderSubmissions(data.submissions || []);
  } catch {
    renderSubmissions(getLocalMessages());
  }
}

async function submitMessage(values) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(values)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Unable to submit the form.");
    error.details = data.errors || {};
    throw error;
  }

  return data.submission;
}

function buildFallbackMessage(values) {
  return {
    id: crypto.randomUUID(),
    ...values,
    createdAt: new Date().toISOString()
  };
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  hasTriedSubmit = true;

  const values = getFormValues();
  const validationErrors = validateForm(values);

  showErrors(validationErrors);

  if (Object.keys(validationErrors).length) {
    showStatus("Please fix the highlighted fields.", "error");
    return;
  }

  submitButton.disabled = true;
  showStatus("Submitting your message...", "");

  try {
    const savedMessage = await submitMessage(values);
    showStatus("Form Submitted Successfully", "success");
    form.reset();
    hasTriedSubmit = false;
    showErrors({});
    renderSubmissions([savedMessage, ...getLocalMessages()]);
    await loadSubmissions();
  } catch (error) {
    if (error.details && Object.keys(error.details).length) {
      showErrors(error.details);
      showStatus(error.message, "error");
      return;
    }

    const fallbackMessage = buildFallbackMessage(values);
    const messages = [fallbackMessage, ...getLocalMessages()];

    setLocalMessages(messages);
    renderSubmissions(messages);
    showStatus("Form Submitted Successfully", "success");
    form.reset();
    hasTriedSubmit = false;
    showErrors({});
  } finally {
    submitButton.disabled = false;
  }
});

Object.values(fields).forEach(field => {
  field.addEventListener("input", () => {
    if (field === fields.phone) {
      fields.phone.value = fields.phone.value.replace(/\D/g, "").slice(0, 10);
    }

    if (!hasTriedSubmit) {
      showStatus("", "");
      return;
    }

    showErrors(validateForm(getFormValues()));
    showStatus("", "");
  });
});

fields.consent.addEventListener("change", () => {
  if (!hasTriedSubmit) {
    showStatus("", "");
    return;
  }

  showErrors(validateForm(getFormValues()));
});

loadSubmissions();
