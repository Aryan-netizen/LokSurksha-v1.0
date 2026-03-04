import "./globals.css";
import AppShell from "./AppShell";

export const metadata = {
  title: "LokSurksha",
  description: "Community crime reporting, live heatmaps, and analytics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
