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

function getStr(doc, field) { return doc.fields?.[field]?.stringValue || ""; }

async function patchDoc(token, docPath, updates) {
  const fields = {};
  const keys = Object.keys(updates);
  for (const k of keys) fields[k] = { stringValue: updates[k] };
  const mask = keys.map(f => "updateMask.fieldPaths=" + encodeURIComponent(f)).join("&");
  return request("https://firestore.googleapis.com/v1/" + docPath + "?" + mask, "PATCH", { fields }, token);
}

function isExec(name, desig) {
  const n = (name || "").toLowerCase();
  const d = (desig || "").toLowerCase();
  return d.includes("founder") || d.includes("managing director") || d.includes("ceo") || d.includes("cto") || d.includes("project manager") || n.includes("gaurav") || n.includes("akshit") || n.includes("koushik");
}

async function main() {
  const token = await signIn();
  const docs = await getAllDocs(token, "employees");
  console.log(`Setting all standard employees to Intern in Firestore (${docs.length} docs)...`);

  for (const doc of docs) {
    const name = getStr(doc, "fullName");
    const desig = getStr(doc, "designation");
    const rawJoin = getStr(doc, "joiningDate");
    
    if (isExec(name, desig)) {
      await patchDoc(token, doc.name, { employmentType: "Full-Time" });
      console.log(`- [EXEC] ${name} (${desig}) -> Full-Time`);
    } else {
      const updates = { employmentType: "Intern" };
      if (!rawJoin || rawJoin < "2026-07-27") {
        updates.joiningDate = "2026-07-27";
      }
      await patchDoc(token, doc.name, updates);
      console.log(`- [STAFF] ${name} (${desig}) -> Intern (join: ${updates.joiningDate || rawJoin})`);
    }
  }

  console.log("\n✅ All employees in Cloud Firestore synchronized to Intern stage!");
}

main().catch(console.error);
