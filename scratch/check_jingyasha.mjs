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

async function getAllDocs(token, collection) {
  let all = [];
  let pageToken = null;
  do {
    const url = FIRESTORE_BASE + "/" + collection + "?pageSize=100" + (pageToken ? "&pageToken=" + pageToken : "");
    const res = await request(url, "GET", null, token);
    if (res.documents) all = all.concat(res.documents);
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  const token = await signIn();
  const employees = await getAllDocs(token, "employees");
  for (const doc of employees) {
    const name = (doc.fields?.fullName?.stringValue || "").toLowerCase();
    const empId = (doc.fields?.employeeId?.stringValue || "").toLowerCase();
    const id = doc.name.split("/").pop();
    if (name.includes("jigy") || name.includes("jing") || empId.includes("kss2407014") || id.includes("kss2407014")) {
      console.log("Found Jingyasha doc:", id, JSON.stringify(doc.fields, null, 2));
    }
  }
}

main().catch(console.error);
