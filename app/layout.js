export const metadata = {
  title: 'AI Receptionist',
  description: 'AI-powered receptionist for local businesses',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
