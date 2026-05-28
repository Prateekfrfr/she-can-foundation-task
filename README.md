# She Can Foundation Volunteer & Contact Portal

A responsive full stack webpage created for the She Can Foundation internship task.

## Features

- Modern responsive NGO landing page
- She Can Foundation mission, programs, team, certificate, and contact sections
- Contact form with name, email, phone, interest, consent, and message fields
- Client-side validation and backend validation
- Success message after submission
- Lightweight Node.js API without external packages
- Submissions saved to `data/submissions.json`
- Live backend dashboard with total messages, volunteer leads, and donation interest

## How to run

```bash
node server.js
```

Open this URL in the browser:

```text
http://localhost:3000
```

## Project structure

```text
public/
  index.html
  styles.css
  script.js
data/
  submissions.json
server.js
package.json
README.md
```

## API endpoints

```text
POST /api/contact
GET  /api/submissions
GET  /api/stats
```
