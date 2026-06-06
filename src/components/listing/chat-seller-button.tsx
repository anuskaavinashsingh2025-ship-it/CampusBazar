import { MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

type ChatSellerButtonProps = {
  sellerId: string;
  chatUnlocked: boolean;
  className?: string;
};

export function ChatSellerButton({ sellerId, chatUnlocked, className }: ChatSellerButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id === sellerId) {
      toast.error("You can't chat with yourself.");
      return;
    }
    if (chatUnlocked) {
      toast.message("Chat is unlocked — full messaging coming soon.");
      return;
    }
    toast.message("Chat unlocks after the seller accepts your request.");
  };

  return (
    <Button variant="outline" className={className ?? "gap-2"} onClick={handleClick}>
      <MessageSquare className="h-4 w-4" />
      {chatUnlocked ? "Chat Seller" : "Chat Seller"}
    </Button>
  );
}
