import { Link } from "@tanstack/react-router";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/profile", label: "Profile" },
    { to: "/preferences", label: "Preferences" },
    { to: "/privacy", label: "Privacy" },
    { to: "/todos", label: "Todos" },
    { to: "/deployments", label: "Deployments" },
    { to: "/ai", label: "AI Chat" },
    { to: "/drive", label: "Drive" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
