import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { Shell } from "@/components/shell/Shell";
import { signOut } from "../login/actions";

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const a = await requireSession();
  const jar = await cookies();
  const theme = jar.get("bos_theme")?.value === "light" ? "light" : "dark";
  const navCollapsed = jar.get("bos_nav")?.value === "collapsed";
  return (
    <Shell perms={[...a.perms]} name={a.member.full_name} roles={a.roles} theme={theme} navCollapsed={navCollapsed} signOut={signOut}>
      {children}
    </Shell>
  );
}
