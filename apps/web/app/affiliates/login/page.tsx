import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function AffiliateLoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/affiliates"
          className="block text-center mb-8 text-sm tracking-widest uppercase text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          BevTek Affiliates
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
