/* eslint-disable no-console */
/**
 * Print a user's child details by email.
 *
 * This reads from:
 * - User.children[] (embedded child profiles)
 * Optionally shows:
 * - Latest auto-apply Application child fields (childName/childDob/etc)
 *
 * Usage (from backend folder):
 *   node scripts/checkUserChildrenByEmail.js sahinh013@gmail.com
 *
 * Required env:
 * - MONGODB_URI (backend/.env)
 * Optional env:
 * - DB_NAME (default: daycare_concierge)
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Application = require("../src/schemas/ApplicationSchema");

function printSection(title, body) {
  console.log(`\n=== ${title} ===`);
  if (body === undefined) return;
  if (body === null) return console.log("(null)");
  if (typeof body === "string") return console.log(body);
  console.log(JSON.stringify(body, null, 2));
}

function normalizeChildKey(app) {
  const name = String(app?.childName || "").trim();
  const dob = app?.childDob ? new Date(app.childDob).toISOString().slice(0, 10) : "";
  return `${name}__${dob}`;
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();

  if (!email) {
    console.error(
      "Email is required. Example: node scripts/checkUserChildrenByEmail.js user@example.com"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri.replace(/[<>]/g, ""), {
    dbName: process.env.DB_NAME || "daycare_concierge",
  });

  const user = await User.findOne({ email })
    .select("_id email userType isActive children createdAt updatedAt")
    .lean();

  if (!user?._id) {
    printSection("USER", { email, found: false });
    process.exit(2);
  }

  const userId = String(user._id);
  printSection("USER", {
    userId,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  const children = Array.isArray(user.children) ? user.children : [];
  printSection("CHILDREN (User.children[])", {
    count: children.length,
    children,
  });

  const autoApplyApps = await Application.find({ userId, source: "auto_apply" })
    .select(
      "_id daycareId source status parentName parentEmail parentPhone childName childDob preferredStartDate specialNotes createdAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  const latestAutoApply = autoApplyApps[0] || null;
  const distinctChildrenMap = new Map();
  for (const app of autoApplyApps) {
    const key = normalizeChildKey(app);
    if (!key || key === "__") continue;
    if (!distinctChildrenMap.has(key)) {
      distinctChildrenMap.set(key, {
        childName: String(app.childName || "").trim(),
        childDob: app.childDob || null,
        firstSeenAt: app.createdAt || null,
        lastSeenAt: app.createdAt || null,
        usedInApplications: 1,
      });
    } else {
      const entry = distinctChildrenMap.get(key);
      entry.usedInApplications += 1;
      entry.lastSeenAt = app.createdAt || entry.lastSeenAt;
    }
  }

  const distinctChildren = [...distinctChildrenMap.values()].sort((a, b) => {
    const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bt - at;
  });

  printSection(
    "LATEST AUTO-APPLY APPLICATION (child fields stored per-application)",
    latestAutoApply || null
  );

  printSection("AUTO-APPLY CHILDREN USED (from Application records)", {
    totalAutoApplyApplications: autoApplyApps.length,
    distinctChildrenCount: distinctChildren.length,
    distinctChildren,
  });

  printSection("LAST 20 AUTO-APPLY APPLICATIONS (child fields)", autoApplyApps.slice(0, 20));

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch(async (e) => {
  console.error("\ncheckUserChildrenByEmail failed:", e?.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

