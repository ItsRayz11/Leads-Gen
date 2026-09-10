import "./globals.css";

export const metadata = {
  title: "Lead Intelligence Workspace",
  description: "Private lead intelligence, CRM and outreach workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
