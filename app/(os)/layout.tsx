import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { Shell } from "@/components/shell/Shell";
import { signOut } from "../login/actions";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const a = await requireSession();
  const theme = (await cookies()).get("bos_theme")?.value === "light" ? "light" : "dark";
  return (
    <Shell perms={[...a.perms]} name={a.member.full_name} roles={a.roles} theme={theme} signOut={signOut}>
      {children}
    </Shell>
  );
}
