import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deleteListing } from "@/lib/api/listing.functions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogHeader,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

type ListingType = "product" | "rental" | "food" | "notes";

export function ListingActions({
  itemType,
  itemId,
  ownerId,
  onEdit,
  onDeleted,
}: {
  itemType: ListingType;
  itemId: string;
  ownerId: string | null | undefined;
  onEdit?: () => void;
  onDeleted?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();

  const canShow = Boolean(user && (isAdmin || user.id === ownerId));
  if (!canShow) return null;

  const bucketFor = (type: ListingType) => {
    switch (type) {
      case "product":
        return "product-images";
      case "rental":
        return "rental-images";
      case "food":
        return "food-images";
      case "notes":
        return "notes-assets";
      default:
        return "";
    }
  };

  const imagesTableFor = (type: ListingType) => {
    switch (type) {
      case "product":
        return "product_images";
      case "rental":
        return "rental_images";
      case "food":
        return "food_images";
      case "notes":
        return "notes_assets";
      default:
        return "";
    }
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      // If admin (and not the owner), use server-side delete to bypass RLS and ensure storage cleanup
      if (isAdmin && user && user.id !== ownerId) {
        await deleteListing({ data: { itemType, itemId } as any });
      } else {
        // Owner delete path: fetch image rows and delete storage, then delete DB row
        const bucket = bucketFor(itemType);
        const imagesTable = imagesTableFor(itemType);

        let paths: string[] = [];
        if (imagesTable) {
          const columnName =
            itemType === "product"
              ? "product_id"
              : itemType === "rental"
                ? "rental_id"
                : itemType === "food"
                  ? "food_listing_id"
                  : "listing_id";

          const { data: imgs, error: imgsErr } = await supabase
            .from(imagesTable as never)
            .select("storage_path")
            .eq(columnName, itemId as never);
          if (imgsErr) throw imgsErr;
          type ImageRow = { storage_path?: string | null };
          paths = (imgs ?? []).map((r: ImageRow) => r.storage_path ?? "").filter(Boolean);
        }

        if (paths.length && bucket) {
          try {
            await supabase.storage.from(bucket).remove(paths);
          } catch (err) {
            console.warn("Failed to delete storage objects:", err);
          }
        }

        const tableName =
          itemType === "product"
            ? "product_listings"
            : itemType === "rental"
              ? "rental_listings"
              : itemType === "food"
                ? "food_listings"
                : "notes_listings";

        const { error } = await supabase
          .from(tableName as never)
          .delete()
          .eq("id", itemId as never);
        if (error) throw error;

        // If owner deletion succeeded, optionally attempt to log admin_actions locally (best-effort)
        try {
          if (isAdmin && user && user.id !== ownerId) {
            await supabase.from("admin_actions" as never).insert({
              admin_user_id: user.id,
              action: "deleted_listing",
              target_listing_id: itemId,
              notes: itemType + " removed by admin",
            });
          }
        } catch (e) {
          console.warn("Failed to log admin action", e);
        }

        toast.success("Listing removed");
        qc.invalidateQueries({});
        onDeleted?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete listing");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="absolute right-2 top-2 z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Listing actions" className="rounded-md p-1 hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          side="bottom"
          sideOffset={8}
          alignOffset={0}
          collisionPadding={16}
          avoidCollisions={true}
        >
          {user?.id === ownerId ? (
            <DropdownMenuItem onSelect={() => onEdit?.()}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ListingActions;
