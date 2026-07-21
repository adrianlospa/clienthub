import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (!transporter) {
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (!user || !pass) throw new Error('SMTP_USER / SMTP_PASS nu sunt setate')
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.SMTP_USER
  await getTransporter().sendMail({ from: `ClientHub <${from}>`, to, subject, html })
}
