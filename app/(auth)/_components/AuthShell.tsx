import Link from "next/link";
import type { ReactNode } from "react";

const shellStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#f4f2ff",
  background:
    "radial-gradient(circle at top, #292053 0, #100d22 48%, #090812 100%)",
} as const;

const cardStyle = {
  width: "min(100%, 420px)",
  padding: 28,
  border: "1px solid rgba(255,255,255,.11)",
  borderRadius: 18,
  background: "rgba(20,16,43,.92)",
  boxShadow: "0 24px 70px rgba(0,0,0,.38)",
} as const;

export const authInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  padding: "11px 12px",
  border: "1px solid #494266",
  borderRadius: 9,
  color: "#fff",
  background: "#121022",
} as const;

export const authButtonStyle = {
  width: "100%",
  marginTop: 18,
  padding: "11px 14px",
  border: 0,
  borderRadius: 9,
  color: "#fff",
  background: "linear-gradient(135deg,#7c5cff,#5667ff)",
  cursor: "pointer",
  fontWeight: 700,
} as const;

export const authLabelStyle = {
  display: "block",
  marginTop: 14,
  color: "#cbc6e6",
  fontSize: 14,
} as const;

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main style={shellStyle}>
      <section style={cardStyle}>
        <Link href="/" style={{ color: "#a89cff", textDecoration: "none" }}>
          ← 返回工作台
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "0 0 20px", color: "#9991b7" }}>{description}</p>
        {children}
        {footer && (
          <div style={{ marginTop: 18, color: "#aaa4c2", fontSize: 14 }}>
            {footer}
          </div>
        )}
      </section>
    </main>
  );
}
