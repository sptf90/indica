"use client";

import Link from "next/link";
import NavIcon from "@/components/NavIcon";
import { isNavigationActive } from "@/lib/navigation";

function NavigationLink({ item, pathname, nested = false, onNavigate }) {
  const active = isNavigationActive(pathname, item);
  return (
    <Link href={item.href} className={`${nested ? "sidebar-sublink" : "sidebar-link"}${active ? " active" : ""}`}
      aria-current={pathname === item.href ? "page" : undefined} data-tour={item.tourId} onClick={onNavigate}>
      {item.icon ? <NavIcon name={item.icon} /> : null}
      <span>{item.label}</span>
    </Link>
  );
}

function NavigationItem({ item, pathname, onNavigate }) {
  if (!item.children?.length) return <NavigationLink item={item} pathname={pathname} onNavigate={onNavigate} />;
  const active = item.children.some(child => isNavigationActive(pathname, child));
  const children = (
    <div className="sidebar-subnav" role="group" aria-label={item.label}>
      {item.children.map(child => <NavigationLink key={child.href} item={child} pathname={pathname} nested onNavigate={onNavigate} />)}
    </div>
  );
  if (item.collapsible) {
    return (
      <details className={`sidebar-group sidebar-disclosure${active ? " is-active" : ""}`} open={active}>
        <summary className="sidebar-link">
          <NavIcon name={item.icon} /><span>{item.label}</span>
          <svg className="sidebar-chevron" viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
            <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        {children}
      </details>
    );
  }
  return (
    <div className="sidebar-group">
      <NavigationLink item={item} pathname={pathname} onNavigate={onNavigate} />
      {children}
    </div>
  );
}

export default function SidebarNavigation({ groups, pathname, onNavigate }) {
  return (
    <nav className="sidebar-nav" aria-label="Menu principal">
      {groups.map(group => (
        <div key={group.id} className="sidebar-section" role={group.label ? "group" : undefined} aria-label={group.label}>
          {group.label ? <h2 className="sidebar-section-title">{group.label}</h2> : null}
          {group.items.map(item => <NavigationItem key={`${pathname}:${item.id || item.href}`} item={item} pathname={pathname} onNavigate={onNavigate} />)}
        </div>
      ))}
    </nav>
  );
}
