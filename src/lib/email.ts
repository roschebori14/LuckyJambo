const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });
  return res.json();
}

const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0f1e; color: #fff; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #0d1b3e; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #0050ff, #00c6ff); padding: 30px; text-align: center; }
  .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
  .body { padding: 30px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #0050ff, #00c6ff); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
  .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  .amount { font-size: 32px; font-weight: bold; color: #00e5ff; margin: 10px 0; }
</style></head>
<body>
  <div class="container">
    <div class="header"><h1>⚡ LUCKY JAMBO</h1></div>
    <div class="body">${content}</div>
    <div class="footer">© 2024 Lucky Jambo | Play • Compete • Win | <a href="mailto:support@luckyjambo.com" style="color:#00c6ff">support@luckyjambo.com</a></div>
  </div>
</body>
</html>`;

export async function sendWelcomeEmail(to: string, username: string) {
  return sendEmail({
    to,
    subject: '🎮 Welcome to Lucky Jambo – Play, Compete, Win!',
    html: baseTemplate(`
      <h2>Welcome, ${username}! 🎉</h2>
      <p>Your Lucky Jambo account is ready. You can now deposit funds, challenge friends, and win real money playing skill games.</p>
      <p><strong>How to get started:</strong></p>
      <ol>
        <li>Deposit via Mobile Money</li>
        <li>Find a friend or join the matchmaking queue</li>
        <li>Place your stake and play to win</li>
        <li>Withdraw your winnings anytime</li>
      </ol>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="btn">Start Playing →</a>
    `),
  });
}

export async function sendVerifyEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: '✅ Verify your Lucky Jambo account',
    html: baseTemplate(`
      <h2>Verify Your Email</h2>
      <p>Click the button below to verify your email address and activate your account.</p>
      <a href="${link}" class="btn">Verify Email →</a>
      <p style="color:#888;font-size:12px">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    `),
  });
}

export async function sendDepositSuccessEmail(to: string, username: string, amount: number) {
  return sendEmail({
    to,
    subject: '💰 Deposit Confirmed – Lucky Jambo',
    html: baseTemplate(`
      <h2>Deposit Successful! 💰</h2>
      <p>Hi ${username}, your deposit has been confirmed.</p>
      <div class="amount">${amount.toLocaleString()} XAF</div>
      <p>Your wallet has been credited. You're ready to play!</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/games" class="btn">Play Now →</a>
    `),
  });
}

export async function sendWithdrawalApprovedEmail(to: string, username: string, amount: number) {
  return sendEmail({
    to,
    subject: '✅ Withdrawal Approved – Lucky Jambo',
    html: baseTemplate(`
      <h2>Withdrawal Approved! ✅</h2>
      <p>Hi ${username}, your withdrawal has been approved and processed.</p>
      <div class="amount">${amount.toLocaleString()} XAF</div>
      <p>The funds will be sent to your Mobile Money number shortly.</p>
    `),
  });
}

export async function sendWithdrawalRejectedEmail(to: string, username: string, amount: number, reason?: string) {
  return sendEmail({
    to,
    subject: '❌ Withdrawal Rejected – Lucky Jambo',
    html: baseTemplate(`
      <h2>Withdrawal Rejected</h2>
      <p>Hi ${username}, your withdrawal request for <strong>${amount.toLocaleString()} XAF</strong> was rejected.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Your funds remain in your wallet. Contact support if you have questions.</p>
      <a href="mailto:support@luckyjambo.com" class="btn">Contact Support</a>
    `),
  });
}

export async function sendMatchChallengeEmail(to: string, username: string, challengerName: string, game: string, stake: number) {
  return sendEmail({
    to,
    subject: `⚔️ ${challengerName} challenged you to ${game}!`,
    html: baseTemplate(`
      <h2>You've Been Challenged! ⚔️</h2>
      <p>Hi ${username}, <strong>${challengerName}</strong> has challenged you to a game of <strong>${game}</strong>.</p>
      <p>Stake: <span class="amount">${stake.toLocaleString()} XAF</span></p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/matches" class="btn">Accept Challenge →</a>
    `),
  });
}
