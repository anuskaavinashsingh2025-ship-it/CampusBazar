import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bike,
  FileText,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  MessageSquare,
  Package,
  Shield,
  Store,
  Tag,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useUnreadNotificationCount } from "@/lib/notifications";

const mainItems = [
  { title: "Home", url: "/", icon: Home, external: true },
  { title: "Rent", url: "/rent", icon: Bike, external: true },
  { title: "Sell", url: "/upload-product", icon: Tag },
  { title: "Notes Hub", url: "/notes", icon: FileText, external: true },
  { title: "Chats", url: "/chats", icon: MessageSquare, disabled: true },
  { title: "Requests", url: "/requests", icon: Shield },
  { title: "Seller Profile", url: "/seller-profile", icon: Store },
] as const;

const secondaryItems = [
  { title: "Notifications", url: "/notifications", icon: Bell, showBadge: true },
  { title: "Wishlist", url: "/wishlist", icon: Heart },
  { title: "Profile", url: "/profile", icon: User },
] as const;

function isNavActive(pathname: string, url: string, external?: boolean) {
  if (url === "/") return pathname === "/";
  if (external) return pathname === url || pathname.startsWith(`${url}/`);
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleAuthAction = async () => {
    if (user) {
      await handleSignOut();
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">CampusBazar</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {"disabled" in item && item.disabled ? (
                    <SidebarMenuButton disabled className="opacity-60">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                        Soon
                      </span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      isActive={isNavActive(pathname, item.url, item.external)}
                    >
                      <Link
                        to={item.url}
                        className="flex items-center gap-2"
                        {...(item.external ? { target: "_self" } : {})}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.showBadge && unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                    <Link to="/admin" className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Admin Portal</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href="mailto:support@campusbazar.app"
                className="flex items-center gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help &amp; Support</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleAuthAction}
              className={user ? "text-destructive hover:text-destructive" : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span>{user ? "Log Out" : "Sign In"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
