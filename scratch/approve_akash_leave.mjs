import https from "https";
const PROJECT_ID = "kalpanaaa-employees-website";
const API_KEY = "AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA";
const ADMIN_EMAIL = "d.koushik@kalpanaaasoftwaresolutions.in";
const ADMIN_PASS = "Koushik@777";

function request(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers["Content-Length"] = Buffer.byteLength(bodyStr);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error("HTTP " + res.statusCode + ": " + data));
        } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function signIn() {
  const res = await request("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY, "POST", { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true });
  return res.idToken;
}

async function patchDoc(token, docPath, updates) {
  const fields = {};
  const keys = Object.keys(updates);
  for (const k of keys) fields[k] = { stringValue: updates[k] };
  const mask = keys.map(f => "updateMask.fieldPaths=" + encodeURIComponent(f)).join("&");
  return request("https://firestore.googleapis.com/v1/" + docPath + "?" + mask, "PATCH", { fields }, token);
}

async function main() {
  const token = await signIn();
  const docPath = "projects/kalpanaaa-employees-website/databases/(default)/documents/leaveRequests/LR_KSS2407013_2026-08-25_Leave";
  console.log("Setting Akash SB leave to Approved (1 Earn Leave taken)...");
  await patchDoc(token, docPath, {
    status: "Approved",
    pmStatus: "Approved",
    hrStatus: "Approved",
    ceoStatus: "Approved",
    ctoStatus: "Approved",
    reviewNotes: "Approved - 1 Earn Leave taken"
  });
  console.log("✅ Akash SB leave updated to Approved in Cloud Firestore!");
}

main().catch(console.error);
