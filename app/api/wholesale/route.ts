import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { business, email, type, message } = body ?? {};

    if (!business || !email || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const entry = {
      business,
      email,
      type,
      message: message ?? "",
      receivedAt: new Date().toISOString(),
    };

    const filePath = path.join(process.cwd(), "data", "wholesale-submissions.jsonl");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, JSON.stringify(entry) + "\n", "utf8");

    console.log("Wholesale submission saved:", entry);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error handling wholesale submission:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
