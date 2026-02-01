export const metadata = {
  title: 'Proof - Autonomous Social Proof Engine',
  description: 'Transform customer reviews into high-converting video testimonials',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
