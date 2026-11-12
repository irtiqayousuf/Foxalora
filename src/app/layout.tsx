import type { Metadata } from "next";
import { Providers } from "@/theme/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foxalora Mail",
  description: "A calmer corner of your day. Foxalora Mail prototype.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
