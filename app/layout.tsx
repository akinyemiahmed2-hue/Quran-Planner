import "./globals.css";
import { Inter, Amiri } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata = {
  title: "Qur’an Planner",
  description: "Plan your daily pages and track your khatmah in Ramadan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${amiri.variable}`}>
      <body>{children}</body>
    </html>
  );
}
