const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const submissionsFile = path.join(dataDir, "submissions.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, "[]\n", "utf8");
  }
}

function readSubmissions() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(submissionsFile, "utf8"));
  } catch {
    return [];
  }
}

function saveSubmission(entry) {
  const submissions = readSubmissions();
  submissions.unshift(entry);
  fs.writeFileSync(submissionsFile, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

function validateContactForm(payload) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();
  const interest = String(payload.interest || "").trim();
  const message = String(payload.message || "").trim();
  const consent = Boolean(payload.consent);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\d{10}$/;
  const allowedInterests = new Set(["Volunteer", "Donate", "Partner", "Learn"]);

  const errors = {};

  if (name.length < 2) {
    errors.name = "Please enter at least 2 characters.";
  }

  if (!emailPattern.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!phonePattern.test(phone)) {
    errors.phone = "Please enter a 10 digit phone number.";
  }

  if (!allowedInterests.has(interest)) {
    errors.interest = "Please select one option.";
  }

  if (message.length < 10) {
    errors.message = "Please write a message of at least 10 characters.";
  }

  if (!consent) {
    errors.consent = "Please confirm permission to contact you.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: { name, email, phone, interest, message, consent }
  };
}

function buildStats(submissions) {
  return {
    total: submissions.length,
    volunteers: submissions.filter(entry => entry.interest === "Volunteer").length,
    donations: submissions.filter(entry => entry.interest === "Donate").length,
    partners: submissions.filter(entry => entry.interest === "Partner").length
  };
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const filePath = path.normalize(path.join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Page not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/contact") {
    try {
      const payload = await parseBody(request);
      const result = validateContactForm(payload);

      if (!result.isValid) {
        sendJson(response, 422, {
          message: "Please fix the highlighted fields.",
          errors: result.errors
        });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        ...result.values,
        createdAt: new Date().toISOString()
      };

      saveSubmission(entry);
      sendJson(response, 201, {
        message: "Form Submitted Successfully",
        submission: entry
      });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/submissions") {
    const submissions = readSubmissions();
    sendJson(response, 200, {
      submissions,
      stats: buildStats(submissions)
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/stats") {
    sendJson(response, 200, { stats: buildStats(readSubmissions()) });
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ message: "Method not allowed" }));
});

server.listen(port, () => {
  console.log(`She Can Foundation contact portal is running at http://localhost:${port}`);
});
