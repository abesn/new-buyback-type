/**
 * POST /api/contact
 *
 * Public endpoint — tenant visitors submit a contact form.
 * Sends the message to the tenant admin's email address.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import nodemailer from "nodemailer";

interface ContactBody {
  tenantId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId, name, email, subject, message } = body;

  if (!tenantId || !name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Find the tenant + admin email
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        where: { role: "TENANT_ADMIN" },
        select: { email: true },
        take: 1,
      },
      napSettings: { select: { businessName: true } },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const adminEmail = tenant.users[0]?.email;
  const businessName = tenant.napSettings?.businessName ?? tenant.name;

  if (!adminEmail) {
    // No admin email — silently succeed so the visitor isn't confused
    return NextResponse.json({ ok: true });
  }

  const FROM = process.env.EMAIL_FROM ?? "no-reply@buybacksite.com";

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from: FROM,
      to: adminEmail,
      replyTo: `"${name}" <${email}>`,
      subject: `[${businessName}] Contact form: ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
          <h2 style="color:#ea580c;margin-bottom:4px;">New Contact Form Message</h2>
          <p style="color:#666;font-size:13px;margin-top:0;">Submitted via ${businessName}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <table style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="padding:8px 0;color:#666;font-size:13px;width:80px;vertical-align:top;">From</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;">${name} &lt;${email}&gt;</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;font-size:13px;vertical-align:top;">Subject</td>
              <td style="padding:8px 0;font-size:14px;">${subject}</td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <p style="font-size:13px;color:#666;margin-bottom:8px;">Message:</p>
          <div style="background:#f9f9f9;border-left:3px solid #ea580c;padding:16px;border-radius:4px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#aaa;">Reply directly to this email to respond to ${name}.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[contact] Failed to send email:", err);
    // Don't expose mail errors to the visitor
  }

  return NextResponse.json({ ok: true });
}
