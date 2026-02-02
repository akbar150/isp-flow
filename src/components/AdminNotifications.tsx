import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, AlertTriangle, Users, Package, DollarSign, Info, UserPlus, Receipt, Boxes, Briefcase, Calculator } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type NotificationType = 
  | 'overdue_customer' 
  | 'expiring_customer' 
  | 'low_stock' 
  | 'payment_received' 
  | 'system'
  | 'new_customer'
  | 'billing_generated'
  | 'asset_assigned'
  | 'hrm_update'
  | 'accounting_update';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  target_role?: 'super_admin' | 'admin' | 'staff' | null;
}

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  overdue_customer: AlertTriangle,
  expiring_customer: Users,
  low_stock: Package,
  payment_received: DollarSign,
  system: Info,
  new_customer: UserPlus,
  billing_generated: Receipt,
  asset_assigned: Boxes,
  hrm_update: Briefcase,
  accounting_update: Calculator,
};

const notificationColors: Record<string, string> = {
  overdue_customer: "text-red-500",
  expiring_customer: "text-yellow-500",
  low_stock: "text-orange-500",
  payment_received: "text-green-500",
  system: "text-blue-500",
  new_customer: "text-primary",
  billing_generated: "text-violet-500",
  asset_assigned: "text-cyan-500",
  hrm_update: "text-indigo-500",
  accounting_update: "text-emerald-500",
};

export function AdminNotifications() {
  const { isAdmin, isSuperAdmin, isStaff, user, role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if user should see notifications (all authenticated users)
  const canViewNotifications = user && (isSuperAdmin || isAdmin || isStaff);

  useEffect(() => {
    if (!canViewNotifications) return;

    // Create audio element for notification sound
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8QLYl/hXdqWExacHOTmZyXk4yNh4l4bHByh5WPhnd6b1pWZoKSl5GGdWZbTkU5Pz9CRkxOUFJWVVJPSklITlVdY2lrbm5ra21vcXJzeHN5dXF3dHNxamFdXmRpbnN2dnNwd3N0dXVxb3N3hYuMiH94dG9oZWJfZ21ze36DhIJ+eHRvbXJwb3JydXt/gIB+e3d4fH2AgYOEhIKEhYWGhYSDg4SGhomLioiHh4eFhIOBgH9+fn5+fX1/gIGDhIWFhoaGhYWEhIODg4ODgoKBgIB/f39+fn5+fn5+foCBgoKDg4ODg4OCgoKBgYCAgH9/f39/f4CAgICBgYGCgoKCgoKCgoKBgYGAgICAgICAf4B/gICAgICAgYGBgYGBgYGBgYGBgYGAgICAgA==");
    
    fetchNotifications();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('admin_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.play().catch(() => {
              // Audio playback failed (user hasn't interacted with page yet)
            });
          }
          
          // Show browser notification if permitted
          if (Notification.permission === "granted") {
            new Notification(newNotification.title, {
              body: newNotification.message,
              icon: "/favicon.ico",
            });
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canViewNotifications]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Filter notifications based on user role
      const filteredData = (data || []).filter(n => {
        // If no target_role specified, show to all
        if (!n.target_role) return true;
        // Show if target_role matches user's role
        return n.target_role === role;
      }) as Notification[];
      
      setNotifications(filteredData);
      setUnreadCount(filteredData.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .eq("id", id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      await supabase
        .from("admin_notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  if (!canViewNotifications) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Info;
              const colorClass = notificationColors[notification.type] || "text-muted-foreground";
              
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors",
                    !notification.is_read && "bg-muted/30"
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", colorClass)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", !notification.is_read && "font-semibold")}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(notification.created_at), "dd MMM, h:mm a")}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
