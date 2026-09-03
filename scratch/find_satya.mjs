import https from "https";
const PROJECT_ID = "kalpanaaa-employees-website";
const API_KEY = "AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA";
const ADMIN_EMAIL = "d.koushik@kalpanaaasoftwaresolutions.in";
const ADMIN_PASS = "Koushik@777";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
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
async function getAllEmployees(token) {
  let all = [];
  let pageToken = null;
  do {
    const url = FIRESTORE_BASE + "/employees?pageSize=100" + (pageToken ? "&pageToken=" + pageToken : "");
    const res = await request(url, "GET", null, token);
    if (res.documents) all = all.concat(res.documents);
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}
function getStr(doc, field) { return doc.fields?.[field]?.stringValue || ""; }
async function patchEmployee(token, docName, updates) {
  const fields = {};
  const keys = Object.keys(updates);
  for (const k of keys) fields[k] = { stringValue: updates[k] };
  const mask = keys.map(f => "updateMask.fieldPaths=" + encodeURIComponent(f)).join("&");
  return request("https://firestore.googleapis.com/v1/" + docName + "?" + mask, "PATCH", { fields }, token);
}
async function main() {
  const token = await signIn();
  const docs = await getAllEmployees(token);
  console.log("Total employees found: " + docs.length);
  docs.forEach(doc => {
    const name = getStr(doc, "fullName");
    const empId = getStr(doc, "employeeId");
    const desig = getStr(doc, "designation");
    console.log("  " + empId + " | " + name + " | " + desig);
  });
  console.log("---");
  const targets = docs.filter(doc => getStr(doc, "fullName").toLowerCase().includes("satya"));
  if (targets.length) {
    console.log("Found Satya match(es): " + targets.map(d => getStr(d, "fullName")).join(", "));
    for (const doc of targets) {
      await patchEmployee(token, doc.name, { designation: "Tech Lead", employmentType: "Software Developer" });
      console.log("UPDATED: " + getStr(doc, "fullName"));
    }
  } else {
    console.log("No 'satya' found. Please check full list above.");
  }
}
main().catch(console.error);
