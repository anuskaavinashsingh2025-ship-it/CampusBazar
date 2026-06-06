import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send } from "lucide-react";

import {
  useSendMessage,
  useSetTyping,
  useUploadChatImage,
} from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".mjs", ".cjs", ".ts", ".py",
  ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".dmg", ".apk", ".msi",
  ".dll", ".so", ".bin", ".jar", ".war", ".php", ".rb", ".pl", ".html", ".htm",
];

function isAllowedChatFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return false;
  const lower = file.name.toLowerCase();
  return !BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

type ChatComposerProps = {
  userId: string;
  conversationId: string;
  recipientId: string;
  listingTitle: string;
  disabled?: boolean;
};

export function ChatComposer({
  userId,
  conversationId,
  recipientId,
  listingTitle,
  disabled,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSendMessage(userId);
  const upload = useUploadChatImage(userId);
  const setTyping = useSetTyping(userId, conversationId);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    send.mutate(
      {
        conversationId,
        content: trimmed,
        messageType: "text",
        recipientId,
        listingTitle,
      },
      { onSuccess: () => setText("") },
    );
    void setTyping.mutateAsync(false);
  };

  const handleImage = async (file: File) => {
    if (disabled) return;
    if (!isAllowedChatFile(file)) {
      toast.error("Only image files (JPEG, PNG, GIF, WebP) are allowed. No executables or archives.");
      return;
    }
    const path = await upload.mutateAsync(file);
    send.mutate({
      conversationId,
      content: path,
      messageType: "image",
      recipientId,
      listingTitle,
    });
  };

  return (
    <div className="border-t bg-card p-3">
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImage(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || upload.isPending}
          onClick={() => fileRef.current?.click()}
          aria-label="Send image"
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </Button>
        <Textarea
          className="min-h-[44px] max-h-32 resize-none"
          placeholder="Type a message..."
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            void setTyping.mutateAsync(e.target.value.length > 0);
          }}
          onBlur={() => void setTyping.mutateAsync(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={disabled || !text.trim() || send.isPending}
          onClick={handleSend}
          aria-label="Send message"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Images only — no executables, scripts, or archives.
      </p>
    </div>
  );
}
