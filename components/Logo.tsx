import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1f6f5c" />
      <path d="M18 24h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4Z" fill="none" stroke="#fff" strokeWidth="3.5" />
      <path d="M22 24l16-8 6 8" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="42" cy="35" r="3" fill="#fff" />
    </svg>
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold text-ink">
      <LogoMark />
      <span className="text-lg">{BRAND.name}</span>
    </Link>
  );
}
